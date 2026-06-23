'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronDown,
  GitBranch,
  GitMerge,
  History,
  Loader2,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { btnCompactClass, dropdownAnchorClass, dropdownClass } from '@/lib/ui-classes'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'

export default function WorkflowFileMenu() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const activeSession = useActiveWorkflowSession()
  const workflowId = activeSession?.workflowId ?? null
  const isRunning = activeSession?.isRunning ?? false

  const activeBranch = useWorkflowVersionStore(s => s.activeBranch)
  const branches = useWorkflowVersionStore(s => s.branches)
  const actionLoading = useWorkflowVersionStore(s => s.actionLoading)
  const loadBranches = useWorkflowVersionStore(s => s.loadBranches)
  const setActiveBranch = useWorkflowVersionStore(s => s.setActiveBranch)
  const checkoutBranch = useWorkflowVersionStore(s => s.checkoutBranch)
  const openBranchesModal = useWorkflowVersionStore(s => s.openBranchesModal)
  const openVersionPanel = useWorkflowVersionStore(s => s.openVersionPanel)
  const resetForWorkflow = useWorkflowVersionStore(s => s.resetForWorkflow)

  useEffect(() => {
    if (!workflowId) {
      resetForWorkflow(null)
      return
    }
    setActiveBranch(activeSession?.branchName ?? 'main')
    void loadBranches(workflowId, { status: 'active' })
  }, [workflowId, activeSession?.branchName]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node))
        setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!workflowId || !activeSession) return null

  const activeBranches = branches.filter(b => b.isMain || b.status === 'active')
  const quickBranches = activeBranches
    .filter(b => b.name !== activeBranch)
    .slice(0, 4)

  const handleCheckout = async (targetBranch: string) => {
    if (targetBranch === activeBranch || isRunning || actionLoading)
      return

    await checkoutBranch(
      workflowId,
      activeSession.id,
      targetBranch,
      {
        name: activeSession.name,
        nodes: activeSession.nodes,
        edges: activeSession.edges,
        revision: activeSession.revision ?? 0,
      },
    )
    setOpen(false)
  }

  const currentBranchMeta = branches.find(b => b.name === activeBranch)

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        disabled={actionLoading}
        className={cn(
          btnCompactClass,
          open && 'border-primary-light bg-primary/10 text-primary-light',
        )}
        title={`当前分支: ${activeBranch}`}
      >
        {actionLoading
          ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
          : <GitBranch className="h-3.5 w-3.5" />}
        <span className="max-w-[100px] truncate">{activeBranch}</span>
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className={cn(dropdownAnchorClass('below', 'right'), dropdownClass, 'w-64')}>
          <div className="border-b border-border px-3 py-2.5">
            <p className="text-[10px] font-medium uppercase tracking-wide text-muted">当前分支</p>
            <div className="mt-1 flex items-center gap-2">
              <GitBranch className="h-3.5 w-3.5 text-primary-light" />
              <span className="truncate text-sm font-medium text-foreground">{activeBranch}</span>
              {currentBranchMeta?.isMain && (
                <span className="shrink-0 rounded bg-surface-muted px-1.5 py-0.5 text-[10px] text-muted">主分支</span>
              )}
            </div>
            {currentBranchMeta && currentBranchMeta.latestRevision > 0 && (
              <p className="mt-1 text-[10px] text-muted">
                修订 r{currentBranchMeta.latestRevision}
              </p>
            )}
          </div>

          {quickBranches.length > 0 && (
            <div className="border-b border-border p-1">
              <p className="px-2 py-1 text-[10px] font-medium uppercase text-muted">快速切换</p>
              {quickBranches.map(branch => (
                <button
                  key={branch.name}
                  type="button"
                  disabled={isRunning || actionLoading}
                  onClick={() => void handleCheckout(branch.name)}
                  className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-xs text-foreground transition hover:bg-surface-muted disabled:opacity-40"
                >
                  <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted" />
                  <span className="truncate">{branch.name}</span>
                </button>
              ))}
            </div>
          )}

          <div className="p-1">
            <button
              type="button"
              onClick={() => { openBranchesModal(); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-surface-muted"
            >
              <GitMerge className="h-3.5 w-3.5 text-muted" />
              管理分支…
            </button>
            <button
              type="button"
              onClick={() => { openVersionPanel(); setOpen(false) }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs text-foreground transition hover:bg-surface-muted"
            >
              <History className="h-3.5 w-3.5 text-muted" />
              版本历史
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
