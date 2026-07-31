import React, { useEffect } from 'react'
import { Moon, Sun, FilePlus } from 'lucide-react'
import ChatPanel from './components/ChatPanel'
import RightPanel from './components/RightPanel'
import useSettingsStore from './stores/settingsStore'
import useChatStore from './stores/chatStore'
import useContextStore from './stores/contextStore'
import useEditorStore from './stores/editorStore'

function App() {
    const {
        availableServices, activeServiceId,
        setAvailableServices, setActiveServiceId,
        theme, toggleTheme, initTheme,
    } = useSettingsStore()
    const resetMessages = useChatStore(s => s.resetMessages)
    const resetContext = useContextStore(s => s.resetContext)
    const resetEditor = useEditorStore(s => s.resetEditor)

    const handleNewDocument = () => {
        if (!window.confirm('すべてリセットして新しい文章を書きますか？')) return
        resetMessages()
        resetContext()
        resetEditor()
    }

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

    return (
        <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">
            <header className="flex items-center justify-between px-6 py-3 border-b border-border bg-background/95 backdrop-blur shrink-0 z-20">
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-primary-foreground font-bold shadow-sm text-sm">
                        T
                    </div>
                    <h1 className="text-lg font-bold tracking-tight">TalkEditor</h1>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleNewDocument}
                        className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-md border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
                        title="新しい文章を書く（全リセット）"
                    >
                        <FilePlus size={13} />
                        新しい文章を書く
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
                <div className="w-2/5 shrink-0 flex flex-col min-w-[320px] max-w-[480px]">
                    <ChatPanel />
                </div>
                <div className="flex-1 flex flex-col min-w-[400px]">
                    <RightPanel />
                </div>
            </main>
        </div>
    )
}

export default App
