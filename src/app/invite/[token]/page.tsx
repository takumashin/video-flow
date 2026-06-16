'use client'

import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { Suspense, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { signIn, useSession } from 'next-auth/react'
import { SiteLogo } from '@/components/site-logo'
import { getRoleLabel } from '@/lib/workspace/permissions'

type InviteInfo = {
  inviteChannel: 'email' | 'feishu'
  email: string | null
  displayName: string | null
  role: 'admin' | 'member'
  workspaceName: string
}

function InviteAcceptContent() {
  const params = useParams<{ token: string }>()
  const router = useRouter()
  const { status, update } = useSession()
  const token = params.token

  const [invite, setInvite] = useState<InviteInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [accepting, setAccepting] = useState(false)

  useEffect(() => {
    fetch(`/api/workspaces/invites/${token}`)
      .then(async (res) => {
        const data = await res.json()
        if (!res.ok)
          throw new Error(data.error || '邀请无效')
        setInvite(data.invite)
      })
      .catch(err => setError(err instanceof Error ? err.message : '邀请无效'))
  }, [token])

  const acceptInvite = async () => {
    setAccepting(true)
    setError(null)
    try {
      const response = await fetch(`/api/workspaces/invites/${token}`, { method: 'POST' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '接受失败')

      await update({ activeWorkspaceId: data.workspaceId })
      router.push('/')
      router.refresh()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '接受失败')
    }
    finally {
      setAccepting(false)
    }
  }

  if (error && !invite) {
    return (
      <div className="flex min-h-full items-center justify-center p-6">
        <div className="max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-xl">
          <p className="text-sm text-red-500">{error}</p>
          <Link href="/" className="mt-4 inline-block text-sm text-primary hover:underline">返回首页</Link>
        </div>
      </div>
    )
  }

  if (!invite) {
    return (
      <div className="flex min-h-full items-center justify-center text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载邀请信息…
      </div>
    )
  }

  const loggedIn = status === 'authenticated'
  const isFeishuInvite = invite.inviteChannel === 'feishu'

  return (
    <div className="flex min-h-full items-center justify-center bg-background p-6">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <SiteLogo size={48} className="h-12 w-12 rounded-xl" />
          <h1 className="text-xl font-semibold text-foreground">加入工作空间</h1>
          <p className="text-sm leading-relaxed text-muted">
            你被邀请加入「
            {invite.workspaceName}
            」，角色：
            {getRoleLabel(invite.role)}
          </p>
          {isFeishuInvite && (
            <p className="text-xs text-muted">
              请使用飞书账号登录并接受邀请
            </p>
          )}
        </div>

        {!loggedIn && (
          <div className="space-y-3">
            {isFeishuInvite
              ? (
                  <button
                    type="button"
                    onClick={() => signIn('feishu', { callbackUrl: `/invite/${token}` })}
                    className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white"
                  >
                    飞书登录并加入
                  </button>
                )
              : (
                  <>
                    <Link
                      href={`/login?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                      className="flex w-full items-center justify-center rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white"
                    >
                      登录
                    </Link>
                    <Link
                      href={`/register?callbackUrl=${encodeURIComponent(`/invite/${token}`)}`}
                      className="flex w-full items-center justify-center rounded-lg border border-border bg-input px-4 py-2.5 text-sm font-medium text-foreground"
                    >
                      注册新账号
                    </Link>
                  </>
                )}
          </div>
        )}

        {loggedIn && (
          <div className="space-y-3">
            <button
              type="button"
              disabled={accepting}
              onClick={acceptInvite}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-white disabled:opacity-60"
            >
              {accepting && <Loader2 className="h-4 w-4 animate-spin" />}
              接受邀请并进入工作空间
            </button>
            {isFeishuInvite && (
              <button
                type="button"
                onClick={() => signIn('feishu', { callbackUrl: `/invite/${token}` })}
                className="w-full rounded-lg border border-border px-4 py-2 text-sm text-foreground"
              >
                切换飞书账号
              </button>
            )}
          </div>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>}
      </div>
    </div>
  )
}

export default function InvitePage() {
  return (
    <Suspense fallback={<div className="flex min-h-full items-center justify-center text-muted">加载中…</div>}>
      <InviteAcceptContent />
    </Suspense>
  )
}
