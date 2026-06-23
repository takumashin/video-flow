'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Coins, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/cn'
import { notifyCreditsChanged } from '@/lib/credits/client-events'

type CreditsPayload = {
  balance: number
  modelCosts?: Array<{ id: string, label: string, creditCost: number }>
  transactions?: Array<{
    id: string
    amount: number
    description: string | null
    createdAt: string
  }>
}

function formatCredits(value: number): string {
  return value.toLocaleString('zh-CN')
}

export default function UserCredits({
  compact = false,
  menuPlacement = 'below',
}: {
  compact?: boolean
  menuPlacement?: 'above' | 'below'
}) {
  const [data, setData] = useState<CreditsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const fetchCredits = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/account/credits', { cache: 'no-store' })
      const payload = await response.json() as CreditsPayload & { error?: string }
      if (response.ok)
        setData(payload)
      else
        setData(null)
    }
    catch {
      setData(null)
    }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCredits()
    const timer = window.setInterval(fetchCredits, 60 * 1000)
    return () => window.clearInterval(timer)
  }, [fetchCredits])

  useEffect(() => {
    const onCreditsChanged = () => {
      fetchCredits()
    }
    window.addEventListener('seedance:credits-changed', onCreditsChanged)
    return () => window.removeEventListener('seedance:credits-changed', onCreditsChanged)
  }, [fetchCredits])

  useEffect(() => {
    return () => {
      if (closeTimerRef.current)
        window.clearTimeout(closeTimerRef.current)
    }
  }, [])

  const openMenu = () => {
    if (closeTimerRef.current) {
      window.clearTimeout(closeTimerRef.current)
      closeTimerRef.current = null
    }
    setMenuOpen(true)
  }

  const scheduleCloseMenu = () => {
    if (closeTimerRef.current)
      window.clearTimeout(closeTimerRef.current)
    closeTimerRef.current = window.setTimeout(() => {
      setMenuOpen(false)
      closeTimerRef.current = null
    }, 120)
  }

  const balance = data?.balance
  const label = loading && data == null
    ? '点数…'
    : balance != null
      ? `${formatCredits(balance)} 点`
      : '我的点数'

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleCloseMenu}
        onFocus={openMenu}
        onBlur={scheduleCloseMenu}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-border bg-input text-foreground transition hover:bg-surface-muted',
          compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm',
        )}
        title="账户点数余额"
      >
        {loading && data == null
          ? <Loader2 className={cn('animate-spin text-muted', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          : <Coins className={cn('shrink-0 text-amber-500', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
        <span className={cn('font-medium', compact ? 'hidden md:inline' : 'hidden sm:inline')}>{label}</span>
      </button>

      {menuOpen && (
        <div
          className={cn(
            'absolute right-0 z-[120] w-72',
            menuPlacement === 'above' ? 'bottom-full pb-1.5' : 'top-full pt-1.5',
          )}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleCloseMenu}
        >
          <div className="rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">我的点数</p>
              <button
                type="button"
                onClick={fetchCredits}
                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label="刷新点数"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>

            <p className="mt-2 text-2xl font-semibold text-foreground">
              {balance != null ? `${formatCredits(balance)} 点` : '--'}
            </p>

            {data?.modelCosts && data.modelCosts.length > 0 && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="mb-1.5 font-medium text-foreground">视频生成消耗</p>
                <ul className="space-y-1 text-muted">
                  {data.modelCosts.map(item => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="truncate">{item.label}</span>
                      <span className="shrink-0 font-medium text-foreground">{item.creditCost} 点</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {data?.transactions && data.transactions.length > 0 && (
              <div className="mt-3 border-t border-border pt-2">
                <p className="mb-1.5 font-medium text-foreground">最近记录</p>
                <ul className="max-h-28 space-y-1 overflow-y-auto text-muted">
                  {data.transactions.slice(0, 5).map(item => (
                    <li key={item.id} className="flex justify-between gap-2">
                      <span className="truncate">{item.description ?? '点数变动'}</span>
                      <span className={cn(
                        'shrink-0 font-medium',
                        item.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
                      )}
                      >
                        {item.amount >= 0 ? '+' : ''}{item.amount}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <Link
              href="/account"
              className="mt-2 inline-flex text-primary-light hover:underline"
            >
              账户设置
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}

export { notifyCreditsChanged }
