'use client'

import { useEffect } from 'react'
import { applyThemeClass, getSystemTheme, resolveTheme, useThemeStore } from '@/store/theme-store'

export default function ThemeProvider({ children }: { children: React.ReactNode }) {
  const mode = useThemeStore(s => s.mode)
  const setResolvedTheme = useThemeStore(s => s.setResolvedTheme)

  useEffect(() => {
    const resolved = resolveTheme(mode)
    setResolvedTheme(resolved)
    applyThemeClass(resolved)
  }, [mode, setResolvedTheme])

  useEffect(() => {
    if (mode !== 'system')
      return

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const resolved = getSystemTheme()
      setResolvedTheme(resolved)
      applyThemeClass(resolved)
    }

    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [mode, setResolvedTheme])

  return children
}
