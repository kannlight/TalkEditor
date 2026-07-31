import React from 'react'
import { Plus, FileText, Trash2, Moon, Sun } from 'lucide-react'
import useIndexStore from '../stores/indexStore'
import useSettingsStore from '../stores/settingsStore'

function formatDate(ts) {
    const diff = Date.now() - ts
    const m = Math.floor(diff / 60000)
    if (m < 1) return 'たった今'
    if (m < 60) return `${m}分前`
    const h = Math.floor(m / 60)
    if (h < 24) return `${h}時間前`
    const d = Math.floor(h / 24)
    if (d < 7) return `${d}日前`
    return new Date(ts).toLocaleDateString('ja-JP', { month: 'long', day: 'numeric' })
}

export default function DocumentListScreen() {
    const { entries, addEntry, deleteEntry } = useIndexStore()
    const { theme, toggleTheme } = useSettingsStore()

    const handleCreate = () => {
        const id = crypto.randomUUID()
        addEntry({ id, title: '無題', preview: '', createdAt: Date.now(), updatedAt: Date.now() })
        window.location.href = `/${id}`
    }

    const handleOpen = (id) => {
        window.location.href = `/${id}`
    }

    const handleDelete = (e, id) => {
        e.stopPropagation()
        if (!window.confirm('この文章を削除しますか？')) return
        deleteEntry(id)
        localStorage.removeItem(`talkeditor-chat-${id}`)
        localStorage.removeItem(`talkeditor-context-${id}`)
        localStorage.removeItem(`talkeditor-editor-${id}`)
    }

    return (
        <div className="min-h-screen bg-secondary/30 text-foreground flex flex-col">
            <header className="flex items-center justify-between px-8 py-4 bg-background border-b border-border shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold shadow-sm text-sm">
                        T
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">TalkEditor</h1>
                </div>
                <button
                    onClick={toggleTheme}
                    className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                    title={theme === 'light' ? 'ダークモードへ' : 'ライトモードへ'}
                >
                    {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                </button>
            </header>

            <main className="flex-1 max-w-3xl w-full mx-auto px-8 py-10">
                {entries.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-32 text-center">
                        <div className="w-16 h-16 rounded-2xl bg-accent flex items-center justify-center mb-6">
                            <FileText size={28} className="text-muted-foreground" />
                        </div>
                        <h2 className="text-lg font-semibold mb-2">文章を作成しましょう</h2>
                        <p className="text-sm text-muted-foreground mb-8 max-w-xs">
                            AIと対話しながら文章を作成・編集できます。<br />
                            まずは新しい文章を作ってみましょう。
                        </p>
                        <button
                            onClick={handleCreate}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                        >
                            <Plus size={16} />
                            新しい文章を作成
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-lg font-semibold">文章一覧</h2>
                            <button
                                onClick={handleCreate}
                                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition-opacity shadow-sm"
                            >
                                <Plus size={14} />
                                新規作成
                            </button>
                        </div>
                        <div className="space-y-2">
                            {entries.map(entry => (
                                <div
                                    key={entry.id}
                                    onClick={() => handleOpen(entry.id)}
                                    className="group flex items-center gap-4 p-4 rounded-xl bg-background border border-border hover:border-primary/40 hover:shadow-sm cursor-pointer transition-all"
                                >
                                    <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center shrink-0">
                                        <FileText size={16} className="text-muted-foreground" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="font-medium text-sm truncate">{entry.title}</p>
                                        {entry.preview && (
                                            <p className="text-xs text-muted-foreground mt-0.5 truncate">{entry.preview}</p>
                                        )}
                                    </div>
                                    <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                                        {formatDate(entry.updatedAt)}
                                    </span>
                                    <button
                                        onClick={(e) => handleDelete(e, entry.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 text-muted-foreground hover:text-destructive rounded-md transition-all shrink-0"
                                        title="削除"
                                    >
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </>
                )}
            </main>
        </div>
    )
}
