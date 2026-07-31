import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { docId } from './docId'

const storeCreator = (set) => ({
    messages: [],
    isLoading: false,

    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

    setActionStatus: (id, status) => set((state) => ({
        messages: state.messages.map(m =>
            m.id === id ? { ...m, action: { ...m.action, status } } : m
        ),
    })),

    setLoading: (bool) => set({ isLoading: bool }),

    popLastUserMessage: () => {
        const state = useChatStore.getState()
        const lastUserIdx = state.messages.findLastIndex(m => m.role === 'user')
        if (lastUserIdx === -1) return null
        const userMsg = state.messages[lastUserIdx]
        set({ messages: state.messages.slice(0, lastUserIdx) })
        return userMsg.content
    },

    resetMessages: () => set({ messages: [], isLoading: false }),
})

const useChatStore = docId
    ? create(persist(storeCreator, {
        name: `talkeditor-chat-${docId}`,
        partialize: (state) => ({ messages: state.messages }),
    }))
    : create(storeCreator)

export default useChatStore
