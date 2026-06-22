'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown, GitBranch, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'

export default function BranchSelector() {
  const [open, setOpen] = useState(false)
  const [inputOpen, setInputOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const panelRef = useRef<HTMLDivElement>(null)

  const activeBranch = useWorkflowVersionStore(s => s.activeBranch)
  const branches = useWorkflowVersionStore(s => s.branches)
  const loadBranches = useWorkflowVersionStore(s => s.loadBranches)
  const createBranch = useWorkflowVersionStore(s => s.createBranch)
  const setActiveBranch = useWorkflowVersionStore(s => s.setActiveBranch)
  const actionLoading = useWorkflowVersionStore(s => s.actionLoading)

  const activeSession = useActiveWorkflowSession()
  const workflowId = activeSession?.workflowId ?? null

  // Load branches when workflow changes
  useEffect(() => {
    if (workflowId) {
      void loadBranches(workflowId)
    }
  }, [workflowId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close on outside click
  useEffect(() => {
    if (!open) return
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        setOpen(false)
        setInputOpen(false)
        setNewName('')
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  if (!workflowId) return null

  const handleCreateBranch = async () => {
    if (!newName.trim()) return
    // Use the latest version on the current branch as source
    const currentBranch = branches.find(b => b.name === activeBranch)
    const sourceVersionId = currentBranch?.latestVersionId
    if (!sourceVersionId) return

    await createBranch(workflowId, newName.trim(), sourceVersionId)
    setNewName('')
    setInputOpen(false)
  }

  const handleSwitch = (branch: string) => {
    setActiveBranch(branch)
    setOpen(false)
  }

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border border-border bg-input px-2.5 py-1.5 text-xs font-medium text-foreground transition hover:bg-surface-muted',
          open && 'border-primary-light bg-primary/10 text-primary-light',
        )}
        title={`当前分支: ${activeBranch}`}
      >
        <GitBranch className="h-3.5 w-3.5" />
        <span className="max-w-[80px] truncate">{activeBranch}</span>
        <ChevronDown className={cn('h-3 w-3 transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-[110] mt-2 w-56 overflow-hidden rounded-xl border border-border bg-surface shadow-xl">
          <div className="border-b border-border px-3 py-2">
            <p className="text-[10px] font-medium text-muted uppercase">分支</p>
          </div>

          <div className="max-h-48 overflow-y-auto p-1">
            {branches.map(branch => (
              <button
                key={branch.name}
                type="button"
                onClick={() => handleSwitch(branch.name)}
                className={cn(
                  'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-xs transition',
                  branch.name === activeBranch
                    ? 'bg-primary/10 text-primary-light font-medium'
                    : 'text-foreground hover:bg-surface-muted',
                )}
              >
                <GitBranch className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate flex-1">{branch.name}</span>
                {branch.latestRevision > 0 && (
                  <span className="text-[10px] text-muted">r{branch.latestRevision}</span>
                )}
              </button>
            ))}
          </div>

          {/* New branch input */}
          {inputOpen
            ? (
                <div className="flex items-center gap-1 border-t border-border px-2 py-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="分支名称..."
                    className="nodrag nowheel nokey flex-1 rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-primary-light"
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') void handleCreateBranch() }}
                  />
                  <button
                    type="button"
                    onClick={() => { setInputOpen(false); setNewName('') }}
                    disabled={actionLoading}
                    className="rounded px-1.5 py-0.5 text-[10px] text-muted hover:text-foreground"
                  >
                    取消
                  </button>
                </div>
              )
            : (
                <button
                  type="button"
                  onClick={() => setInputOpen(true)}
                  className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-xs text-muted hover:bg-surface-muted hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                  新建分支...
                </button>
              )}
        </div>
      )}
    </div>
  )
}
