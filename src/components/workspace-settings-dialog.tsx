'use client'

import { useCallback, useEffect, useId, useState } from 'react'
import { Check, Copy, Link2, Loader2, Settings2, Trash2, UserPlus, X } from 'lucide-react'
import { useSession } from 'next-auth/react'
import { cn } from '@/lib/cn'
import { getRoleLabel } from '@/lib/workspace/permissions'

type Member = {
  userId: string
  name: string | null
  email: string
  role: 'owner' | 'admin' | 'member'
}

type Invite = {
  id: string
  inviteChannel: 'email' | 'feishu'
  email: string | null
  displayName: string | null
  role: 'admin' | 'member'
  expiresAt: string
  inviteUrl: string
}

type WorkspaceSettingsDialogProps = {
  open: boolean
  workspaceId: string | null
  workspaceName: string
  userRole: 'owner' | 'admin' | 'member' | null
  onClose: () => void
  onUpdated?: () => void
}

function ActiveInviteLinkCard({
  inviteUrl,
  copied,
  onCopy,
  onCancel,
}: {
  inviteUrl: string
  copied: boolean
  onCopy: () => void
  onCancel: () => void
}) {
  return (
    <div className="space-y-2 rounded-lg border border-primary-light/30 bg-primary/5 p-3">
      <p className="text-xs font-medium text-foreground">当前有效链接，请复制后发送给同事</p>
      <p className="break-all text-[11px] text-foreground/90">{inviteUrl}</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={onCopy}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted"
        >
          {copied
            ? <Check className="h-3.5 w-3.5 text-emerald-500" />
            : <Copy className="h-3.5 w-3.5" />}
          {copied ? '已复制' : '复制链接'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-red-500/30 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:bg-red-500/10 dark:text-red-400"
        >
          <X className="h-3.5 w-3.5" />
          作废链接
        </button>
      </div>
    </div>
  )
}

export default function WorkspaceSettingsDialog({
  open,
  workspaceId,
  workspaceName,
  userRole,
  onClose,
  onUpdated,
}: WorkspaceSettingsDialogProps) {
  const { update } = useSession()
  const titleId = useId()
  const [name, setName] = useState(workspaceName)
  const [members, setMembers] = useState<Member[]>([])
  const [linkInviteEnabled, setLinkInviteEnabled] = useState(false)
  const [invitePanelOpen, setInvitePanelOpen] = useState(false)
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member')
  const [activeInviteLink, setActiveInviteLink] = useState<string | null>(null)
  const [activeInviteId, setActiveInviteId] = useState<string | null>(null)
  const [copiedActiveLink, setCopiedActiveLink] = useState(false)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [inviting, setInviting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canManage = userRole === 'owner' || userRole === 'admin'
  const canDelete = userRole === 'owner'

  const fetchMembers = useCallback(async () => {
    if (!workspaceId || !canManage)
      return
    setLoading(true)
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`)
      const data = await response.json()
      if (response.ok) {
        setMembers(data.members ?? [])
        setLinkInviteEnabled(!!data.linkInviteEnabled)

        const invite = (data.invites?.[0] ?? null) as Invite | null
        if (invite) {
          setActiveInviteLink(invite.inviteUrl)
          setActiveInviteId(invite.id)
          setInviteRole(invite.role)
        }
        else {
          setActiveInviteLink(null)
          setActiveInviteId(null)
        }
      }
    }
    finally {
      setLoading(false)
    }
  }, [workspaceId, canManage])

  useEffect(() => {
    if (open) {
      setName(workspaceName)
      setError(null)
      setInvitePanelOpen(false)
      void fetchMembers()
    }
  }, [open, workspaceName, fetchMembers])

  const handleRename = async (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed)
      return

    setSaving(true)
    setError(null)
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '重命名失败')

      await update({ activeWorkspaceName: trimmed })
      onUpdated?.()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败')
    }
    finally {
      setSaving(false)
    }
  }

  const copyActiveLink = async () => {
    if (!activeInviteLink)
      return
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(activeInviteLink)
      }
      else {
        const textarea = document.createElement('textarea')
        textarea.value = activeInviteLink
        textarea.style.position = 'fixed'
        textarea.style.left = '-9999px'
        textarea.style.top = '-9999px'
        textarea.style.opacity = '0'
        document.body.appendChild(textarea)
        textarea.focus()
        textarea.select()
        const ok = document.execCommand('copy')
        document.body.removeChild(textarea)
        if (!ok)
          throw new Error('execCommand copy failed')
      }
      setCopiedActiveLink(true)
      window.setTimeout(() => setCopiedActiveLink(false), 2000)
    }
    catch {
      setError('复制失败，请手动选择链接复制')
    }
  }

  const handleCreateInviteLink = async () => {
    setInviting(true)
    setError(null)
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: inviteRole }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '生成失败')

      setActiveInviteLink(data.result?.inviteUrl ?? null)
      setActiveInviteId(data.result?.inviteId ?? null)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    }
    finally {
      setInviting(false)
    }
  }

  const removeMember = async (userId: string) => {
    if (!confirm('确定移除该成员？'))
      return

    const response = await fetch(`/api/workspaces/${workspaceId}/members/${userId}`, {
      method: 'DELETE',
    })
    const data = await response.json()
    if (!response.ok) {
      setError(data.error || '移除失败')
      return
    }
    await fetchMembers()
  }

  const cancelActiveInvite = async () => {
    if (!activeInviteId)
      return

    const response = await fetch(`/api/workspaces/${workspaceId}/invites/${activeInviteId}`, {
      method: 'DELETE',
    })
    if (response.ok) {
      setActiveInviteLink(null)
      setActiveInviteId(null)
    }
  }

  const handleDelete = async () => {
    if (!confirm(`确定删除工作空间「${workspaceName}」？此操作不可恢复。`))
      return

    setDeleting(true)
    setError(null)
    try {
      const response = await fetch(`/api/workspaces/${workspaceId}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '删除失败')

      onClose()
      window.location.href = '/'
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    finally {
      setDeleting(false)
    }
  }

  if (!open || !workspaceId)
    return null

  return (
    <div className="fixed inset-0 z-[230] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <button type="button" className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-label="关闭" />

      <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-border-subtle px-5 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10">
              <Settings2 className="h-4 w-4 text-primary" />
            </div>
            <div className="min-w-0">
              <h2 id={titleId} className="text-base font-semibold text-foreground">工作空间设置</h2>
              <p className="mt-0.5 truncate text-xs text-muted">{workspaceName}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="shrink-0 rounded-lg p-2 text-muted transition hover:bg-surface-muted hover:text-foreground" aria-label="关闭">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-5 py-4">
          {canManage && (
            <form onSubmit={handleRename} className="space-y-2">
              <label className="block text-sm font-medium text-foreground">名称</label>
              <div className="flex gap-2">
                <input
                  value={name}
                  onChange={e => setName(e.target.value)}
                  maxLength={40}
                  disabled={saving}
                  className="min-w-0 flex-1 rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none ring-primary/30 focus:ring-2 disabled:opacity-60"
                />
                <button
                  type="submit"
                  disabled={saving || !name.trim() || name.trim() === workspaceName}
                  className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {saving ? '保存中…' : '保存'}
                </button>
              </div>
            </form>
          )}

          {canManage && (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium text-foreground">成员</h3>
                {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" />}
              </div>

              <div className="space-y-1.5">
                {members.map(member => (
                  <div key={member.userId} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-foreground">{member.name || member.email}</p>
                      <p className="truncate text-xs text-muted">{member.email}</p>
                    </div>
                    <span className="shrink-0 text-xs text-muted">{getRoleLabel(member.role)}</span>
                    {member.role !== 'owner' && userRole === 'owner' && (
                      <button
                        type="button"
                        onClick={() => removeMember(member.userId)}
                        className="shrink-0 rounded-md p-1 text-muted hover:bg-red-500/10 hover:text-red-500"
                        aria-label="移除成员"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                    {member.role === 'member' && userRole === 'admin' && (
                      <button
                        type="button"
                        onClick={() => removeMember(member.userId)}
                        className="shrink-0 rounded-md p-1 text-muted hover:bg-red-500/10 hover:text-red-500"
                        aria-label="移除成员"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>

              {!invitePanelOpen
                ? (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setInvitePanelOpen(true)}
                        className="flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-surface-muted/40 px-3 py-2.5 text-sm font-medium text-foreground transition hover:border-primary/40 hover:bg-surface-muted"
                      >
                        <UserPlus className="h-4 w-4" />
                        {activeInviteLink ? '管理邀请链接' : '邀请成员'}
                      </button>
                      {activeInviteLink && (
                        <ActiveInviteLinkCard
                          inviteUrl={activeInviteLink}
                          copied={copiedActiveLink}
                          onCopy={() => void copyActiveLink()}
                          onCancel={() => void cancelActiveInvite()}
                        />
                      )}
                    </div>
                  )
                : (
                    <div className="space-y-2 rounded-lg border border-border bg-surface-muted/50 p-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="flex items-center gap-1.5 text-sm font-medium text-foreground">
                            <Link2 className="h-4 w-4" />
                            协作邀请链接
                          </p>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted">
                            点击生成后复制链接，自行粘贴到飞书群或私聊发送。重新生成后，旧链接会立即失效。
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setInvitePanelOpen(false)}
                          className="shrink-0 rounded-md p-1 text-muted transition hover:bg-surface-muted hover:text-foreground"
                          aria-label="收起邀请"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>

                      {!linkInviteEnabled && (
                        <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                          需先配置飞书登录（AUTH_FEISHU_APP_ID / AUTH_FEISHU_APP_SECRET）才能生成邀请链接。
                        </p>
                      )}

                      <select
                        value={inviteRole}
                        onChange={e => setInviteRole(e.target.value as 'admin' | 'member')}
                        disabled={inviting || userRole !== 'owner' || !linkInviteEnabled}
                        className="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
                      >
                        <option value="member">成员</option>
                        <option value="admin">管理员</option>
                      </select>

                      <button
                        type="button"
                        onClick={() => void handleCreateInviteLink()}
                        disabled={inviting || !linkInviteEnabled}
                        className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                      >
                        {inviting
                          ? <Loader2 className="h-4 w-4 animate-spin" />
                          : <UserPlus className="h-4 w-4" />}
                        {activeInviteLink ? '重新生成邀请链接' : '生成邀请链接'}
                      </button>

                      {activeInviteLink && (
                        <ActiveInviteLinkCard
                          inviteUrl={activeInviteLink}
                          copied={copiedActiveLink}
                          onCopy={() => void copyActiveLink()}
                          onCancel={() => void cancelActiveInvite()}
                        />
                      )}
                    </div>
                  )}
            </div>
          )}

          {canDelete && (
            <div className="rounded-lg border border-red-500/20 bg-red-500/5 p-3">
              <p className="text-sm font-medium text-red-600 dark:text-red-400">危险操作</p>
              <p className="mt-1 text-xs text-muted">删除后，该空间内的工作流与资产将无法恢复。</p>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/10 disabled:opacity-60 dark:text-red-400',
                )}
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                删除工作空间
              </button>
            </div>
          )}

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-500">{error}</p>
          )}
        </div>
      </div>
    </div>
  )
}
