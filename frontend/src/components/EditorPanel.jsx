import React, { useRef, useEffect } from 'react'
import { Compartment, EditorState } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { unifiedMergeView } from '@codemirror/merge'
import { markdown } from '@codemirror/lang-markdown'
import { oneDark } from '@codemirror/theme-one-dark'
import { Check, Undo2, Loader2, Pencil } from 'lucide-react'
import useEditorStore from '../stores/editorStore'
import useSettingsStore from '../stores/settingsStore'
import useContextStore from '../stores/contextStore'
import { useGenerate } from '../hooks/useGenerate'

const editorBaseTheme = EditorView.theme({
    '&.cm-editor': { backgroundColor: 'transparent', height: '100%' },
    '&.cm-focused': { outline: 'none' },
    '.cm-scroller': {
        fontFamily: 'ui-sans-serif, system-ui, sans-serif',
        fontSize: '1rem',
        lineHeight: '1.75',
        overflow: 'auto',
    },
    '.cm-content': {
        padding: '2rem',
        maxWidth: '52rem',
        margin: '0 auto',
        caretColor: 'hsl(var(--foreground))',
    },
    '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'hsl(var(--foreground))' },
    '.cm-gutters': { display: 'none' },
    '.cm-activeLine': { backgroundColor: 'transparent' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground': {
        backgroundColor: 'hsl(var(--primary) / 0.2) !important',
    },
})

const darkBgOverride = EditorView.theme({
    '&.cm-editor': { backgroundColor: 'transparent' },
})

export default function EditorPanel() {
    const { isDiffMode, content, pendingEditedContent, setContent, exitDiffMode } = useEditorStore()
    const { theme } = useSettingsStore()
    const { style: styleCtx } = useContextStore()
    const { isGenerating, handleGenerate } = useGenerate()

    const containerRef = useRef(null)
    const viewRef = useRef(null)
    const themeCompartment = useRef(new Compartment())
    const langCompartment = useRef(new Compartment())

    const getThemeExt = (t) => t === 'dark' ? [oneDark, darkBgOverride] : []
    const getLangExt = (fmt) => fmt === 'Markdown' ? [markdown()] : []

    const buildState = (doc, inDiffMode, original) =>
        EditorState.create({
            doc,
            extensions: [
                basicSetup,
                EditorView.lineWrapping,
                editorBaseTheme,
                themeCompartment.current.of(getThemeExt(theme)),
                langCompartment.current.of(getLangExt(styleCtx.format)),
                EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        setContent(update.state.doc.toString())
                    }
                }),
                ...(inDiffMode
                    ? [unifiedMergeView({ original, mergeControls: true, highlightChanges: true })]
                    : []
                ),
            ],
        })

    const getDoc = () => viewRef.current?.state.doc.toString() ?? ''

    // エディタ初期化（マウント時のみ）
    useEffect(() => {
        if (!containerRef.current) return
        const view = new EditorView({
            state: buildState('', false, ''),
            parent: containerRef.current,
        })
        viewRef.current = view
        return () => { view.destroy(); viewRef.current = null }
    }, []) // eslint-disable-line react-hooks/exhaustive-deps

    // テーマの動的切り替え
    useEffect(() => {
        viewRef.current?.dispatch({
            effects: themeCompartment.current.reconfigure(getThemeExt(theme)),
        })
    }, [theme]) // eslint-disable-line react-hooks/exhaustive-deps

    // 言語の動的切り替え（フォーマット変更時）
    useEffect(() => {
        viewRef.current?.dispatch({
            effects: langCompartment.current.reconfigure(getLangExt(styleCtx.format)),
        })
    }, [styleCtx.format]) // eslint-disable-line react-hooks/exhaustive-deps

    // diff mode の入退出を検出してエディタ状態を再構築
    useEffect(() => {
        if (isDiffMode) {
            // 現在のドキュメントが「変更前」（diff の original）
            const oldContent = getDoc()
            // pendingEditedContent が「変更後」（diff の新しい doc）
            viewRef.current?.setState(
                buildState(pendingEditedContent, true, oldContent)
            )
        } else {
            // diff mode 終了: store の確定済みコンテンツで再構築
            const finalContent = useEditorStore.getState().content
            viewRef.current?.setState(buildState(finalContent, false, ''))
        }
    }, [isDiffMode]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleConfirm = () => {
        exitDiffMode(getDoc())
    }

    const handleUndo = () => {
        const { prevContent } = useEditorStore.getState()
        exitDiffMode(prevContent)
    }

return (
        <div className="pane">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between min-h-[53px]">
                <h2 className="font-semibold text-sm text-foreground">エディタ</h2>
                {isDiffMode && (
                    <div className="flex items-center gap-1.5">
                        <button
                            onClick={handleUndo}
                            className="flex items-center gap-1 p-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                            title="全て取り消し"
                        >
                            <Undo2 size={15} />
                        </button>
                        <button
                            onClick={handleConfirm}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 transition-opacity shadow-sm"
                            title="全て確定"
                        >
                            <Check size={13} />
                            全て確定
                        </button>
                    </div>
                )}
            </div>

            <div className="flex-1 overflow-hidden relative">
                <div ref={containerRef} className="h-full" />
                {!content && !isDiffMode && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-background/80 backdrop-blur-sm">
                        <p className="text-sm text-muted-foreground text-center max-w-[240px]">
                            対話が十分になったら、文章の生成を開始できます
                        </p>
                        <button
                            onClick={handleGenerate}
                            disabled={isGenerating}
                            className="flex items-center gap-2 px-5 py-2.5 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-60 transition-all shadow-sm"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 size={15} className="animate-spin" />
                                    生成中...
                                </>
                            ) : (
                                <>
                                    <Pencil size={15} />
                                    文章を生成する
                                </>
                            )}
                        </button>
                    </div>
                )}
            </div>
        </div>
    )
}
