'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Suspense, useEffect, useState } from 'react'
import { ArrowLeft, Coins, Loader2, Mail, Shield, User } from 'lucide-react'
import { SiteLogo } from '@/components/site-logo'

function isOAuthPlaceholderEmail(email: string) {
  return email.endsWith('@oauth.local')
}

type Profile = {
  id: string
  name: string | null
  email: string
  image: string | null
  emailVerified: string | null
  hasPassword: boolean
  createdAt: string
}

type CreditsInfo = {
  balance: number
  modelCosts: Array<{ id: string, label: string, creditCost: number }>
  transactions: Array<{
    id: string
    amount: number
    description: string | null
    createdAt: string
  }>
}

function AccountSettingsContent() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [profile, setProfile] = useState<Profile | null>(null)
  const [credits, setCredits] = useState<CreditsInfo | null>(null)
  const [name, setName] = useState('')
  const [image, setImage] = useState('')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [savingProfile, setSavingProfile] = useState(false)
  const [changingPassword, setChangingPassword] = useState(false)
  const [sendingVerify, setSendingVerify] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated')
      router.replace('/login?callbackUrl=/account')
  }, [status, router])

  useEffect(() => {
    if (status !== 'authenticated')
      return

    fetch('/api/account/profile')
      .then(res => res.json())
      .then(data => {
        if (data.profile) {
          setProfile(data.profile)
          setName(data.profile.name ?? '')
          setImage(data.profile.image ?? '')
        }
      })
      .catch(() => setError('加载资料失败'))

    fetch('/api/account/credits')
      .then(res => res.json())
      .then(data => {
        if (typeof data.balance === 'number')
          setCredits(data)
      })
      .catch(() => {})
  }, [status])

  if (status === 'loading' || !profile) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载中…
      </div>
    )
  }

  const emailVerified = !!(profile.emailVerified || session?.emailVerified)
  const showRealEmail = !isOAuthPlaceholderEmail(profile.email)

  const saveProfile = async (event: React.FormEvent) => {
    event.preventDefault()
    setSavingProfile(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/account/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, image: image.trim() || null }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '保存失败')

      setProfile(data.profile)
      await update({ name: data.profile.name ?? undefined })
      setMessage('资料已更新')
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
    finally {
      setSavingProfile(false)
    }
  }

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault()
    setChangingPassword(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/account/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '修改失败')

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setMessage('密码已更新')
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '修改失败')
    }
    finally {
      setChangingPassword(false)
    }
  }

  const resendVerification = async () => {
    setSendingVerify(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/auth/verify-email', { method: 'POST' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '发送失败')
      setMessage(data.message || '验证邮件已发送，请查收邮箱（开发环境请查看服务端日志）')
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '发送失败')
    }
    finally {
      setSendingVerify(false)
    }
  }

  const initials = (profile.name || profile.email || '?').slice(0, 1).toUpperCase()

  return (
    <div className="min-h-full bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-8 flex items-center gap-3">
          <Link href="/" className="rounded-lg p-2 text-muted transition hover:bg-surface-muted hover:text-foreground">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <SiteLogo size={32} className="h-8 w-8 rounded-lg" />
          <div>
            <h1 className="text-lg font-semibold text-foreground">账号设置</h1>
            <p className="text-sm text-muted">管理个人资料与安全选项</p>
          </div>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-5 flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="h-4 w-4" />
              个人资料
            </div>

            <div className="mb-5 flex items-center gap-4">
              {profile.image
                ? (
                    <img src={profile.image} alt="" className="h-14 w-14 rounded-full border border-border object-cover" />
                  )
                : (
                    <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
                      {initials}
                    </div>
                  )}
              <div>
                <p className="font-medium text-foreground">{profile.name || '未设置昵称'}</p>
                <p className="text-sm text-muted">{profile.email}</p>
              </div>
            </div>

            <form onSubmit={saveProfile} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">昵称</label>
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={40}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-medium text-foreground">头像 URL</label>
                <input
                  value={image}
                  onChange={e => setImage(e.target.value)}
                  placeholder="https://example.com/avatar.jpg"
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
                />
              </div>
              <button
                type="submit"
                disabled={savingProfile}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
              >
                {savingProfile ? '保存中…' : '保存资料'}
              </button>
            </form>
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Coins className="h-4 w-4 text-amber-500" />
              我的点数
            </div>
            <p className="text-3xl font-semibold text-foreground">
              {credits ? `${credits.balance.toLocaleString('zh-CN')} 点` : '—'}
            </p>
            <p className="mt-2 text-sm text-muted">
              每次提交视频生成任务时按模型扣点，充值功能即将上线。
            </p>
            {credits?.modelCosts && (
              <div className="mt-4 rounded-lg border border-border bg-input/50 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">模型消耗标准</p>
                <ul className="space-y-1 text-sm text-muted">
                  {credits.modelCosts.map(item => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span>{item.label}</span>
                      <span className="font-medium text-foreground">{item.creditCost} 点/次</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {credits?.transactions && credits.transactions.length > 0 && (
              <div className="mt-4 rounded-lg border border-border bg-input/50 p-3">
                <p className="mb-2 text-xs font-medium text-foreground">最近消耗记录</p>
                <ul className="max-h-48 space-y-2 overflow-y-auto text-sm text-muted">
                  {credits.transactions.map(item => (
                    <li key={item.id} className="flex justify-between gap-3">
                      <span className="truncate">{item.description ?? '点数变动'}</span>
                      <span className={`shrink-0 font-medium ${item.amount >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-foreground'}`}>
                        {item.amount >= 0 ? '+' : ''}{item.amount.toLocaleString('zh-CN')}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Mail className="h-4 w-4" />
              邮箱验证
            </div>
            {showRealEmail
              ? (
                  <div className="space-y-3">
                    <p className="text-sm text-muted">
                      当前邮箱：
                      {' '}
                      <span className="text-foreground">{profile.email}</span>
                    </p>
                    <p className={`text-sm ${emailVerified ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}>
                      {emailVerified ? '✓ 邮箱已验证' : '邮箱尚未验证'}
                    </p>
                    {!emailVerified && (
                      <button
                        type="button"
                        onClick={resendVerification}
                        disabled={sendingVerify}
                        className="rounded-lg border border-border bg-input px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted disabled:opacity-60"
                      >
                        {sendingVerify ? '发送中…' : '发送验证邮件'}
                      </button>
                    )}
                  </div>
                )
              : (
                  <p className="text-sm text-muted">
                    你使用的是第三方登录占位邮箱，请先在
                    {' '}
                    <Link href="/account/bind" className="text-primary hover:underline">绑定邮箱</Link>
                    {' '}
                    后再验证。
                  </p>
                )}
          </section>

          {profile.hasPassword && (
            <section className="rounded-2xl border border-border bg-surface p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
                <Shield className="h-4 w-4" />
                修改密码
              </div>
              <form onSubmit={changePassword} className="space-y-4">
                <input
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="当前密码"
                  required
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="新密码（至少 8 位）"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
                />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="确认新密码"
                  required
                  minLength={8}
                  className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
                />
                <button
                  type="submit"
                  disabled={changingPassword}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {changingPassword ? '更新中…' : '更新密码'}
                </button>
              </form>
            </section>
          )}

          {message && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
        </div>
      </div>
    </div>
  )
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center text-muted">加载中…</div>}>
      <AccountSettingsContent />
    </Suspense>
  )
}
