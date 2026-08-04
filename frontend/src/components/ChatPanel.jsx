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
        try {
            const data = await postEdit({
                style_context: contextStore.style,
                edit_plan: message.action.plan,
                editor_content: editorContent,
                service_id: activeServiceId,
            })
            setDraft(data.content)
            setActionStatus(message.id, 'approved')
        } catch (err) {
            console.error('Edit failed:', err)
            setActionStatus(message.id, 'error')
        } finally {
            setIsEditing(false)
        }
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
    const [streamingContent, setStreamingContent] = useState(null)
    const streamingContentRef = useRef(null)
    const { messages, isLoading, addMessage, setLoading, resetMessages, popLastUserMessage } = useChatStore()
    const contextStore = useContextStore()
    const setContextUpdating = useContextStore(s => s.setUpdating)
    const { content: editorContent } = useEditorStore()
    const { activeServiceId } = useSettingsStore()
    const messagesEndRef = useRef(null)

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages, isLoading, streamingContent])

    const handleSubmit = () => {
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

        postChat(
            {
                message: text,
                style_context: contextStore.style,
                content_context: contextStore.content,
                editor_content: editorContent,
                conversation_history: history,
                service_id: activeServiceId,
            },
            (data) => {
                if (data.type === 'action') {
                    if (data.action === 'edit_text') {
                        addMessage({
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content: data.plan || '文章を編集します。',
                            action: {
                                type: 'edit_text',
                                plan: data.plan,
                                status: 'pending',
                            },
                        })
                    } else {
                        streamingContentRef.current = ''
                        setStreamingContent('')
                    }
                } else if (data.type === 'token') {
                    streamingContentRef.current += data.content
                    setStreamingContent(streamingContentRef.current)
                } else if (data.type === 'message_done') {
                    if (streamingContentRef.current !== null) {
                        addMessage({
                            id: crypto.randomUUID(),
                            role: 'assistant',
                            content: streamingContentRef.current,
                            action: null,
                        })
                        streamingContentRef.current = null
                        setStreamingContent(null)
                    }
                    setLoading(false)
                    setContextUpdating(true)
                } else if (data.type === 'meta') {
                    if (data.style_update) contextStore.updateStyle(data.style_update)
                    if (data.content_update) contextStore.updateContent(data.content_update)
                }
            },
            () => {
                // message_done未受信のフォールバック（通信エラー等）
                if (streamingContentRef.current !== null) {
                    addMessage({
                        id: crypto.randomUUID(),
                        role: 'assistant',
                        content: streamingContentRef.current,
                        action: null,
                    })
                    streamingContentRef.current = null
                    setStreamingContent(null)
                }
                setLoading(false)
                setContextUpdating(false)
            },
            (err) => {
                console.error('Chat failed:', err)
                streamingContentRef.current = null
                setStreamingContent(null)
                const detail = err.message?.includes('HTTP error') ? '' : err.message
                addMessage({
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: detail || 'エラーが発生しました。',
                    action: null,
                    isError: true,
                })
                setLoading(false)
                setContextUpdating(false)
            },
        )
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
                {messages.length === 0 && streamingContent === null && (
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
                {streamingContent !== null ? (
                    <div className="flex justify-start mb-4">
                        <div className="max-w-[88%] bg-muted text-foreground rounded-2xl rounded-tl-sm px-4 py-2.5 text-sm whitespace-pre-wrap">
                            {streamingContent}
                            <span className="inline-block w-0.5 h-3.5 bg-foreground/50 ml-0.5 animate-pulse align-middle" />
                        </div>
                    </div>
                ) : isLoading && (
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
