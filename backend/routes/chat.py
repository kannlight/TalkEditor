import asyncio
import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional

from services.deps import get_llm_service

router = APIRouter()


# --- Pydantic Models ---

class StyleContext(BaseModel):
    theme: str = ""
    purpose: str = ""
    audience: str = ""
    image: str = ""
    format: str = "Plain"
    style: list[str] = []
    length: str = ""
    notes: str = ""


class ChatRequest(BaseModel):
    message: str
    style_context: StyleContext
    content_context: str
    editor_content: str
    conversation_history: list[dict]
    service_id: str


class StyleUpdate(BaseModel):
    theme: Optional[str] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    image: Optional[str] = None
    format: Optional[str] = None
    style: Optional[list[str]] = None
    length: Optional[str] = None
    notes: Optional[str] = None


class ActionResult(BaseModel):
    type: str
    message: Optional[str] = None
    plan: Optional[str] = None


class ChatResponse(BaseModel):
    style_update: Optional[StyleUpdate] = None
    content_update: Optional[str] = None
    action: ActionResult


class EditRequest(BaseModel):
    style_context: StyleContext
    edit_plan: str
    editor_content: str
    service_id: str


class GenerateRequest(BaseModel):
    style_context: StyleContext
    content_context: str
    service_id: str


# --- LLM応答スキーマ ---

class StyleUpdateSchema(BaseModel):
    updated: bool
    theme: Optional[str] = None
    purpose: Optional[str] = None
    audience: Optional[str] = None
    image: Optional[str] = None
    format: Optional[str] = None
    style: Optional[list[str]] = None
    length: Optional[str] = None
    notes: Optional[str] = None


class ContentUpdateSchema(BaseModel):
    updated: bool
    content: Optional[str] = None


class ActionSchema(BaseModel):
    action: str
    message: Optional[str] = None
    plan: Optional[str] = None


# --- Helpers ---

def style_context_to_str(ctx: StyleContext) -> str:
    lines = []
    if ctx.theme:
        lines.append(f"テーマ・トピック: {ctx.theme}")
    if ctx.purpose:
        lines.append(f"文章の目的: {ctx.purpose}")
    if ctx.audience:
        lines.append(f"想定読者: {ctx.audience}")
    if ctx.image:
        lines.append(f"イメージ: {ctx.image}")
    lines.append(f"フォーマット: {ctx.format}")
    if ctx.style:
        lines.append(f"スタイル: {', '.join(ctx.style)}")
    if ctx.length:
        lines.append(f"文章の量感: {ctx.length}")
    if ctx.notes:
        lines.append(f"その他メモ: {ctx.notes}")
    return "\n".join(lines) if lines else "（未設定）"


def parse_style_update_json(text: str) -> Optional[StyleUpdate]:
    try:
        data = json.loads(text)
        if not data.get("updated", False):
            return None
        patch = {}
        for key in ("theme", "purpose", "audience", "image", "format", "style", "length", "notes"):
            if key in data and data[key] is not None:
                patch[key] = data[key]
        return StyleUpdate(**patch) if patch else None
    except (json.JSONDecodeError, Exception):
        return None


def parse_content_update_json(text: str) -> Optional[str]:
    try:
        data = json.loads(text)
        if not data.get("updated", False):
            return None
        content = data.get("content")
        return content.strip() if content else None
    except (json.JSONDecodeError, Exception):
        return None


def parse_action_json(text: str) -> Optional[ActionResult]:
    try:
        data = json.loads(text)
        action_type = data.get("action", "")
        if action_type not in ("question", "clarify", "edit_text"):
            return None
        if action_type == "edit_text":
            return ActionResult(type="edit_text", plan=data.get("plan", ""))
        else:
            message = data.get("message", "")
            return ActionResult(type=action_type, message=message) if message else None
    except (json.JSONDecodeError, Exception):
        return None


MAX_RETRIES = 3


async def _style_update_with_retry(llm, system_prompt: str, user_prompt: str, history: list[dict]) -> Optional[StyleUpdate]:
    for attempt in range(MAX_RETRIES):
        raw = await llm.generate_sync(
            system_prompt, user_prompt,
            label=f"style_update_attempt_{attempt + 1}",
            history=history,
            response_schema=StyleUpdateSchema,
        )
        try:
            json.loads(raw)
            return parse_style_update_json(raw)
        except json.JSONDecodeError:
            print(f"[StyleUpdate] Retry {attempt + 1}: invalid JSON")
    return None


async def _content_update_with_retry(llm, system_prompt: str, user_prompt: str, history: list[dict]) -> Optional[str]:
    for attempt in range(MAX_RETRIES):
        raw = await llm.generate_sync(
            system_prompt, user_prompt,
            label=f"content_update_attempt_{attempt + 1}",
            history=history,
            response_schema=ContentUpdateSchema,
        )
        try:
            json.loads(raw)
            return parse_content_update_json(raw)
        except json.JSONDecodeError:
            print(f"[ContentUpdate] Retry {attempt + 1}: invalid JSON")
    return None


async def _action_with_retry(llm, system_prompt: str, user_prompt: str, history: list[dict]) -> ActionResult:
    for attempt in range(MAX_RETRIES):
        raw = await llm.generate_sync(
            system_prompt, user_prompt,
            label=f"action_attempt_{attempt + 1}",
            history=history,
            response_schema=ActionSchema,
        )
        result = parse_action_json(raw)
        if result is not None:
            return result
        print(f"[Action] Retry {attempt + 1}: valid JSON not found")
    raise HTTPException(status_code=502, detail="アクション選択に失敗しました。再度お試しください。")


# --- Prompts ---

STYLE_UPDATE_SYSTEM = """あなたはライティング支援AIのコンポーネントです。
ユーザーの発話を受けて、文章のスタイル設定を更新してください。

現在のスタイル設定:
{style_context}

更新対象フィールド:
- theme: テーマ・トピック
- purpose: 文章の目的
- audience: 想定読者
- image: イメージ（ブログ / 学術論文 / 報告書 / 小説 等）
- format: フォーマット（Plain / Markdown / LaTeX / HTML）
- style: スタイル（箇条書き多用 / パラグラフライティング / だ・である調 等、具体的な指定、複数可。文字列の配列として出力）
- length: 文章の量感
- notes: その他メモ

出力ルール:
- JSON形式で出力する
- 更新がある場合: "updated"をtrueにし、更新するフィールドのみ含める
- 更新がない場合: {{"updated": false}}
- 例: {{"updated": true, "theme": "AI技術の未来", "style": ["だ・である調", "箇条書き多用"]}}"""

CONTENT_UPDATE_SYSTEM = """あなたはライティング支援AIのコンポーネントです。
ユーザーの発話を受けて、書きたい内容のメモ（箇条書き）を更新してください。

現在のメモ:
{content_context}

更新ルール:
- ユーザーの言葉をなるべくそのまま引用する
- 現在のメモに新しい情報を統合し、論理的な順序に並べる

出力ルール:
- JSON形式で出力する
- 更新がある場合: {{"updated": true, "content": "更新後の箇条書き全体"}}
- 更新がない場合: {{"updated": false, "content": null}}"""

ACTION_SYSTEM = """あなたはライティング支援AIエージェントです。
ユーザーの発話に対して、適切なアクションを1つ選択してください。

現在の状況:
[スタイル設定]
{style_context}

[書きたい内容のメモ]
{content_context}

[現在の文章]
{editor_content}

選択できるアクション:
- question : 書きたい内容についてユーザーに質問する（アイデアを引き出す）
- clarify  : ユーザーの指示の意図が不明瞭なとき、確認のための質問をする
- edit_text: 文章を編集する

選択基準:
- ユーザーがアイデアや内容を話している → question（次に聞くべきことを質問する）
- 指示の意図が読み取れない → clarify
- 明確な編集・修正の指示がある → edit_text

出力ルール:
- JSON形式で出力する
- question/clarify: {{"action": "question", "message": "メッセージ本文"}}
- edit_text: {{"action": "edit_text", "plan": "何をどう編集するかの説明"}}"""

ACTION_SYSTEM_EMPTY_EDITOR = """あなたはライティング支援AIエージェントです。
ユーザーの発話に対して、適切なアクションを1つ選択してください。

現在の状況:
[スタイル設定]
{style_context}

[書きたい内容のメモ]
{content_context}

※ 現在、文章はまだ存在しません。ユーザーはこれから作成する内容を整理している段階です。

選択できるアクション:
- question : 書きたい内容についてユーザーに質問する（アイデアを引き出す）
- clarify  : ユーザーの指示の意図が不明瞭なとき、確認のための質問をする

選択基準:
- ユーザーがアイデアや内容を話している → question（次に聞くべきことを質問する）
- 指示の意図が読み取れない → clarify

出力ルール:
- JSON形式で出力する
- {{"action": "question", "message": "メッセージ本文"}}
- {{"action": "clarify", "message": "メッセージ本文"}}"""

GENERATE_SYSTEM = """あなたはライティング支援AIです。
スタイル設定と内容メモをもとに、文章を新規作成してください。

スタイル設定:
{style_context}

内容メモ:
{content_context}

出力ルール:
- 生成した文章のみを出力する
- 説明文などは一切付けない"""

EDIT_SYSTEM = """あなたはライティング支援AIです。
編集計画に従って与えられた文章を書き換えてください。

スタイル設定:
{style_context}

編集計画:
{edit_plan}

出力ルール:
- 編集後の文章全体のみを出力する
- 説明文などは一切付けない"""


# --- Endpoints ---

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    llm = get_llm_service(req.service_id)
    if not llm:
        raise HTTPException(status_code=400, detail="LLMサービスが設定されていません。")

    style_str = style_context_to_str(req.style_context)

    style_sys = STYLE_UPDATE_SYSTEM.format(style_context=style_str)
    content_sys = CONTENT_UPDATE_SYSTEM.format(
        content_context=req.content_context or "（まだありません）"
    )

    if req.editor_content.strip():
        action_sys = ACTION_SYSTEM.format(
            style_context=style_str,
            content_context=req.content_context or "（まだありません）",
            editor_content=req.editor_content,
        )
    else:
        action_sys = ACTION_SYSTEM_EMPTY_EDITOR.format(
            style_context=style_str,
            content_context=req.content_context or "（まだありません）",
        )

    history = req.conversation_history[-6:]

    # 並列実行: LLM①-a, ①-b, ② (リトライ付き)
    style_update, content_update, action = await asyncio.gather(
        _style_update_with_retry(llm, style_sys, req.message, history),
        _content_update_with_retry(llm, content_sys, req.message, history),
        _action_with_retry(llm, action_sys, req.message, history),
    )

    return ChatResponse(
        style_update=style_update,
        content_update=content_update,
        action=action,
    )


@router.post("/edit")
async def edit(req: EditRequest):
    style_str = style_context_to_str(req.style_context)
    system_prompt = EDIT_SYSTEM.format(
        style_context=style_str,
        edit_plan=req.edit_plan,
    )
    user_prompt = f"文章:\n{req.editor_content}"

    async def generate():
        llm = get_llm_service(req.service_id)
        if not llm:
            yield f"data: {json.dumps({'content': 'LLMサービスが設定されていません。'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        chunks: list[str] = []
        try:
            async for chunk in llm.generate_stream(system_prompt, user_prompt, label="edit"):
                chunks.append(chunk)

            if chunks:
                for chunk in chunks:
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                yield "data: [DONE]\n\n"
                return

        except Exception as e:
            print(f"[Edit] Error: {e}")
            yield f"data: {json.dumps({'error': '文章の編集中にエラーが発生しました。再度お試しください。'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        yield f"data: {json.dumps({'error': '文章の編集に失敗しました。再度お試しください。'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")


@router.post("/generate")
async def generate_initial(req: GenerateRequest):
    style_str = style_context_to_str(req.style_context)
    system_prompt = GENERATE_SYSTEM.format(
        style_context=style_str,
        content_context=req.content_context or "（未設定）",
    )
    user_prompt = "文章を生成してください。"

    async def stream():
        llm = get_llm_service(req.service_id)
        if not llm:
            yield f"data: {json.dumps({'content': 'LLMサービスが設定されていません。'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        chunks: list[str] = []
        try:
            async for chunk in llm.generate_stream(system_prompt, user_prompt, label="generate"):
                chunks.append(chunk)

            if chunks:
                for chunk in chunks:
                    yield f"data: {json.dumps({'content': chunk})}\n\n"
                yield "data: [DONE]\n\n"
                return

        except Exception as e:
            print(f"[Generate] Error: {e}")
            yield f"data: {json.dumps({'error': '文章の生成中にエラーが発生しました。再度お試しください。'})}\n\n"
            yield "data: [DONE]\n\n"
            return

        yield f"data: {json.dumps({'error': '文章の生成に失敗しました。再度お試しください。'})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
