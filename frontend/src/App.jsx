import React, { useEffect } from 'react'
import { Moon, Sun, LayoutGrid } from 'lucide-react'
import ChatPanel from './components/ChatPanel'
import RightPanel from './components/RightPanel'
import DocumentListScreen from './components/DocumentListScreen'
import useSettingsStore from './stores/settingsStore'
import useIndexStore from './stores/indexStore'
import useChatStore from './stores/chatStore'
import useContextStore from './stores/contextStore'
import useEditorStore from './stores/editorStore'
import { docId } from './stores/docId'

function getDocTitle(style, messages) {
    if (style.theme) return style.theme
    const first = messages.find(m => m.role === 'user')
    if (first) {
        const t = first.content
        return t.length > 50 ? t.slice(0, 50) + '…' : t
    }
    return '無題'
}

function App() {
    const {
        availableServices, activeServiceId,
        setAvailableServices, setActiveServiceId,
        theme, toggleTheme, initTheme,
    } = useSettingsStore()
    const updateEntry = useIndexStore(s => s.updateEntry)

    useEffect(() => { initTheme() }, []) // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        fetch('/api/settings/services')
            .then(res => res.json())
            .then(services => {
                setAvailableServices(services)
                if (services.length === 0) return
                const isValid = services.some(s => s.id === activeServiceId)
                if (!isValid) setActiveServiceId(services[0].id)
            })
            .catch(err => console.error('Failed to fetch LLM services:', err))
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    const handleReturnToList = () => {
        const { style } = useContextStore.getState()
        const { messages } = useChatStore.getState()
        const { content: editorContent } = useEditorStore.getState()
        const { content: contextContent } = useContextStore.getState()

        const title = getDocTitle(style, messages)
        const src = editorContent || contextContent || ''
        const preview = src.replace(/\n+/g, ' ').trim().slice(0, 100)

        updateEntry(docId, { title, preview, updatedAt: Date.now() })
        window.location.href = '/'
    }

    if (!docId) {
        return <DocumentListScreen />
    }

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-background/95 backdrop-blur shrink-0 z-20">
                <button
                    onClick={handleReturnToList}
                    className="flex items-center gap-3 hover:opacity-75 transition-opacity"
                    title="文章一覧に戻る"
                >
                    <img src="/app-icon.png" alt="TalkEditor" className="w-12 h-12 rounded-lg shadow-sm object-cover" />
                    <h1 className="text-lg font-bold tracking-tight">TalkEditor</h1>
                </button>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleReturnToList}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                    >
                        <LayoutGrid size={13} />
                        文章一覧
                    </button>
                    {availableServices.length > 0 && (
                        <select
                            value={activeServiceId ?? ''}
                            onChange={e => setActiveServiceId(e.target.value)}
                            className="text-xs px-2 py-1.5 rounded-md border border-border bg-background text-foreground hover:bg-accent focus:outline-none focus:ring-1 focus:ring-ring cursor-pointer"
                            title="使用するLLMサービスを選択"
                        >
                            {availableServices.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.name} ({s.model})
                                </option>
                            ))}
                        </select>
                    )}
                    <button
                        onClick={toggleTheme}
                        className="p-2 text-muted-foreground hover:text-foreground hover:bg-accent rounded-md transition-colors"
                        title={theme === 'light' ? 'ダークモードへ' : 'ライトモードへ'}
                    >
                        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                    </button>
                </div>
            </header>

            <main className="flex-1 flex overflow-hidden divide-x divide-border">
                <div className="w-1/2 flex flex-col">
                    <ChatPanel />
                </div>
                <div className="w-1/2 flex flex-col">
                    <RightPanel />
                </div>
            </main>
        </div>
    )
}

export default App
