'use client'

import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { AuthPageLoading, AuthPageShell } from '@/components/auth-page-shell'
import { SiteLogo } from '@/components/site-logo'

function VerifyEmailContent() {
  const searchParams = useSearchParams()
  const token = searchParams.get('token')
  const uid = searchParams.get('uid')
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token || !uid) {
      setStatus('error')
      setMessage('验证链接无效')
      return
    }

    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}&uid=${encodeURIComponent(uid)}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok)
          throw new Error(data.error || '验证失败')
        setStatus('success')
        setMessage('邮箱验证成功')
      })
      .catch(err => {
        setStatus('error')
        setMessage(err instanceof Error ? err.message : '验证失败')
      })
  }, [token, uid])

  return (
    <AuthPageShell>
      <div className="text-center">
        <SiteLogo size={48} className="mx-auto mb-4 h-12 w-12 rounded-xl" />
        {status === 'loading' && (
          <div className="flex items-center justify-center gap-2 text-muted">
            <Loader2 className="h-4 w-4 animate-spin" />
            正在验证邮箱…
          </div>
        )}
        {status !== 'loading' && (
          <p className={`text-sm ${status === 'success' ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{message}</p>
        )}
        <div className="mt-6 flex justify-center gap-4 text-sm">
          <Link href="/account" className="text-primary hover:underline">账号设置</Link>
          <Link href="/" className="text-primary hover:underline">返回 Studio</Link>
        </div>
      </div>
    </AuthPageShell>
  )
}

export default function VerifyEmailPage() {
  return (
    <Suspense fallback={<AuthPageLoading />}>
      <VerifyEmailContent />
    </Suspense>
  )
}
