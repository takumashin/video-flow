'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { ThemeMode } from '@/store/theme-store'
import { useThemeStore } from '@/store/theme-store'

const options: Array<{ mode: ThemeMode; label: string; icon: typeof Sun }> = [
  { mode: 'light', label: '浅色', icon: Sun },
  { mode: 'dark', label: '深色', icon: Moon },
  { mode: 'system', label: '跟随系统', icon: Monitor },
]

export default function ThemeToggle() {
  const mode = useThemeStore(s => s.mode)
  const setMode = useThemeStore(s => s.setMode)

  return (
    <div
      className="inline-flex items-center rounded-lg border border-border bg-input p-0.5 shadow-sm"
      role="group"
      aria-label="主题模式"
    >
      {options.map(({ mode: optionMode, label, icon: Icon }) => (
        <button
          key={optionMode}
          type="button"
          onClick={() => setMode(optionMode)}
          className={cn(
            'inline-flex items-center gap-1 rounded-md px-2 py-1.5 text-xs font-medium transition',
            mode === optionMode
              ? 'bg-surface-muted text-foreground shadow-sm'
              : 'text-muted hover:text-foreground',
          )}
          aria-pressed={mode === optionMode}
          title={label}
        >
          <Icon className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{label}</span>
        </button>
      ))}
    </div>
  )
}
