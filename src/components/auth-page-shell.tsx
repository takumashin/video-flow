'use client'

import type { ReactNode } from 'react'
import { AuthCanvasBackground } from '@/components/auth-canvas-background'

type AuthPageShellProps = {
  children: ReactNode
}

export function AuthPageShell({ children }: AuthPageShellProps) {
  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden bg-background p-6">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 -top-20 h-[min(520px,70vw)] w-[min(520px,70vw)] rounded-full bg-primary/15 blur-[100px] dark:bg-primary/25" />
        <div className="absolute -right-16 top-[18%] h-[min(460px,60vw)] w-[min(460px,60vw)] rounded-full bg-primary-light/10 blur-[90px] dark:bg-primary-light/20" />
        <div className="absolute bottom-0 left-1/2 h-48 w-[min(900px,120%)] -translate-x-1/2 bg-gradient-to-t from-background via-background/80 to-transparent" />
      </div>

      <AuthCanvasBackground />

      <div className="relative z-10 w-full max-w-md rounded-2xl border border-border/70 bg-surface/85 p-8 shadow-[0_24px_80px_-12px_rgba(16,24,40,0.18)] backdrop-blur-xl dark:border-border/50 dark:bg-surface/75 dark:shadow-[0_24px_80px_-12px_rgba(0,0,0,0.55)]">
        {children}
      </div>
    </div>
  )
}

export function AuthPageLoading() {
  return (
    <AuthPageShell>
      <div className="py-10 text-center text-sm text-muted">加载中…</div>
    </AuthPageShell>
  )
}
