import { create } from 'zustand'

const useContextStore = create((set) => ({
    style: {
        theme: '',
        purpose: '',
        audience: '',
        image: '',
        format: 'Plain',
        style: [],
        length: '',
        notes: '',
    },
    content: '',
    updatedAt: 0,

    updateStyle: (patch) => set((state) => {
        // null / undefined の値は無視する（LLM出力の未更新フィールド）
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
}))

export default useContextStore
