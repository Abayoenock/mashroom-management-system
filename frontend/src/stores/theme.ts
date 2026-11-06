import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Theme = 'light' | 'dark'

interface ThemeState { theme: Theme; toggle: () => void; set: (t: Theme) => void }

const apply = (t: Theme) => document.documentElement.classList.toggle('dark', t === 'dark')

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      theme: window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light',
      toggle: () => { const t = get().theme === 'dark' ? 'light' : 'dark'; apply(t); set({ theme: t }) },
      set: (t) => { apply(t); set({ theme: t }) },
    }),
    { name: 'mf-theme', onRehydrateStorage: () => (s) => s && apply(s.theme) },
  ),
)
