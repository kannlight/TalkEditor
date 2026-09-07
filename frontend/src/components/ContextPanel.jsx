import React from 'react'
import { Loader2, Pencil } from 'lucide-react'
import useContextStore from '../stores/contextStore'
import useEditorStore from '../stores/editorStore'
import { useGenerate } from '../hooks/useGenerate'

const TEXT_FIELDS = [
    { key: 'theme', label: 'テーマ・トピック' },
    { key: 'purpose', label: '文章の目的' },
    { key: 'audience', label: '想定読者' },
    { key: 'image', label: 'イメージ（ブログ / 論文 / 報告書 等）' },
    { key: 'length', label: '文章の量感' },
]

const FORMAT_OPTIONS = ['Plain', 'Markdown', 'LaTeX', 'HTML']

export default function ContextPanel() {
    const { context, isUpdating, update } = useContextStore()
    const { content: editorContent, draft: editorDraft } = useEditorStore()
    const { isGenerating, handleGenerate, additionalInstruction, setAdditionalInstruction } = useGenerate()

    return (
        <div className="relative h-full overflow-y-auto p-4 custom-scrollbar space-y-6">
            {isUpdating && (
                <div className="absolute inset-0 z-10 bg-background/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
                    <Loader2 size={20} className="animate-spin text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">コンテキスト更新中...</span>
                </div>
            )}

            <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    コンテキスト
                </h3>
                <div className="space-y-3">
                    {TEXT_FIELDS.map(({ key, label }) => (
                        <div key={key}>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                {label}
                            </label>
                            <input
                                type="text"
                                value={context[key]}
                                onChange={e => update({ [key]: e.target.value })}
                                className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>
                    ))}

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            フォーマット
                        </label>
                        <select
                            value={context.format}
                            onChange={e => update({ format: e.target.value })}
                            className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                        >
                            {FORMAT_OPTIONS.map(f => <option key={f}>{f}</option>)}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            スタイル（1行1つ）
                        </label>
                        <textarea
                            value={(context.style || []).join('\n')}
                            onChange={e => {
                                const items = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                                update({ style: items })
                            }}
                            rows={3}
                            placeholder={'だ・である調\n箇条書き多用'}
                            className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            その他メモ
                        </label>
                        <textarea
                            value={context.notes}
                            onChange={e => update({ notes: e.target.value })}
                            rows={3}
                            className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            書きたい内容のメモ
                        </label>
                        <textarea
                            value={context.content}
                            onChange={e => update({ content: e.target.value })}
                            rows={12}
                            placeholder={'書きたい内容'}
                            className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                    </div>
                </div>
            </section>

            {!editorContent && !editorDraft && (
                <div className="relative">
                    <textarea
                        value={additionalInstruction}
                        onChange={e => setAdditionalInstruction(e.target.value)}
                        disabled={isGenerating}
                        rows={1}
                        placeholder="追加指示（任意）"
                        className="w-full text-sm bg-background border border-input rounded-lg pl-3 pr-[42%] py-2.5 focus:outline-none focus:ring-1 focus:ring-ring resize-none disabled:opacity-50"
                    />
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className="absolute top-1 bottom-1 right-1.5 w-[40%] flex items-center justify-center gap-1.5 px-3 bg-primary text-primary-foreground text-sm font-medium rounded-md hover:opacity-90 disabled:opacity-60 transition-all"
                    >
                        {isGenerating ? (
                            <>
                                <Loader2 size={13} className="animate-spin" />
                                生成中...
                            </>
                        ) : (
                            <>
                                <Pencil size={13} />
                                文章を生成する
                            </>
                        )}
                    </button>
                </div>
            )}
        </div>
    )
}
