import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { docId } from './docId'

const storeCreator = (set) => ({
    content: '',
    isDiffMode: false,
    isGenerating: false,
    prevContent: '',
    pendingEditedContent: '',

    setContent: (str) => set({ content: str }),
    setGenerating: (val) => set({ isGenerating: val }),

    enterDiffMode: (editedContent) => set((state) => ({
        prevContent: state.content,
        pendingEditedContent: editedContent,
        isDiffMode: true,
        isGenerating: false,
    })),

    exitDiffMode: (finalContent) => set({
        isDiffMode: false,
        content: finalContent,
        pendingEditedContent: '',
        prevContent: '',
    }),

    resetEditor: () => set({
        content: '',
        isDiffMode: false,
        isGenerating: false,
        prevContent: '',
        pendingEditedContent: '',
    }),
})

const useEditorStore = docId
    ? create(persist(storeCreator, {
        name: `talkeditor-editor-${docId}`,
        partialize: (state) => ({ content: state.content }),
    }))
    : create(storeCreator)

export default useEditorStore
