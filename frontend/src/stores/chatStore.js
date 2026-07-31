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

    resetMessages: () => set({ messages: [], isLoading: false }),
})

const useChatStore = docId
    ? create(persist(storeCreator, {
        name: `talkeditor-chat-${docId}`,
        partialize: (state) => ({ messages: state.messages }),
    }))
    : create(storeCreator)

export default useChatStore
