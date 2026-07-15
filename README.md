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

1. 右上のセレクタでLLMサービスを選択する
2. 左のチャット欄に書きたい内容や要望を入力する
3. AIが自動でコンテキスト（スタイル設定・コンテンツメモ）を更新しながら対話する
4. 「文章を編集します」という提案が出たら **承認する** をクリックする
5. エディタに差分が表示される。チャンク単位で承認/却下できる
6. **全て確定** または **全て取り消し** でdiff modeを終了する

右パネルはコンテキストが更新されると「コンテキスト」タブに、編集が始まると「エディタ」タブに自動で切り替わる。タブボタンで手動切り替えも可能。

---

## アーキテクチャ

### 1ターンの処理フロー

```
ユーザー発話
    ↓（並列）
  ┌─ LLM①-a: スタイル用コンテキスト更新
  ├─ LLM①-b: コンテンツ用コンテキスト更新
  └─ LLM②:   アクション選択 (question / clarify / edit_text)
    ↓
  question / clarify → チャットに返答を表示
  edit_text          → 承認/却下ボタンを表示
    ↓（承認時）
  LLM③: 文章編集（SSEストリーミング）
    ↓
  差分表示（@codemirror/merge の unifiedMergeView）
```

### ディレクトリ構成

```
TalkEditor/
├── backend/
│   ├── main.py
│   ├── routes/
│   │   ├── chat.py          # POST /api/chat, POST /api/edit
│   │   └── settings.py      # GET /api/settings/services
│   ├── services/
│   │   ├── llm_service.py   # GeminiAdapter / OllamaAdapter
│   │   └── deps.py          # ServiceRegistry
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.jsx
│       ├── components/
│       │   ├── ChatPanel.jsx
│       │   ├── ContextPanel.jsx
│       │   ├── EditorPanel.jsx
│       │   └── RightPanel.jsx
│       ├── stores/
│       │   ├── chatStore.js
│       │   ├── contextStore.js
│       │   ├── editorStore.js
│       │   └── settingsStore.js
│       └── api/
│           ├── chat.js
│           └── edit.js
├── .env.example
└── SPEC.md
```

### API エンドポイント

| メソッド | パス | 説明 |
|---|---|---|
| POST | /api/chat | LLM①②を並列実行してJSONで返す |
| POST | /api/edit | LLM③をSSEストリームで返す |
| GET | /api/settings/services | 利用可能なLLMサービス一覧 |
