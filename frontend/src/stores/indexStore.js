import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useIndexStore = create(
    persist(
        (set) => ({
            entries: [],

            addEntry: (entry) => set(state => ({
                entries: [entry, ...state.entries],
            })),

            updateEntry: (id, patch) => set(state => ({
                entries: state.entries.map(e =>
                    e.id === id ? { ...e, ...patch } : e
                ),
            })),

            deleteEntry: (id) => set(state => ({
                entries: state.entries.filter(e => e.id !== id),
            })),
        }),
        { name: 'talkeditor-index' }
    )
)

export default useIndexStore
