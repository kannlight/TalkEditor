import asyncio
import re
import json
import xml.etree.ElementTree as ET
from fastapi import APIRouter
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


def parse_style_update(xml_text: str) -> Optional[StyleUpdate]:
    try:
        # Empty / self-closing → no update
        if re.search(r'<style_update\s*/>', xml_text):
            return None
        if re.search(r'<style_update\s*>\s*</style_update>', xml_text):
            return None

        match = re.search(r'(<style_update>.*?</style_update>)', xml_text, re.DOTALL)
        if not match:
            return None

        root = ET.fromstring(match.group(1))

        field_map = {
            "テーマ・トピック": "theme",
            "文章の目的": "purpose",
            "想定読者": "audience",
            "イメージ": "image",
            "フォーマット": "format",
            "スタイル": "style",
            "文章の量感": "length",
            "その他メモ": "notes",
        }

        patch: dict = {}
        for field_elem in root.findall('field'):
            name = field_elem.get('name', '')
            value = (field_elem.text or '').strip()
            key = field_map.get(name)
            if key and value:
                if key == 'style':
                    patch[key] = [s.strip() for s in value.split(',') if s.strip()]
                else:
                    patch[key] = value

        return StyleUpdate(**patch) if patch else None
    except Exception:
        return None


def parse_content_update(xml_text: str) -> Optional[str]:
    try:
        if re.search(r'<content_update\s*/>', xml_text):
            return None
        if re.search(r'<content_update\s*>\s*</content_update>', xml_text):
            return None

        match = re.search(r'<content_update>(.*?)</content_update>', xml_text, re.DOTALL)
        if not match:
            return None

        content = match.group(1).strip()
        return content if content else None
    except Exception:
        return None


def parse_action(xml_text: str) -> ActionResult:
    try:
        match = re.search(r'(<action\s[^>]*>.*?</action>)', xml_text, re.DOTALL)
        if not match:
            return ActionResult(type="question", message="もう少し詳しく教えていただけますか？")

        root = ET.fromstring(match.group(1))
        action_type = root.get('type', 'question')

        if action_type == 'edit_text':
            plan_elem = root.find('plan')
            plan = (plan_elem.text or '').strip() if plan_elem is not None else ''
            return ActionResult(type='edit_text', plan=plan)
        else:
            msg_elem = root.find('message')
            message = (msg_elem.text or '').strip() if msg_elem is not None else ''
            return ActionResult(type=action_type, message=message)
    except Exception:
        return ActionResult(type="question", message="もう少し詳しく教えていただけますか？")


# --- Prompts ---

STYLE_UPDATE_SYSTEM = """あなたはライティング支援AIのコンポーネントです。
ユーザーの発話を受けて、文章のスタイル設定を更新してください。

現在のスタイル設定:
{style_context}

更新対象フィールド（<field name="..."> の name に使う文字列を以下から選ぶこと）:
- テーマ・トピック
- 文章の目的
- 想定読者
- イメージ（ブログ / 学術論文 / 報告書 / 小説 等）
- フォーマット（Plain / Markdown / LaTeX / HTML）
- スタイル（箇条書き多用 / パラグラフライティング / だ・である調 等、具体的な指定、複数可）
- 文章の量感
- その他メモ

出力ルール:
- 更新が必要なフィールドのみ <style_update> 内に <field name="...">値</field> の形式で出力する
- 更新が不要な場合は <style_update/> のみ出力する
- タグ以外の文字は出力しない"""

CONTENT_UPDATE_SYSTEM = """あなたはライティング支援AIのコンポーネントです。
ユーザーの発話を受けて、書きたい内容のメモ（箇条書き）を更新してください。

現在のメモ:
{content_context}

更新ルール:
- ユーザーの言葉をなるべくそのまま引用する
- 現在のメモに新しい情報を統合し、論理的な順序に並べる
- 発話に書きたい内容に関する情報がなければ <content_update/> のみ出力する

出力ルール:
- 更新後の箇条書き全体を <content_update> 内に出力する（全体置き換え）
- タグ以外の文字は出力しない"""

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
- edit_text: 文章を編集する（文章が存在する場合のみ選択可能）

選択基準:
- ユーザーがアイデアや内容を話している → question（次に聞くべきことを質問する）
- 指示の意図が読み取れない → clarify
- 明確な編集・修正・生成の指示がある → edit_text

出力ルール:
- question/clarify は <action type="..."><message>メッセージ本文</message></action>
- edit_text は <action type="edit_text"><plan>何をどう編集するかの説明</plan></action>
- タグ以外の文字は出力しない"""

EDIT_SYSTEM = """あなたはライティング支援AIです。
編集計画に従って文章の該当箇所を書き換えてください。

スタイル設定:
{style_context}

編集計画:
{edit_plan}

出力ルール:
- 編集した箇所を <target> タグで囲み、文章全体を出力する
- <target> タグ付きの文章全体のみを出力する（説明文は不要）
- <target> タグは必ず1つだけ使用する"""


# --- Endpoints ---

@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    llm = get_llm_service(req.service_id)
    if not llm:
        return ChatResponse(
            action=ActionResult(type="question", message="LLMサービスが設定されていません。")
        )

    style_str = style_context_to_str(req.style_context)

    style_sys = STYLE_UPDATE_SYSTEM.format(style_context=style_str)
    content_sys = CONTENT_UPDATE_SYSTEM.format(
        content_context=req.content_context or "（まだありません）"
    )
    action_sys = ACTION_SYSTEM.format(
        style_context=style_str,
        content_context=req.content_context or "（まだありません）",
        editor_content=req.editor_content or "（まだありません）",
    )

    history = req.conversation_history[-6:]

    # 並列実行: LLM①-a, ①-b, ②
    results = await asyncio.gather(
        llm.generate_sync(style_sys, req.message, label="style_update"),
        llm.generate_sync(content_sys, req.message, label="content_update"),
        llm.generate_sync(action_sys, req.message, label="action", history=history),
        return_exceptions=True,
    )

    style_raw, content_raw, action_raw = results

    style_update = None
    if not isinstance(style_raw, Exception):
        style_update = parse_style_update(style_raw)

    content_update = None
    if not isinstance(content_raw, Exception):
        content_update = parse_content_update(content_raw)

    if isinstance(action_raw, Exception):
        action = ActionResult(type="question", message="もう少し詳しく教えていただけますか？")
    else:
        action = parse_action(action_raw)

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

        max_retries = 3
        last_chunks: list[str] = []

        for attempt in range(max_retries):
            chunks: list[str] = []
            try:
                async for chunk in llm.generate_stream(system_prompt, user_prompt, label=f"edit_attempt_{attempt + 1}"):
                    chunks.append(chunk)

                full_content = "".join(chunks)
                if "<target>" in full_content and "</target>" in full_content:
                    for chunk in chunks:
                        yield f"data: {json.dumps({'content': chunk})}\n\n"
                    yield "data: [DONE]\n\n"
                    return

                last_chunks = chunks
                print(f"[Edit] Retry {attempt + 1}: <target> tag not found")

            except Exception as e:
                print(f"[Edit] Error on attempt {attempt + 1}: {e}")
                last_chunks = chunks

        # 全リトライ失敗時: 最後の結果をそのまま返す
        for chunk in last_chunks:
            yield f"data: {json.dumps({'content': chunk})}\n\n"
        yield "data: [DONE]\n\n"

    return StreamingResponse(generate(), media_type="text/event-stream")
