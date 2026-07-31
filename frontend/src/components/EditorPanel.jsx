import React, { useRef, useEffect, useState, useCallback } from 'react'
import { Compartment, EditorState, ChangeSet } from '@codemirror/state'
import { EditorView, basicSetup } from 'codemirror'
import { unifiedMergeView, updateOriginalDoc, getOriginalDoc, getChunks } from '@codemirror/merge'
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
        margin: '0 2rem',
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
    const { content, draft, setDraft, confirmDraft, discardDraft } = useEditorStore()
    const { theme } = useSettingsStore()
    const { style: styleCtx } = useContextStore()
    const { isGenerating, handleGenerate } = useGenerate()
    const [hasDiff, setHasDiff] = useState(false)

    const containerRef = useRef(null)
    const viewRef = useRef(null)
    const themeCompartment = useRef(new Compartment())
    const langCompartment = useRef(new Compartment())

    const getThemeExt = (t) => t === 'dark' ? [oneDark, darkBgOverride] : []
    const getLangExt = (fmt) => fmt === 'Markdown' ? [markdown()] : []

    const checkDiff = useCallback((state) => {
        const result = getChunks(state)
        setHasDiff(result ? result.chunks.length > 0 : false)
    }, [])

    // エディタ初期化（マウント時のみ）
    useEffect(() => {
        if (!containerRef.current) return

        const { content: initial, draft: initialDraft } = useEditorStore.getState()
        const doc = initialDraft || initial || ''
        const original = initial || ''

        const state = EditorState.create({
            doc,
            extensions: [
                basicSetup,
                EditorView.lineWrapping,
                editorBaseTheme,
                themeCompartment.current.of(getThemeExt(theme)),
                langCompartment.current.of(getLangExt(styleCtx.format)),
                unifiedMergeView({ original, mergeControls: true, highlightChanges: true }),
                EditorView.updateListener.of(update => {
                    if (update.docChanged) {
                        setDraft(update.state.doc.toString())
                    }
                    if (update.docChanged || update.startState !== update.state) {
                        checkDiff(update.state)
                    }
                }),
            ],
        })

        const view = new EditorView({ state, parent: containerRef.current })
        viewRef.current = view
        checkDiff(state)

        // Accept ボタン押下後: CM が originalDoc を更新するので、それを content に反映
        // Reject ボタン押下後: CM が doc を更新するので、updateListener が setDraft を呼ぶ（追加処理不要）
        const handleChunkButton = (e) => {
            if (!e.target.closest('button[name="accept"]')) return
            const newOriginal = getOriginalDoc(view.state).toString()
            useEditorStore.getState().setContent(newOriginal)
        }
        containerRef.current.addEventListener('click', handleChunkButton)

        return () => {
            containerRef.current?.removeEventListener('click', handleChunkButton)
            view.destroy()
            viewRef.current = null
        }
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

    // store の draft が外部から更新された場合（LLM生成結果の反映）にエディタの doc を差し替え
    useEffect(() => {
        const view = viewRef.current
        if (!view) return
        const currentDoc = view.state.doc.toString()
        if (draft !== currentDoc) {
            view.dispatch({
                changes: { from: 0, to: view.state.doc.length, insert: draft },
            })
        }
    }, [draft]) // eslint-disable-line react-hooks/exhaustive-deps

    // store の content（確定済み）が外部から更新された場合に original を差し替え
    useEffect(() => {
        const view = viewRef.current
        if (!view) return
        const currentOriginal = getOriginalDoc(view.state)
        const currentOriginalStr = currentOriginal.toString()
        if (content !== currentOriginalStr) {
            const changes = ChangeSet.of(
                { from: 0, to: currentOriginal.length, insert: content },
                currentOriginal.length,
            )
            view.dispatch({
                effects: updateOriginalDoc.of({
                    doc: changes.apply(currentOriginal),
                    changes,
                }),
            })
        }
    }, [content]) // eslint-disable-line react-hooks/exhaustive-deps

    const handleConfirm = () => {
        confirmDraft()
    }

    const handleUndo = () => {
        discardDraft()
    }

    return (
        <div className="pane">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between min-h-[53px]">
                <h2 className="font-semibold text-sm text-foreground">エディタ</h2>
                {hasDiff && (
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
                {!draft && !hasDiff && (
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
