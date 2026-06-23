import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export type ThemeMode = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'seedance-theme'

export function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined')
    return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(mode: ThemeMode): ResolvedTheme {
  if (mode === 'system')
    return getSystemTheme()
  return mode
}

type ThemeStore = {
  mode: ThemeMode
  resolvedTheme: ResolvedTheme
  setMode: (mode: ThemeMode) => void
  setResolvedTheme: (theme: ResolvedTheme) => void
}

export const useThemeStore = create<ThemeStore>()(
  persist(
    set => ({
      mode: 'dark',
      resolvedTheme: 'dark',
      setMode: mode => {
        const resolved = resolveTheme(mode)
        set({ mode, resolvedTheme: resolved })
        applyThemeClass(resolved)
      },
      setResolvedTheme: resolvedTheme => {
        set({ resolvedTheme })
        applyThemeClass(resolvedTheme)
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: state => ({ mode: state.mode }),
      onRehydrateStorage: () => state => {
        if (!state)
          return
        const resolved = resolveTheme(state.mode)
        state.resolvedTheme = resolved
        applyThemeClass(resolved)
      },
    },
  ),
)

export function applyThemeClass(theme: ResolvedTheme) {
  if (typeof document === 'undefined')
    return
  document.documentElement.classList.toggle('dark', theme === 'dark')
  document.documentElement.style.colorScheme = theme
}
