'use client'

import Link from 'next/link'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Settings, Shield } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { btnCompactClass } from '@/lib/ui-classes'
import { cn } from '@/lib/cn'
import { dropdownAnchorClass } from '@/lib/ui-classes'

export default function UserMenu({ compact = false }: { compact?: boolean }) {
  const { data: session } = useSession()
  const [open, setOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!session?.user)
      return

    fetch('/api/admin/me')
      .then(res => res.json())
      .then(data => setIsAdmin(!!data.isAdmin))
      .catch(() => setIsAdmin(false))
  }, [session?.user])

  useEffect(() => {
    if (!open)
      return
    const handleClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node))
        setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  if (!session?.user)
    return null

  const displayName = session.user.name ?? session.user.email ?? '用户'
  const initials = displayName.slice(0, 1).toUpperCase()

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-border bg-input font-medium text-foreground shadow-sm transition hover:bg-surface-muted',
          compact ? btnCompactClass : 'px-3 py-2 text-sm',
        )}
        title={displayName}
      >
        {session.user.image
          ? (
              <img src={session.user.image} alt="" className={cn('rounded-full object-cover', compact ? 'h-5 w-5' : 'h-6 w-6')} />
            )
          : (
              <span className={cn('flex items-center justify-center rounded-full bg-primary/10 font-semibold text-primary', compact ? 'h-5 w-5 text-[10px]' : 'h-6 w-6 text-xs')}>
                {initials}
              </span>
            )}
        <span className={cn('truncate', compact ? 'max-w-[100px] hidden md:inline' : 'max-w-[120px] hidden sm:inline')}>{displayName}</span>
      </button>

      {open && (
        <div className={cn(dropdownAnchorClass('above', 'right'), 'w-48 rounded-xl border border-border bg-surface-elevated p-1 shadow-xl')}>
          <div className="border-b border-border px-3 py-2">
            <p className="truncate text-sm font-medium text-foreground">{displayName}</p>
            <p className="truncate text-xs text-muted">{session.user.email}</p>
          </div>
          <Link
            href="/account"
            onClick={() => setOpen(false)}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
          >
            <Settings className="h-4 w-4" />
            账号设置
          </Link>
          {isAdmin && (
            <Link
              href="/admin/credits"
              onClick={() => setOpen(false)}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
            >
              <Shield className="h-4 w-4" />
              点数管理
            </Link>
          )}
          <button
            type="button"
            onClick={() => signOut({ callbackUrl: '/login' })}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
          >
            <LogOut className="h-4 w-4" />
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
