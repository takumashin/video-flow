'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import { Suspense, useEffect, useState } from 'react'
import { Loader2, ShieldCheck } from 'lucide-react'
import { SiteLogo } from '@/components/site-logo'
import { SeedanceBrandText } from '@/components/seedance-brand-text'

type BindingStatus = {
  needsBinding: boolean
  email: string
  emailEditable: boolean
  hasPassword: boolean
}

function BindAccountForm() {
  const router = useRouter()
  const { data: session, status, update } = useSession()
  const [bindingStatus, setBindingStatus] = useState<BindingStatus | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login')
      return
    }

    if (status !== 'authenticated')
      return

    fetch('/api/auth/account-status')
      .then(res => res.json())
      .then((data: BindingStatus) => {
        if (!data.needsBinding) {
          router.replace('/')
          return
        }
        setBindingStatus(data)
        setEmail(data.emailEditable ? '' : data.email)
      })
      .catch(() => setError('加载账号信息失败'))
  }, [status, router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/bind-credentials', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, confirmPassword }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '绑定失败')
        return
      }

      await update({ needsAccountBinding: false })
      router.push('/')
      router.refresh()
    }
    catch {
      setError('绑定失败，请稍后重试')
    }
    finally {
      setLoading(false)
    }
  }

  if (status === 'loading' || !bindingStatus) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载中…
      </div>
    )
  }

  const displayName = session?.user?.name ?? '第三方账号'

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
            <ShieldCheck className="h-6 w-6 text-primary" />
          </div>
          <h1 className="text-xl font-semibold text-foreground">完善账号信息</h1>
          <p className="text-sm leading-relaxed text-muted">
            你已通过第三方登录（
            {displayName}
            ）。绑定邮箱和密码后，可用邮箱登录并在更换设备时找回账号。
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
              绑定邮箱
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              readOnly={!bindingStatus.emailEditable}
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder={bindingStatus.emailEditable ? 'name@example.com' : undefined}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 read-only:cursor-default read-only:opacity-80 focus:ring-2"
            />
            {!bindingStatus.emailEditable && (
              <p className="mt-1.5 text-xs text-muted">邮箱来自飞书授权，如需修改请联系管理员</p>
            )}
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
              设置密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
            />
          </div>

          <div>
            <label htmlFor="confirmPassword" className="mb-1.5 block text-sm font-medium text-foreground">
              确认密码
            </label>
            <input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            完成绑定并进入 Studio
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-muted">
          绑定完成后，下次可直接用邮箱密码登录
          {' '}
          <SeedanceBrandText text="Seedance Studio" />
        </p>
      </div>
    </div>
  )
}

export default function BindAccountPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center text-muted">加载中…</div>}>
      <BindAccountForm />
    </Suspense>
  )
}
