import { create } from 'zustand'

const useChatStore = create((set) => ({
    messages: [],
    isLoading: false,

    addMessage: (msg) => set((state) => ({ messages: [...state.messages, msg] })),

    setActionStatus: (id, status) => set((state) => ({
        messages: state.messages.map(m =>
            m.id === id ? { ...m, action: { ...m.action, status } } : m
        ),
    })),

    setLoading: (bool) => set({ isLoading: bool }),
}))

export default useChatStore
