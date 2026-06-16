'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import { OAuthLoginButtons } from '@/components/oauth-login-buttons'
import { SiteLogo } from '@/components/site-logo'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const callbackUrl = searchParams.get('callbackUrl') ?? '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('邮箱或密码错误')
        return
      }

      router.push(callbackUrl)
      router.refresh()
    }
    catch {
      setError('登录失败，请稍后重试')
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
          <h1 className="text-xl font-semibold text-foreground">
            <SeedanceBrandText text="Seedance Studio" />
          </h1>
          <p className="text-sm text-muted">登录以继续使用 AI 视频工作流</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-foreground">
              邮箱
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
            />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="password" className="block text-sm font-medium text-foreground">
                密码
              </label>
              <Link href="/forgot-password" className="text-xs text-primary hover:underline">
                忘记密码？
              </Link>
            </div>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
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
            登录
          </button>
        </form>

        <OAuthLoginButtons callbackUrl={callbackUrl} />

        <p className="mt-6 text-center text-sm text-muted">
          还没有账号？
          {' '}
          <Link href="/register" className="font-medium text-primary hover:underline">
            邮箱注册
          </Link>
          {' '}
          · 飞书用户请直接点击上方飞书登录
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center text-muted">加载中…</div>}>
      <LoginForm />
    </Suspense>
  )
}
