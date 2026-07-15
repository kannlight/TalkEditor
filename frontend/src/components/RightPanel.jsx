import React, { useState, useEffect, useRef } from 'react'
import { LayoutList, FileText } from 'lucide-react'
import ContextPanel from './ContextPanel'
import EditorPanel from './EditorPanel'
import useContextStore from '../stores/contextStore'
import useEditorStore from '../stores/editorStore'

export default function RightPanel() {
    const [activePanel, setActivePanel] = useState('context')
    const isDiffMode = useEditorStore(s => s.isDiffMode)
    const contextUpdatedAt = useContextStore(s => s.updatedAt)
    const hasMountedRef = useRef(false)

    // diff modeに入ったらエディタへ切り替え（マウント時は除く）
    useEffect(() => {
        if (!hasMountedRef.current) {
            hasMountedRef.current = true
            return
        }
        if (isDiffMode) setActivePanel('editor')
    }, [isDiffMode])

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
            </div>

            <div className="flex-1 overflow-hidden">
                {activePanel === 'context' ? <ContextPanel /> : <EditorPanel />}
            </div>
        </div>
    )
}
