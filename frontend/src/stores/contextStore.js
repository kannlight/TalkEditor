import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const INITIAL_STYLE = {
    theme: '',
    purpose: '',
    audience: '',
    image: '',
    format: 'Plain',
    style: [],
    length: '',
    notes: '',
}

const useContextStore = create(
    persist(
        (set) => ({
            style: { ...INITIAL_STYLE },
            content: '',
            updatedAt: 0,

            updateStyle: (patch) => set((state) => {
                const clean = Object.fromEntries(
                    Object.entries(patch).filter(([, v]) => v !== null && v !== undefined)
                )
                if (Object.keys(clean).length === 0) return {}
                return {
                    style: { ...state.style, ...clean },
                    updatedAt: Date.now(),
                }
            }),

            updateContent: (str) => set({ content: str, updatedAt: Date.now() }),

            resetContext: () => set({ style: { ...INITIAL_STYLE }, content: '', updatedAt: 0 }),
        }),
        {
            name: 'talkeditor-context',
            partialize: (state) => ({ style: state.style, content: state.content }),
        }
    )
)

export default useContextStore
