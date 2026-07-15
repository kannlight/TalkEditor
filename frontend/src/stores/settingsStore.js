import { create } from 'zustand'
import { persist } from 'zustand/middleware'

const useSettingsStore = create(
    persist(
        (set, get) => ({
            availableServices: [],
            activeServiceId: null,
            theme: 'light',

            setAvailableServices: (services) => set({ availableServices: services }),
            setActiveServiceId: (id) => set({ activeServiceId: id }),

            toggleTheme: () => set((state) => {
                const newTheme = state.theme === 'light' ? 'dark' : 'light'
                document.documentElement.classList.remove('light', 'dark')
                document.documentElement.classList.add(newTheme)
                return { theme: newTheme }
            }),

            initTheme: () => {
                const { theme } = get()
                document.documentElement.classList.remove('light', 'dark')
                document.documentElement.classList.add(theme)
            },
        }),
        {
            name: 'talkeditor-settings',
            partialize: (state) => ({
                activeServiceId: state.activeServiceId,
                theme: state.theme,
            }),
        }
    )
)

export default useSettingsStore
