import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useChatStore = create(
    persist(
        (set) => ({
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
        }),
        {
            name: 'talkeditor-chat',
            partialize: (state) => ({ messages: state.messages }),
        }
    )
)

export default useChatStore
