import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { docId } from './docId'

// 文章作成のコンテキスト。スタイルや書きたい内容のメモ。
export const INITIAL_CONTEXT = {
    theme: '',
    purpose: '',
    audience: '',
    image: '',
    format: 'Plain',
    style: [],
    length: '',
    notes: '',
    content: '',
}

const storeCreator = (set) => ({
    context: { ...INITIAL_CONTEXT },
    updatedAt: 0,
    isUpdating: false,

    setUpdating: (bool) => set({ isUpdating: bool }),

    // 部分更新。null/undefined のフィールドは無視（LLM未更新フィールドを上書きしない）
    update: (patch) => set((state) => {
        const clean = Object.fromEntries(
            Object.entries(patch || {}).filter(([, v]) => v !== null && v !== undefined)
        )
        if (Object.keys(clean).length === 0) return {}
        return {
            context: { ...state.context, ...clean },
            updatedAt: Date.now(),
        }
    }),

    resetContext: () => set({ context: { ...INITIAL_CONTEXT }, updatedAt: 0 }),
})

const useContextStore = docId
    ? create(persist(storeCreator, {
        name: `talkeditor-context-${docId}`,
        version: 1,
        partialize: (state) => ({ context: state.context }),
        // v0: { style: {...}, content: '' } → v1: { context: {...統合...} }
        migrate: (persisted, version) => {
            if (version < 1 && persisted && persisted.style) {
                return {
                    context: {
                        ...INITIAL_CONTEXT,
                        ...persisted.style,
                        content: persisted.content || '',
                    },
                }
            }
            return persisted
        },
    }))
    : create(storeCreator)

export default useContextStore
