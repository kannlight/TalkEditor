import React, { useState, useRef, useEffect } from 'react'
import { Send, Loader2, Check, X, RotateCcw, Pencil } from 'lucide-react'
import useChatStore from '../stores/chatStore'
import useContextStore from '../stores/contextStore'
import useEditorStore from '../stores/editorStore'
import useSettingsStore from '../stores/settingsStore'
import { postChat } from '../api/chat'
import { postEdit } from '../api/edit'

function MessageBubble({ message, isLastUser, onEdit }) {
    const [isEditing, setIsEditing] = useState(false)
    const { setActionStatus } = useChatStore()
    const contextStore = useContextStore()
    const { content: editorContent, setDraft } = useEditorStore()
    const { activeServiceId } = useSettingsStore()

    const handleApprove = async () => {
        setIsEditing(true)
        let fullContent = ''

        await postEdit(
            {
                style_context: contextStore.style,
                edit_plan: message.action.plan,
                editor_content: editorContent,
                service_id: activeServiceId,
            },
            (data) => {
                fullContent += data.content
            },
            () => {
                setDraft(fullContent)
                setActionStatus(message.id, 'approved')
                setIsEditing(false)
            },
            (err) => {
                console.error('Edit failed:', err)
                setActionStatus(message.id, 'error')
                setIsEditing(false)
            },
        )
    }

    const handleReject = () => {
        setActionStatus(message.id, 'rejected')
    }

    if (message.role === 'user') {
        return (
            <div className="flex justify-end mb-4">
                {isLastUser && (
                    <button
                        onClick={onEdit}
                        className="self-center mr-1.5 p-1 text-muted-foreground hover:text-foreground hover:bg-accent rounded transition-colors"
                        title="メッセージを編集"
                    >
                        <Pencil size={12} />
                    </button>
                )}
                <div className="max-w-[80%] bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
                    {message.content}
                </div>
            </div>
        )
    }

    // アシスタントメッセージ
    return (
        <div className="flex justify-start mb-4">
            <div className={`max-w-[88%] rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm ${message.isError ? 'bg-destructive/10 text-destructive' : 'bg-muted text-foreground'}`}>
                <p className="whitespace-pre-wrap">{message.content}</p>

                {message.action?.type === 'edit_text' && (
                    <div className="mt-3 pt-3 border-t border-border/40">
                        {message.action.status === 'pending' && (
                            <div className="flex gap-2">
                                <button
                                    onClick={handleApprove}
                                    disabled={isEditing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md hover:opacity-90 disabled:opacity-50 transition-all"
                                >
                                    {isEditing ? (
                                        <>
                                            <Loader2 size={11} className="animate-spin" />
                                            編集中...
                                        </>
                                    ) : (
                                        <>
                                            <Check size={11} />
                                            承認する
                                        </>
                                    )}
                                </button>
                                <button
                                    onClick={handleReject}
                                    disabled={isEditing}
                                    className="flex items-center gap-1.5 px-3 py-1.5 text-destructive border border-destructive/30 text-xs font-medium rounded-md hover:bg-destructive/10 disabled:opacity-50 transition-all"
                                >
                                    <X size={11} />
                                    却下する
                                </button>
                            </div>
                        )}
                        {message.action.status === 'approved' && (
                            <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                                <Check size={11} /> 承認済み
                            </span>
                        )}
                        {message.action.status === 'error' && (
                            <div className="flex items-center gap-2">
                                <span className="flex items-center gap-1 text-xs text-destructive">
                                    <X size={11} /> エラーが発生しました
                                </span>
                                <button
                                    onClick={handleApprove}
                                    className="flex items-center gap-1 px-2 py-1 text-xs text-primary hover:bg-primary/10 rounded transition-colors"
                                >
                                    <RotateCcw size={10} /> 再試行
                                </button>
                            </div>
                        )}
                        {message.action.status === 'rejected' && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                <X size={11} /> 却下済み
                            </span>
                        )}
                    </div>
                )}
            </div>
        </div>
    )
}

export default function ChatPanel() {
    const [input, setInput] = useState('')
    const { messages, isLoading, addMessage, setLoading, resetMessages, popLastUserMessage } = useChatStore()
    const contextStore = useContextStore()
    const { content: editorContent } = useEditorStore()
    const { activeServiceId } = useSettingsStore()
    const messagesEndRef = useRef(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading])

    const handleSubmit = async () => {
        const text = input.trim()
        if (!text || isLoading) return

        const userMsg = {
            id: crypto.randomUUID(),
            role: 'user',
            content: text,
            action: null,
        }
        addMessage(userMsg)
        setInput('')
        setLoading(true)

        // 直前までの会話履歴（現在のユーザーメッセージは除く）
        const history = messages
            .filter(m => m.content)
            .map(m => ({ role: m.role, content: m.content }))

        try {
            const response = await postChat({
                message: text,
                style_context: contextStore.style,
                content_context: contextStore.content,
                editor_content: editorContent,
                conversation_history: history,
                service_id: activeServiceId,
            })

            if (response.style_update) {
                contextStore.updateStyle(response.style_update)
            }
            if (response.content_update) {
                contextStore.updateContent(response.content_update)
            }

            const { action } = response
            if (action.type === 'edit_text') {
                addMessage({
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: action.plan || '文章を編集します。',
                    action: {
                        type: 'edit_text',
                        plan: action.plan,
                        status: 'pending',
                    },
                })
            } else {
                addMessage({
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: action.message || '',
                    action: null,
                })
            }
        } catch (err) {
            console.error('Chat failed:', err)
            const detail = err.message?.includes('HTTP error') ? '' : err.message
            addMessage({
                id: crypto.randomUUID(),
                role: 'assistant',
                content: detail || 'エラーが発生しました。',
                action: null,
                isError: true,
            })
        } finally {
            setLoading(false)
        }
    }

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            handleSubmit()
        }
    }

    return (
        <div className="pane">
            <div className="px-4 py-3 border-b border-border shrink-0 flex items-center justify-between">
                <h2 className="font-semibold text-sm text-foreground">チャット</h2>
                {messages.length > 0 && (
                    <button
                        onClick={resetMessages}
                        className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:bg-accent px-2 py-1 rounded-md transition-colors"
                        title="会話をリセット"
                    >
                        <RotateCcw size={12} />
                        リセット
                    </button>
                )}
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                {messages.length === 0 && (
                    <div className="h-full flex items-center justify-center">
                        <p className="text-sm text-muted-foreground/60 text-center">
                            書きたいことを教えてください
                        </p>
                    </div>
                )}
                {messages.map((msg, idx) => {
                    const isLastUser = msg.role === 'user' &&
                        !isLoading &&
                        messages.slice(idx + 1).every(m => m.role !== 'user')
                    return (
                        <MessageBubble
                            key={msg.id}
                            message={msg}
                            isLastUser={isLastUser}
                            onEdit={() => {
                                const content = popLastUserMessage()
                                if (content) setInput(content)
                            }}
                        />
                    )
                })}
                {isLoading && (
                    <div className="flex justify-start mb-4">
                        <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                            <Loader2 size={15} className="animate-spin text-muted-foreground" />
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-3 border-t border-border shrink-0">
                <div className="relative">
                    <textarea
                        value={input}
                        onChange={e => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="メッセージを入力... (Enter で送信)"
                        rows={3}
                        className="w-full resize-none pl-4 pr-12 py-2.5 text-sm bg-muted/40 text-foreground border border-input rounded-xl focus:bg-background focus:ring-2 focus:ring-ring outline-none transition-all"
                    />
                    <button
                        onClick={handleSubmit}
                        disabled={!input.trim() || isLoading}
                        className="absolute right-2 bottom-2 p-2 bg-primary text-primary-foreground rounded-lg hover:opacity-90 disabled:opacity-50 disabled:bg-muted disabled:text-muted-foreground transition-all"
                    >
                        <Send size={13} />
                    </button>
                </div>
            </div>
        </div>
    )
}
