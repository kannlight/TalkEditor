import React, { useState, useEffect, useRef } from 'react'
import { LayoutList, FileText, RotateCcw } from 'lucide-react'
import ContextPanel from './ContextPanel'
import EditorPanel from './EditorPanel'
import useContextStore from '../stores/contextStore'
import useEditorStore from '../stores/editorStore'

export default function RightPanel() {
    const [activePanel, setActivePanel] = useState('context')
    const draft = useEditorStore(s => s.draft)
    const content = useEditorStore(s => s.content)
    const isGenerating = useEditorStore(s => s.isGenerating)
    const hasDiff = draft !== content
    const contextUpdatedAt = useContextStore(s => s.updatedAt)
    const resetContext = useContextStore(s => s.resetContext)
    const contextStyle = useContextStore(s => s.style)
    const contextContent = useContextStore(s => s.content)
    const hasMountedRef = useRef(false)

    const hasContextData = contextContent || Object.values(contextStyle).some(v =>
        Array.isArray(v) ? v.length > 0 : (v && v !== 'Plain')
    )

    // 差分が発生したらエディタへ切り替え（マウント時は除く）
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true
            return
        }
        if (hasDiff) setActivePanel('editor')
    }, [hasDiff])

    // 生成開始時もエディタタブへ切り替え
    useEffect(() => {
        if (isGenerating) setActivePanel('editor')
    }, [isGenerating])

    // コンテキストが更新されたらコンテキストパネルへ切り替え
    useEffect(() => {
        if (contextUpdatedAt > 0) setActivePanel('context')
    }, [contextUpdatedAt])

    return (
        <div className="flex flex-col h-full">
            {/* タブ切り替え */}
            <div className="flex items-center gap-1 px-4 py-2 border-b border-border bg-background/95 shrink-0">
                <button
                    onClick={() => setActivePanel('context')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activePanel === 'context'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                    <LayoutList size={13} />
                    コンテキスト
                </button>
                <button
                    onClick={() => setActivePanel('editor')}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                        activePanel === 'editor'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                    }`}
                >
                    <FileText size={13} />
                    エディタ
                </button>
                {activePanel === 'context' && hasContextData && (
                    <button
                        onClick={resetContext}
                        className="ml-auto flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-1 rounded-md transition-colors"
                        title="コンテキストをリセット"
                    >
                        <RotateCcw size={12} />
                        リセット
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden">
                {activePanel === 'context' ? <ContextPanel /> : <EditorPanel />}
            </div>
        </div>
    )
}
