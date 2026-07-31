import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useEditorStore = create(
    persist(
        (set) => ({
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
        }),
        {
            name: 'talkeditor-editor',
            partialize: (state) => ({ content: state.content }),
        }
    )
)

export default useEditorStore
