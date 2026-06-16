'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useSession } from 'next-auth/react'
import { Check, ChevronDown, Loader2, Plus, Settings2 } from 'lucide-react'
import CreateWorkspaceDialog from '@/components/create-workspace-dialog'
import WorkspaceSettingsDialog from '@/components/workspace-settings-dialog'
import { cn } from '@/lib/cn'
import { btnCompactClass, dropdownAnchorClass } from '@/lib/ui-classes'

type WorkspaceItem = {
  id: string
  name: string
  slug: string
  role: 'owner' | 'admin' | 'member'
}

export default function WorkspaceSwitcher({
  compact = false,
  menuPlacement = 'below',
}: {
  compact?: boolean
  menuPlacement?: 'above' | 'below'
}) {
  const { data: session, update } = useSession()
  const [open, setOpen] = useState(false)
  const [createDialogOpen, setCreateDialogOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceItem[]>([])
  const [loading, setLoading] = useState(false)
  const [creating, setCreating] = useState(false)
  const [switchingId, setSwitchingId] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const activeId = session?.activeWorkspaceId
  const activeName = session?.activeWorkspaceName ?? '工作空间'
  const activeRole = session?.activeWorkspaceRole ?? null
  const canManageWorkspace = activeRole === 'owner' || activeRole === 'admin'

  const fetchWorkspaces = useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/workspaces')
      const data = await response.json()
      if (response.ok)
        setWorkspaces(data.workspaces ?? [])
    }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session?.user)
      fetchWorkspaces()
  }, [session?.user, fetchWorkspaces])

  useEffect(() => {
    if (!open)
      return

    const handleClick = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node))
        setOpen(false)
    }

    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  const switchWorkspace = async (workspaceId: string) => {
    if (workspaceId === activeId) {
      setOpen(false)
      return
    }

    setSwitchingId(workspaceId)
    try {
      const response = await fetch('/api/workspaces/active', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceId }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '切换失败')

      await update({ activeWorkspaceId: workspaceId })
      setOpen(false)
      window.location.reload()
    }
    catch (error) {
      console.error(error)
    }
    finally {
      setSwitchingId(null)
    }
  }

  const openCreateDialog = () => {
    setCreateError(null)
    setCreateDialogOpen(true)
    setOpen(false)
  }

  const closeCreateDialog = () => {
    if (creating)
      return
    setCreateDialogOpen(false)
    setCreateError(null)
  }

  const createWorkspace = async (name: string) => {
    setCreating(true)
    setCreateError(null)
    try {
      const response = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '创建失败')

      setCreateDialogOpen(false)
      await fetchWorkspaces()
      if (data.workspace?.id)
        await switchWorkspace(data.workspace.id)
    }
    catch (error) {
      setCreateError(error instanceof Error ? error.message : '创建失败')
    }
    finally {
      setCreating(false)
    }
  }

  return (
    <>
      <div ref={panelRef} className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className={cn(
            'inline-flex max-w-[200px] items-center gap-1.5 rounded-lg border border-border bg-input font-medium text-foreground shadow-sm transition hover:bg-surface-muted',
            compact ? btnCompactClass : 'px-3 py-2 text-sm',
          )}
        >
          <span className="truncate">{activeName}</span>
          <ChevronDown className={cn('shrink-0 transition', compact ? 'h-3.5 w-3.5' : 'h-4 w-4', open && 'rotate-180')} />
        </button>

        {open && (
          <div className={cn(dropdownAnchorClass(menuPlacement, 'right'), 'w-64 rounded-xl border border-border bg-surface-elevated p-1 shadow-xl')}>
            {loading && (
              <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted">
                <Loader2 className="h-4 w-4 animate-spin" />
                加载中…
              </div>
            )}

            {!loading && workspaces.map(item => (
              <button
                key={item.id}
                type="button"
                disabled={switchingId === item.id}
                onClick={() => switchWorkspace(item.id)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-foreground transition hover:bg-surface-muted disabled:opacity-60"
              >
                <span className="min-w-0 flex-1 truncate">{item.name}</span>
                {item.id === activeId && <Check className="h-4 w-4 shrink-0 text-primary" />}
                {switchingId === item.id && <Loader2 className="h-4 w-4 shrink-0 animate-spin" />}
              </button>
            ))}

            <div className="my-1 border-t border-border" />

            {canManageWorkspace && activeId && (
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(true)
                  setOpen(false)
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted"
              >
                <Settings2 className="h-4 w-4" />
                管理工作空间
              </button>
            )}

            <button
              type="button"
              disabled={creating}
              onClick={openCreateDialog}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground transition hover:bg-surface-muted disabled:opacity-60"
            >
              <Plus className="h-4 w-4" />
              创建工作空间
            </button>
          </div>
        )}
      </div>

      <CreateWorkspaceDialog
        open={createDialogOpen}
        creating={creating}
        error={createError}
        onClose={closeCreateDialog}
        onSubmit={createWorkspace}
      />

      <WorkspaceSettingsDialog
        open={settingsOpen}
        workspaceId={activeId ?? null}
        workspaceName={activeName}
        userRole={activeRole}
        onClose={() => setSettingsOpen(false)}
        onUpdated={() => fetchWorkspaces()}
      />
    </>
  )
}
