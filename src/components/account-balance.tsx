'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Loader2, RefreshCw, Wallet } from 'lucide-react'
import { cn } from '@/lib/cn'

type BalancePayload = {
  configured: boolean
  consoleUrl?: string
  hint?: string
  error?: string
  balance?: {
    availableBalance: string
    cashBalance: string
    arrearsBalance: string
    freezeAmount: string
  }
  updatedAt?: number
}

function formatYuan(value: string | undefined): string {
  if (!value)
    return '--'

  const num = Number(value)
  if (!Number.isFinite(num))
    return value
  return num.toLocaleString('zh-CN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export default function AccountBalance({
  compact = false,
  menuPlacement = 'below',
}: {
  compact?: boolean
  menuPlacement?: 'above' | 'below'
}) {
  const [data, setData] = useState<BalancePayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const closeTimerRef = useRef<number | null>(null)

  const fetchBalance = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/account/balance', { cache: 'no-store' })
      const payload = await response.json() as BalancePayload
      if (!response.ok && !payload.error)
        payload.error = '查询失败'
      setData(payload)
    }
    catch {
      setData({ configured: false, error: '网络错误' })
    }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchBalance()
    const timer = window.setInterval(fetchBalance, 5 * 60 * 1000)
    return () => window.clearInterval(timer)
  }, [fetchBalance])

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

  const consoleUrl = data?.consoleUrl ?? 'https://console.volcengine.com/finance/account/overview'
  const available = data?.balance?.availableBalance
  const hasArrears = Number(data?.balance?.arrearsBalance ?? 0) > 0

  const label = loading && !data
    ? '查询中...'
    : data?.configured && available != null && !data.error
      ? `¥${formatYuan(available)}`
      : data?.configured && data.error
        ? '余额查询失败'
        : '查看账户余额'

  return (
    <div className="relative">
      <a
        href={consoleUrl}
        target="_blank"
        rel="noreferrer"
        onMouseEnter={openMenu}
        onMouseLeave={scheduleCloseMenu}
        onFocus={openMenu}
        onBlur={scheduleCloseMenu}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border transition',
          compact ? 'px-2 py-1.5 text-xs' : 'px-2.5 py-2 text-sm',
          hasArrears
            ? 'border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300'
            : 'border-border bg-input text-foreground hover:bg-surface-muted',
        )}
        title={data?.hint ?? '火山引擎账户可用余额'}
      >
        {loading
          ? <Loader2 className={cn('animate-spin text-muted', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />
          : <Wallet className={cn('shrink-0 text-muted', compact ? 'h-3.5 w-3.5' : 'h-4 w-4')} />}
        <span className={cn('font-medium', compact ? 'hidden md:inline' : 'hidden sm:inline')}>{label}</span>
        <ExternalLink className="h-3 w-3 shrink-0 text-muted opacity-60" />
      </a>

      {menuOpen && (
        <div
          className={cn(
            'absolute right-0 z-[120] w-64',
            menuPlacement === 'above' ? 'bottom-full pb-1.5' : 'top-full pt-1.5',
          )}
          onMouseEnter={openMenu}
          onMouseLeave={scheduleCloseMenu}
        >
          <div className="rounded-lg border border-border bg-surface p-3 text-xs shadow-lg">
            <div className="flex items-center justify-between gap-2">
              <p className="font-semibold text-foreground">火山账户余额</p>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault()
                  fetchBalance()
                }}
                className="rounded p-1 text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label="刷新余额"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
            </div>

            {!data?.configured && (
              <p className="mt-2 leading-relaxed text-muted">
                {data?.hint ?? '需配置 IAM 访问密钥（VOLC_ACCESS_KEY_ID / VOLC_SECRET_ACCESS_KEY），与 ARK_API_KEY 不同。'}
              </p>
            )}

            {data?.error && (
              <p className="mt-2 text-red-600 dark:text-red-400">{data.error}</p>
            )}

            {data?.balance && (
              <dl className="mt-2 space-y-1 text-muted">
                <div className="flex justify-between gap-2">
                  <dt>可用余额</dt>
                  <dd className="font-medium text-foreground">¥{formatYuan(data.balance.availableBalance)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt>现金余额</dt>
                  <dd>¥{formatYuan(data.balance.cashBalance)}</dd>
                </div>
                {Number(data.balance.freezeAmount) > 0 && (
                  <div className="flex justify-between gap-2">
                    <dt>冻结</dt>
                    <dd>¥{formatYuan(data.balance.freezeAmount)}</dd>
                  </div>
                )}
                {Number(data.balance.arrearsBalance) > 0 && (
                  <div className="flex justify-between gap-2 text-red-600 dark:text-red-400">
                    <dt>欠费</dt>
                    <dd>¥{formatYuan(data.balance.arrearsBalance)}</dd>
                  </div>
                )}
              </dl>
            )}

            <a
              href={consoleUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-primary-light hover:underline"
            >
              打开费用中心
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      )}
    </div>
  )
}
