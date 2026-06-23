'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Suspense, useCallback, useEffect, useState } from 'react'
import {
  ArrowLeft,
  Coins,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Shield,
  Users,
} from 'lucide-react'
import { SiteLogo } from '@/components/site-logo'
import { cn } from '@/lib/cn'
import { btnSecondaryClass, inputClass } from '@/lib/ui-classes'

type GlobalSummary = {
  userCount: number
  totalBalance: number
  totalConsumed: number
  totalGranted: number
  generationCount: number
}

type UserRow = {
  userId: string
  email: string
  name: string | null
  balance: number
  totalConsumed: number
  totalGranted: number
  generationCount: number
  createdAt: string
}

type TransactionRow = {
  id: string
  amount: number
  balanceAfter: number
  type: string
  description: string | null
  createdAt: string
}

function formatNumber(value: number) {
  return value.toLocaleString('zh-CN')
}

function AdminCreditsContent() {
  const router = useRouter()
  const { status } = useSession()
  const [authorized, setAuthorized] = useState<boolean | null>(null)
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<GlobalSummary | null>(null)
  const [users, setUsers] = useState<UserRow[]>([])
  const [search, setSearch] = useState('')
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
  const [transactions, setTransactions] = useState<TransactionRow[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [grantAmount, setGrantAmount] = useState('')
  const [grantNote, setGrantNote] = useState('')
  const [granting, setGranting] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadUsers = useCallback(async (query?: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (query?.trim())
        params.set('q', query.trim())

      const response = await fetch(`/api/admin/credits?${params.toString()}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '加载失败')

      setSummary(data.summary)
      setUsers(data.users ?? [])
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
    finally {
      setLoading(false)
    }
  }, [])

  const loadUserDetail = useCallback(async (userId: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/admin/credits/${userId}`, { cache: 'no-store' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '加载用户详情失败')

      setTransactions(data.transactions ?? [])
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '加载用户详情失败')
    }
    finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    if (status === 'unauthenticated')
      router.replace('/login?callbackUrl=/admin/credits')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated')
      return

    fetch('/api/admin/me')
      .then(res => res.json())
      .then(data => {
        setAuthorized(!!data.isAdmin)
        if (data.isAdmin)
          loadUsers()
        else
          setLoading(false)
      })
      .catch(() => {
        setAuthorized(false)
        setLoading(false)
      })
  }, [status, loadUsers])

  useEffect(() => {
    if (selectedUserId)
      loadUserDetail(selectedUserId)
    else
      setTransactions([])
  }, [selectedUserId, loadUserDetail])

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault()
    loadUsers(search)
  }

  const handleGrant = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedUserId)
      return

    setGranting(true)
    setMessage(null)
    setError(null)
    try {
      const response = await fetch(`/api/admin/credits/${selectedUserId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number.parseInt(grantAmount, 10),
          description: grantNote.trim() || undefined,
        }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '充值失败')

      setGrantAmount('')
      setGrantNote('')
      setMessage(`充值成功，当前余额 ${formatNumber(data.balanceAfter)} 点`)
      await Promise.all([loadUsers(search), loadUserDetail(selectedUserId)])

      if (data.summary) {
        setUsers(prev => prev.map(user =>
          user.userId === selectedUserId
            ? { ...user, ...data.summary }
            : user,
        ))
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '充值失败')
    }
    finally {
      setGranting(false)
    }
  }

  if (status === 'loading' || authorized === null || (authorized && loading && !summary)) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载中…
      </div>
    )
  }

  if (!authorized) {
    return (
      <div className="flex min-h-full items-center justify-center px-4">
        <div className="max-w-md rounded-2xl border border-border bg-surface p-6 text-center shadow-sm">
          <Shield className="mx-auto mb-3 h-8 w-8 text-muted" />
          <h1 className="text-lg font-semibold text-foreground">无权访问</h1>
          <p className="mt-2 text-sm text-muted">当前账号不在管理员列表中，请联系系统管理员配置 ADMIN_EMAILS。</p>
          <Link href="/" className="mt-4 inline-flex text-sm text-primary hover:underline">返回首页</Link>
        </div>
      </div>
    )
  }

  const selectedUser = users.find(user => user.userId === selectedUserId) ?? null

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/" className="rounded-lg p-2 text-muted transition hover:bg-surface-muted hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <SiteLogo size={32} className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">点数管理后台</h1>
            <p className="text-sm text-muted">查看用户消耗统计，并为用户充值点数</p>
          </div>
          <button
            type="button"
            onClick={() => loadUsers(search)}
            className={cn(btnSecondaryClass, 'ml-auto')}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            刷新
          </button>
        </div>

        {summary && (
          <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Users className="h-4 w-4" />
                注册用户
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(summary.userCount)}</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <div className="flex items-center gap-2 text-xs text-muted">
                <Coins className="h-4 w-4 text-amber-500" />
                系统总余额
              </div>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(summary.totalBalance)} 点</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs text-muted">累计消耗</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(summary.totalConsumed)} 点</p>
            </div>
            <div className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
              <p className="text-xs text-muted">累计生成次数</p>
              <p className="mt-2 text-2xl font-semibold text-foreground">{formatNumber(summary.generationCount)}</p>
            </div>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <section className="rounded-2xl border border-border bg-surface shadow-sm">
            <div className="border-b border-border p-4">
              <form onSubmit={handleSearch} className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="搜索邮箱或昵称"
                    className={cn(inputClass, 'pl-9 text-sm')}
                  />
                </div>
                <button type="submit" className={btnSecondaryClass}>搜索</button>
              </form>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted">
                    <th className="px-4 py-3 font-medium">用户</th>
                    <th className="px-4 py-3 font-medium">余额</th>
                    <th className="px-4 py-3 font-medium">累计消耗</th>
                    <th className="px-4 py-3 font-medium">生成次数</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr
                      key={user.userId}
                      onClick={() => setSelectedUserId(user.userId)}
                      className={cn(
                        'cursor-pointer border-b border-border/70 transition hover:bg-surface-muted/60',
                        selectedUserId === user.userId && 'bg-primary/5',
                      )}
                    >
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{user.name || '未设置昵称'}</p>
                        <p className="text-xs text-muted">{user.email}</p>
                      </td>
                      <td className="px-4 py-3 font-medium text-foreground">{formatNumber(user.balance)}</td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(user.totalConsumed)}</td>
                      <td className="px-4 py-3 text-foreground">{formatNumber(user.generationCount)}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-muted">暂无用户数据</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-4 shadow-sm">
            {selectedUser
              ? (
                  <>
                    <div className="mb-4">
                      <p className="text-sm font-semibold text-foreground">{selectedUser.name || '未设置昵称'}</p>
                      <p className="text-xs text-muted">{selectedUser.email}</p>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div className="rounded-lg border border-border bg-input/40 p-2">
                          <p className="text-muted">当前余额</p>
                          <p className="mt-1 text-base font-semibold text-foreground">{formatNumber(selectedUser.balance)} 点</p>
                        </div>
                        <div className="rounded-lg border border-border bg-input/40 p-2">
                          <p className="text-muted">累计消耗</p>
                          <p className="mt-1 text-base font-semibold text-foreground">{formatNumber(selectedUser.totalConsumed)} 点</p>
                        </div>
                      </div>
                    </div>

                    <form onSubmit={handleGrant} className="mb-4 space-y-3 rounded-xl border border-border bg-input/30 p-3">
                      <p className="text-sm font-medium text-foreground">为用户充值</p>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={grantAmount}
                        onChange={e => setGrantAmount(e.target.value)}
                        placeholder="充值点数"
                        required
                        className={cn(inputClass, 'text-sm')}
                      />
                      <input
                        value={grantNote}
                        onChange={e => setGrantNote(e.target.value)}
                        placeholder="备注（可选）"
                        className={cn(inputClass, 'text-sm')}
                      />
                      <button
                        type="submit"
                        disabled={granting}
                        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {granting
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <Plus className="h-4 w-4" />}
                        {granting ? '充值中…' : '确认充值'}
                      </button>
                    </form>

                    <div>
                      <p className="mb-2 text-sm font-medium text-foreground">点数流水</p>
                      {detailLoading
                        ? (
                            <div className="flex items-center gap-2 text-sm text-muted">
                              <Loader2 className="h-4 w-4 animate-spin" />
                              加载流水…
                            </div>
                          )
                        : (
                            <ul className="max-h-80 space-y-2 overflow-y-auto text-xs">
                              {transactions.map(item => (
                                <li key={item.id} className="rounded-lg border border-border bg-input/30 px-3 py-2">
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="text-foreground">{item.description ?? item.type}</span>
                                    <span className={cn(
                                      'shrink-0 font-semibold',
                                      item.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground',
                                    )}
                                    >
                                      {item.amount >= 0 ? '+' : ''}{formatNumber(item.amount)}
                                    </span>
                                  </div>
                                  <p className="mt-1 text-muted">
                                    余额 {formatNumber(item.balanceAfter)} · {new Date(item.createdAt).toLocaleString('zh-CN')}
                                  </p>
                                </li>
                              ))}
                              {transactions.length === 0 && (
                                <li className="rounded-lg border border-dashed border-border px-3 py-6 text-center text-muted">暂无流水记录</li>
                              )}
                            </ul>
                          )}
                    </div>
                  </>
                )
              : (
                  <div className="flex h-full min-h-64 items-center justify-center text-sm text-muted">
                    选择左侧用户查看详情并充值
                  </div>
                )}
          </section>
        </div>

        {message && <p className="mt-4 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
        {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}

export default function AdminCreditsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center text-muted">加载中…</div>}>
      <AdminCreditsContent />
    </Suspense>
  )
}
