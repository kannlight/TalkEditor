import { create } from 'zustand'

const useEditorStore = create((set, get) => ({
    content: '',
    isDiffMode: false,
    prevContent: '',
    pendingEditedContent: '',

    setContent: (str) => set({ content: str }),

    enterDiffMode: (editedContent) => set((state) => ({
        prevContent: state.content,
        pendingEditedContent: editedContent,
        isDiffMode: true,
    })),

    exitDiffMode: (finalContent) => set({
        isDiffMode: false,
        content: finalContent,
        pendingEditedContent: '',
        prevContent: '',
    }),
}))

export default useEditorStore
