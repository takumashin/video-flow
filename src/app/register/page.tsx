'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { signIn } from 'next-auth/react'
import { Loader2 } from 'lucide-react'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import { AuthPageLoading, AuthPageShell } from '@/components/auth-page-shell'
import { SiteLogo } from '@/components/site-logo'

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }

    if (password.length < 8) {
      setError('密码至少 8 位')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        setError(data.error || '注册失败')
        return
      }

      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      })

      if (result?.error) {
        setError('注册成功，但自动登录失败，请手动登录')
        router.push('/login')
        return
      }

      router.push('/')
      router.refresh()
    }
    catch {
      setError('注册失败，请稍后重试')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <AuthPageShell>
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <SiteLogo size={48} className="h-12 w-12 rounded-xl" />
          <h1 className="text-xl font-semibold text-foreground">创建账号</h1>
          <p className="text-sm text-muted">
            使用邮箱注册个人工作空间；飞书用户请前往
            {' '}
            <Link href="/login" className="font-medium text-primary hover:underline">
              登录页
            </Link>
            {' '}
            使用飞书登录（首次自动创建账号）
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="name" className="mb-1.5 block text-sm font-medium text-foreground">
              昵称（可选）
            </label>
            <input
              id="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none ring-primary/30 focus:ring-2"
            />
          </div>

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
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-foreground">
              密码
            </label>
            <input
              id="password"
              type="password"
              autoComplete="new-password"
              required
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
            注册
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          已有账号？
          {' '}
          <Link href="/login" className="font-medium text-primary hover:underline">
            去登录
          </Link>
        </p>
    </AuthPageShell>
  )
}
