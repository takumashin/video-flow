'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { SiteLogo } from '@/components/site-logo'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const emailParam = searchParams.get('email') ?? ''
  const tokenParam = searchParams.get('token') ?? ''

  const [email] = useState(emailParam)
  const [token] = useState(tokenParam)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, token, password, confirmPassword }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '重置失败')

      router.push('/login')
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '重置失败')
    }
    finally {
      setLoading(false)
    }
  }

  if (!email || !token) {
    return (
      <div className="flex min-h-full items-center justify-center p-6 text-muted">
        链接无效，请重新申请重置密码。
      </div>
    )
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <SiteLogo size={48} className="h-12 w-12 rounded-xl" />
          <h1 className="text-xl font-semibold text-foreground">设置新密码</h1>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input type="hidden" value={email} readOnly />
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="新密码（至少 8 位）"
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
          />
          <input
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            placeholder="确认新密码"
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
          />
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            更新密码
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="text-primary hover:underline">返回登录</Link>
        </p>
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center text-muted">加载中…</div>}>
      <ResetPasswordForm />
    </Suspense>
  )
}
