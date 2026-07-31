import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { docId } from './docId'

const storeCreator = (set) => ({
    content: '',
    draft: '',
    isGenerating: false,

    setContent: (str) => set({ content: str }),
    setDraft: (str) => set({ draft: str }),
    setGenerating: (val) => set({ isGenerating: val }),

    confirmDraft: () => set((state) => ({
        content: state.draft,
    })),

    discardDraft: () => set((state) => ({
        draft: state.content,
    })),

    resetEditor: () => set({
        content: '',
        draft: '',
        isGenerating: false,
    }),
})

const useEditorStore = docId
    ? create(persist(storeCreator, {
        name: `talkeditor-editor-${docId}`,
        partialize: (state) => ({ content: state.content, draft: state.draft }),
    }))
    : create(storeCreator)

export default useEditorStore
