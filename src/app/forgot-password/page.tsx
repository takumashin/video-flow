'use client'

import Link from 'next/link'
import { Suspense, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { SiteLogo } from '@/components/site-logo'

function ForgotPasswordForm() {
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '请求失败')
      setMessage(data.message)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '请求失败')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <SiteLogo size={48} className="h-12 w-12 rounded-xl" />
          <h1 className="text-xl font-semibold text-foreground">忘记密码</h1>
          <p className="text-sm text-muted">输入注册邮箱，我们将发送重置链接</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <input
            type="email"
            required
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
          />
          {message && <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">{message}</p>}
          {error && <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60">
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            发送重置邮件
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/login" className="text-primary hover:underline">返回登录</Link>
        </p>
      </div>
    </div>
  )
}

export default function ForgotPasswordPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center text-muted">加载中…</div>}>
      <ForgotPasswordForm />
    </Suspense>
  )
}
