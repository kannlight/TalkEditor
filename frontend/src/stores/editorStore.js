import { create } from 'zustand'

const useEditorStore = create((set, get) => ({
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
}))

export default useEditorStore
