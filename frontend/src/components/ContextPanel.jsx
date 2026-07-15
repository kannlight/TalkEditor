import React from 'react'
import useContextStore from '../stores/contextStore'

const TEXT_FIELDS = [
    { key: 'theme', label: 'テーマ・トピック' },
    { key: 'purpose', label: '文章の目的' },
    { key: 'audience', label: '想定読者' },
    { key: 'image', label: 'イメージ（ブログ / 論文 / 報告書 等）' },
    { key: 'length', label: '文章の量感' },
]

const FORMAT_OPTIONS = ['Plain', 'Markdown', 'LaTeX', 'HTML']

export default function ContextPanel() {
    const { style, content, updateStyle, updateContent } = useContextStore()

    return (
        <div className="h-full overflow-y-auto p-4 custom-scrollbar space-y-6">
            {/* スタイル設定 */}
            <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    スタイル設定
                </h3>
                <div className="space-y-3">
                    {TEXT_FIELDS.map(({ key, label }) => (
                        <div key={key}>
                            <label className="block text-xs font-medium text-muted-foreground mb-1">
                                {label}
                            </label>
                            <input
                                type="text"
                                value={style[key]}
                                onChange={e => updateStyle({ [key]: e.target.value })}
                                className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
                            />
                        </div>
                    ))}

                    <div>
                        <label className="block text-xs font-medium text-muted-foreground mb-1">
                            フォーマット
                        </label>
                        <select
                            value={style.format}
                            onChange={e => updateStyle({ format: e.target.value })}
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
                            value={style.style.join('\n')}
                            onChange={e => {
                                const items = e.target.value.split('\n').map(s => s.trim()).filter(Boolean)
                                updateStyle({ style: items })
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
                            value={style.notes}
                            onChange={e => updateStyle({ notes: e.target.value })}
                            rows={3}
                            className="w-full text-sm bg-background border border-input rounded-md px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                        />
                    </div>
                </div>
            </section>

            {/* コンテンツメモ */}
            <section>
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                    コンテンツメモ
                </h3>
                <textarea
                    value={content}
                    onChange={e => updateContent(e.target.value)}
                    rows={12}
                    placeholder={'書きたい内容の箇条書き...\n- ポイント1\n- ポイント2'}
                    className="w-full text-sm bg-background border border-input rounded-md px-3 py-2 focus:outline-none focus:ring-1 focus:ring-ring resize-none"
                />
            </section>
        </div>
    )
}
