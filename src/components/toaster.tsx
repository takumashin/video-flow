'use client'

import { AlertCircle, CheckCircle2, Info, X } from 'lucide-react'
import { useToastStore, type ToastType } from '@/lib/toast-store'
import { cn } from '@/lib/cn'

const ICON_BY_TYPE: Record<ToastType, typeof AlertCircle> = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
}

const STYLE_BY_TYPE: Record<ToastType, { container: string, icon: string }> = {
  error: {
    container: 'border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300',
    icon: 'text-red-500',
  },
  success: {
    container: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-500',
  },
  info: {
    container: 'border-primary-light/30 bg-primary/10 text-foreground',
    icon: 'text-primary',
  },
}

export default function Toaster() {
  const toasts = useToastStore(s => s.toasts)
  const removeToast = useToastStore(s => s.removeToast)

  if (toasts.length === 0)
    return null

  return (
    <div className="pointer-events-none fixed right-4 top-4 z-[300] flex flex-col gap-2">
      {toasts.map((t) => {
        const Icon = ICON_BY_TYPE[t.type]
        const style = STYLE_BY_TYPE[t.type]
        return (
          <div
            key={t.id}
            className={cn(
              'pointer-events-auto flex min-w-[280px] max-w-sm items-start gap-2.5 rounded-xl border px-3.5 py-3 shadow-lg backdrop-blur-sm',
              'toast-enter',
              style.container,
            )}
            role="alert"
          >
            <Icon className={cn('mt-0.5 h-4 w-4 shrink-0', style.icon)} />
            <p className="flex-1 text-sm leading-snug">{t.message}</p>
            <button
              type="button"
              onClick={() => removeToast(t.id)}
              className="shrink-0 rounded-md p-0.5 opacity-60 hover:opacity-100"
              aria-label="关闭"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
