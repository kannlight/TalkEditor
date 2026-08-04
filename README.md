# TalkEditor

AIエージェントとテキスト対話しながら文章を作成するアプリケーション。

## セットアップ

### 1. 環境変数

```bash
cp .env.example .env
```

`.env` を編集してLLMサービスを設定する。

**Gemini を使う場合:**
```env
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
```

**Ollama を使う場合:**
```env
OLLAMA_SERVICES=Ollama Local|http://localhost:11434|qwen3:8b
```

複数のOllamaサービスはカンマ区切りで指定できる。

### 2. バックエンド

```bash
cd backend
python -m venv .venv
source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

`http://localhost:8000` で起動する。

### 3. フロントエンド

```bash
cd frontend
npm install
npm run dev
```

`http://localhost:3000` をブラウザで開く。

---

## 使い方

1. トップ画面（文章一覧）で **新規作成** をクリックして文章を作成する
2. 右上のセレクタでLLMサービスを選択する
3. 左のチャット欄に書きたい内容や要望を入力する
4. AIが自動でコンテキスト（スタイル設定・コンテンツメモ）を更新しながら対話する
5. コンテンツメモが蓄積されたら **文章を生成** ボタンで初稿を作成できる
6. 「文章を編集します」という提案が出たら **承認する** をクリックする
7. エディタに編集後の文章が反映される。**元に戻す** で変更前に戻せる

ヘッダーの **文章一覧** ボタンで一覧に戻ると、タイトル・プレビューが自動保存される。

右パネルはコンテキストが更新されると「コンテキスト」タブに、エディタに文章があると「エディタ」タブに自動で切り替わる。タブボタンで手動切り替えも可能。

---

## アーキテクチャ

### 1ターンの処理フロー

```
ユーザー発話
    ↓ POST /api/chat (SSE)
  LLM②: アクション選択 (question / clarify / edit_text)
    ↓
  question / clarify → LLM③: メッセージ生成（SSEトークンストリーミング）
  edit_text          → 承認/却下ボタンを表示
    ↓（後続、逐次実行）
  LLM①-b: コンテンツ用コンテキスト更新
  LLM①-a: スタイル用コンテキスト更新
    ↓
  meta イベントで更新結果を一括送信

edit_text 承認時:
  POST /api/edit → LLM: 文章編集（JSON同期レスポンス）

初稿生成時:
  POST /api/generate → LLM: 文章生成（JSON同期レスポンス）
```

### データ永続化

各文章は `localStorage` に独立して保存される。

| キー | 内容 |
|---|---|
| `talkeditor-index` | 文章一覧（ID・タイトル・プレビュー・日時） |
| `talkeditor-chat-{id}` | 対話履歴 |
| `talkeditor-context-{id}` | スタイル設定・コンテンツメモ |
| `talkeditor-editor-{id}` | エディタ本文 |

### LLMログ

バックエンド起動時に `backend/logs/` が自動生成され、全LLM呼び出しが日付ごとのJSONLファイルに記録される。

```
backend/logs/
└── llm_YYYYMMDD.jsonl   # 1行 = 1回のLLM呼び出し
```

各レコードのフィールド：

| フィールド | 内容 |
|---|---|
| `timestamp` | 呼び出し日時（UTC） |
| `label` | 呼び出し元の識別子（例: `action_type_attempt_1`） |
| `service_id` / `model` | 使用したサービスとモデル名 |
| `duration_ms` | 応答時間（ミリ秒） |
| `success` / `error` | 成否とエラーメッセージ |
| `thinking_level` / `thinking` | Thinkingモデルの思考レベルと思考テキスト |
| `system_prompt` / `user_prompt` / `response` | プロンプトと応答 |
| `history` | 送信した対話履歴 |

`logs/` は `.gitignore` に含まれる。

### ディレクトリ構成

```
TalkEditor/
├── backend/
│   ├── main.py
│   ├── routes/
│   │   ├── chat.py          # POST /api/chat, POST /api/edit, POST /api/generate
│   │   └── settings.py      # GET /api/settings/services
│   ├── services/
│   │   ├── llm_service.py   # GeminiAdapter / OllamaAdapter
│   │   └── deps.py          # ServiceRegistry
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── DocumentListScreen.jsx
│       │   ├── ChatPanel.jsx
│       │   ├── ContextPanel.jsx
│       │   ├── EditorPanel.jsx
│       │   └── RightPanel.jsx
│       ├── stores/
│       │   ├── indexStore.js
│       │   ├── docId.js
│       │   ├── chatStore.js
│       │   ├── contextStore.js
│       │   ├── editorStore.js
│       │   └── settingsStore.js
│       ├── hooks/
│       │   └── useGenerate.js
│       ├── api/
│       │   ├── chat.js
│       │   └── edit.js
│       └── utils/
│           ├── sse.js
│           └── cn.js
├── .env.example
└── SPEC.md
```

### API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/chat | アクション選択・メッセージ生成・コンテキスト更新をSSEで返す |
| POST | /api/edit | 編集計画に従って文章を書き換えてJSONで返す |
| POST | /api/generate | スタイル設定・コンテンツメモから文章を新規生成してJSONで返す |
| GET | /api/settings/services | 利用可能なLLMサービス一覧 |

### /api/chat SSEイベント仕様

```
data: {"type": "action", "action": "question"|"clarify"|"edit_text", "plan": "..."}
data: {"type": "token", "content": "..."}   # question/clarify のみ
data: {"type": "message_done"}
data: {"type": "meta", "style_update": {...}|null, "content_update": "..."|null}
data: [DONE]
```
