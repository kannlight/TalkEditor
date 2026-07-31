import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'

// 旧バージョンのlocalStorageキーを削除
;['talkeditor-chat', 'talkeditor-context', 'talkeditor-editor', 'talkeditor-documents'].forEach(key => {
    localStorage.removeItem(key)
})

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>,
)
