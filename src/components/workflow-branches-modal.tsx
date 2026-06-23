'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Archive,
  Check,
  GitBranch,
  GitMerge,
  Loader2,
  MoreHorizontal,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { inputClass } from '@/lib/ui-classes'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'
import type { WorkflowBranch } from '@/lib/types'

function relativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const seconds = Math.floor(diff / 1000)
  if (seconds < 60) return '刚刚'
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days} 天前`
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function BranchStatusBadge({ branch }: { branch: WorkflowBranch }) {
  if (branch.isMain) {
    return <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] font-medium text-primary-light">主分支</span>
  }
  if (branch.status === 'merged') {
    return <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-600">已合并</span>
  }
  if (branch.status === 'archived') {
    return <span className="rounded bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium text-muted">已归档</span>
  }
  return null
}

export default function WorkflowBranchesModal() {
  const branchesModalOpen = useWorkflowVersionStore(s => s.branchesModalOpen)
  const closeBranchesModal = useWorkflowVersionStore(s => s.closeBranchesModal)
  const branchTab = useWorkflowVersionStore(s => s.branchTab)
  const setBranchTab = useWorkflowVersionStore(s => s.setBranchTab)
  const activeBranch = useWorkflowVersionStore(s => s.activeBranch)
  const branches = useWorkflowVersionStore(s => s.branches)
  const actionLoading = useWorkflowVersionStore(s => s.actionLoading)
  const error = useWorkflowVersionStore(s => s.error)
  const clearError = useWorkflowVersionStore(s => s.clearError)
  const loadBranches = useWorkflowVersionStore(s => s.loadBranches)
  const checkoutBranch = useWorkflowVersionStore(s => s.checkoutBranch)
  const createBranch = useWorkflowVersionStore(s => s.createBranch)
  const archiveBranch = useWorkflowVersionStore(s => s.archiveBranch)
  const restoreBranch = useWorkflowVersionStore(s => s.restoreBranch)
  const renameBranch = useWorkflowVersionStore(s => s.renameBranch)
  const openMergeModal = useWorkflowVersionStore(s => s.openMergeModal)

  const activeSession = useActiveWorkflowSession()
  const workflowId = activeSession?.workflowId ?? null
  const isRunning = activeSession?.isRunning ?? false

  const [search, setSearch] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newDescription, setNewDescription] = useState('')
  const [menuBranch, setMenuBranch] = useState<string | null>(null)
  const [renamingBranch, setRenamingBranch] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!branchesModalOpen || !workflowId) return
    const status = branchTab === 'active' ? 'active' : branchTab === 'archived' ? 'archived' : 'all'
    const mine = branchTab === 'mine'
    void loadBranches(workflowId, { status, mine })
  }, [branchesModalOpen, workflowId, branchTab]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!branchesModalOpen) {
      setSearch('')
      setCreateOpen(false)
      setNewName('')
      setNewDescription('')
      setMenuBranch(null)
      setRenamingBranch(null)
    }
  }, [branchesModalOpen])

  const filteredBranches = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return branches
    return branches.filter(b =>
      b.name.toLowerCase().includes(q)
      || b.description?.toLowerCase().includes(q)
      || b.createdByName?.toLowerCase().includes(q),
    )
  }, [branches, search])

  if (!branchesModalOpen || !workflowId || !activeSession) return null

  const handleCheckout = async (targetBranch: string) => {
    if (targetBranch === activeBranch || isRunning) return
    const ok = await checkoutBranch(
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
    if (ok)
      closeBranchesModal()
  }

  const handleCreate = async () => {
    if (!newName.trim()) return
    const branch = await createBranch(workflowId, newName.trim(), newDescription.trim() || undefined)
    if (branch) {
      setNewName('')
      setNewDescription('')
      setCreateOpen(false)
      await handleCheckout(branch.name)
    }
  }

  const handleRename = async (oldName: string) => {
    if (!renameValue.trim() || renameValue.trim() === oldName) {
      setRenamingBranch(null)
      return
    }
    const ok = await renameBranch(workflowId, oldName, renameValue.trim())
    if (ok)
      setRenamingBranch(null)
  }

  const tabs = [
    { id: 'active' as const, label: '活跃' },
    { id: 'mine' as const, label: '我的' },
    { id: 'archived' as const, label: '已归档' },
  ]

  return (
    <div className="fixed inset-0 z-[205] flex items-center justify-center bg-black/45 p-4">
      <div className="flex h-[min(640px,85vh)] w-full max-w-xl flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <GitBranch className="h-5 w-5 text-primary-light" />
            <h2 className="text-base font-semibold text-foreground">分支</h2>
          </div>
          <button
            type="button"
            onClick={closeBranchesModal}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border px-5 py-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="搜索分支…"
              className={cn(inputClass, 'pl-8')}
            />
          </div>
        </div>

        <div className="flex gap-1 border-b border-border px-5 py-2">
          {tabs.map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setBranchTab(tab.id)}
              className={cn(
                'rounded-md px-3 py-1.5 text-xs font-medium transition',
                branchTab === tab.id
                  ? 'bg-primary/15 text-primary-light'
                  : 'text-muted hover:bg-surface-muted hover:text-foreground',
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {error && (
          <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={clearError} className="text-red-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-2">
          {filteredBranches.length === 0
            ? (
                <div className="py-16 text-center">
                  <GitBranch className="mx-auto h-8 w-8 text-muted/40" />
                  <p className="mt-2 text-sm text-muted">
                    {search ? '没有匹配的分支' : '暂无分支'}
                  </p>
                </div>
              )
            : (
                filteredBranches.map(branch => (
                  <BranchRow
                    key={branch.name}
                    branch={branch}
                    isCurrent={branch.name === activeBranch}
                    isRunning={isRunning}
                    actionLoading={actionLoading}
                    menuOpen={menuBranch === branch.name}
                    isRenaming={renamingBranch === branch.name}
                    renameValue={renameValue}
                    onToggleMenu={() => setMenuBranch(menuBranch === branch.name ? null : branch.name)}
                    onRenameValueChange={setRenameValue}
                    onStartRename={() => {
                      setRenamingBranch(branch.name)
                      setRenameValue(branch.name)
                      setMenuBranch(null)
                    }}
                    onConfirmRename={() => void handleRename(branch.name)}
                    onCancelRename={() => setRenamingBranch(null)}
                    onCheckout={() => void handleCheckout(branch.name)}
                    onMerge={() => {
                      setMenuBranch(null)
                      openMergeModal(branch.name)
                    }}
                    onArchive={() => void archiveBranch(workflowId, branch.name)}
                    onRestore={() => void restoreBranch(workflowId, branch.name)}
                  />
                ))
              )}
        </div>

        <div className="border-t border-border px-5 py-3">
          {createOpen
            ? (
                <div className="space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder="分支名称"
                    className={inputClass}
                    autoFocus
                    onKeyDown={e => { if (e.key === 'Enter') void handleCreate() }}
                  />
                  <input
                    type="text"
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="描述（可选）"
                    className={inputClass}
                  />
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => { setCreateOpen(false); setNewName(''); setNewDescription('') }}
                      className="rounded-lg px-3 py-1.5 text-xs text-muted hover:text-foreground"
                    >
                      取消
                    </button>
                    <button
                      type="button"
                      disabled={!newName.trim() || actionLoading}
                      onClick={() => void handleCreate()}
                      className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                    >
                      {actionLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : '创建并打开'}
                    </button>
                  </div>
                </div>
              )
            : (
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  disabled={isRunning}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-border px-3 py-2 text-xs font-medium text-foreground transition hover:bg-surface-muted disabled:opacity-40"
                >
                  <Plus className="h-3.5 w-3.5" />
                  从当前文件创建分支
                </button>
              )}
        </div>
      </div>
    </div>
  )
}

function BranchRow({
  branch,
  isCurrent,
  isRunning,
  actionLoading,
  menuOpen,
  isRenaming,
  renameValue,
  onToggleMenu,
  onRenameValueChange,
  onStartRename,
  onConfirmRename,
  onCancelRename,
  onCheckout,
  onMerge,
  onArchive,
  onRestore,
}: {
  branch: WorkflowBranch
  isCurrent: boolean
  isRunning: boolean
  actionLoading: boolean
  menuOpen: boolean
  isRenaming: boolean
  renameValue: string
  onToggleMenu: () => void
  onRenameValueChange: (value: string) => void
  onStartRename: () => void
  onConfirmRename: () => void
  onCancelRename: () => void
  onCheckout: () => void
  onMerge: () => void
  onArchive: () => void
  onRestore: () => void
}) {
  const canOpen = !isCurrent && (branch.isMain || branch.status === 'active')
  const canMerge = branch.status === 'active' && !branch.isMain
  const canArchive = branch.status === 'active' && !branch.isMain
  const canRestore = branch.status === 'archived'
  const canRename = !branch.isMain && branch.status === 'active'

  return (
    <div
      className={cn(
        'relative mb-1 flex items-start gap-3 rounded-xl border px-3 py-3 transition',
        isCurrent ? 'border-primary-light/40 bg-primary/5' : 'border-transparent hover:bg-surface-muted',
      )}
    >
      <div className="mt-0.5 shrink-0">
        {isCurrent
          ? <Check className="h-4 w-4 text-primary-light" />
          : <GitBranch className="h-4 w-4 text-muted" />}
      </div>

      <div className="min-w-0 flex-1">
        {isRenaming
          ? (
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={renameValue}
                  onChange={e => onRenameValueChange(e.target.value)}
                  className={cn(inputClass, 'flex-1')}
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') onConfirmRename()
                    if (e.key === 'Escape') onCancelRename()
                  }}
                />
                <button
                  type="button"
                  onClick={onConfirmRename}
                  disabled={actionLoading}
                  className="rounded-md bg-primary px-2 py-1 text-[10px] text-white"
                >
                  保存
                </button>
              </div>
            )
          : (
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-medium text-foreground">{branch.name}</span>
                <BranchStatusBadge branch={branch} />
                {isCurrent && (
                  <span className="text-[10px] text-primary-light">当前</span>
                )}
              </div>
            )}

        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[10px] text-muted">
          {branch.createdByName && <span>{branch.createdByName}</span>}
          {branch.createdByName && <span>·</span>}
          <span>更新于 {relativeTime(branch.updatedAt)}</span>
          {branch.latestRevision > 0 && (
            <>
              <span>·</span>
              <span>r{branch.latestRevision}</span>
            </>
          )}
        </div>
        {branch.description && (
          <p className="mt-1 text-[11px] text-muted/80">{branch.description}</p>
        )}
      </div>

      <div className="relative shrink-0">
        {!branch.isMain && (
          <button
            type="button"
            onClick={onToggleMenu}
            disabled={actionLoading}
            className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-foreground"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        )}

        {canOpen && !isCurrent && (
          <button
            type="button"
            onClick={onCheckout}
            disabled={isRunning || actionLoading}
            className="ml-1 rounded-lg border border-border px-2 py-1 text-[10px] font-medium text-foreground hover:bg-surface disabled:opacity-40"
          >
            打开
          </button>
        )}

        {menuOpen && (
          <div className="absolute right-0 top-full z-10 mt-1 w-40 overflow-hidden rounded-lg border border-border bg-surface shadow-lg">
            {canOpen && (
              <button
                type="button"
                disabled={isRunning}
                onClick={onCheckout}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-muted disabled:opacity-40"
              >
                <GitBranch className="h-3.5 w-3.5" />
                打开分支
              </button>
            )}
            {canMerge && (
              <button
                type="button"
                onClick={onMerge}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-muted"
              >
                <GitMerge className="h-3.5 w-3.5" />
                合并到主分支
              </button>
            )}
            {canRename && (
              <button
                type="button"
                onClick={onStartRename}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-muted"
              >
                <Pencil className="h-3.5 w-3.5" />
                重命名
              </button>
            )}
            {canArchive && (
              <button
                type="button"
                onClick={onArchive}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-muted"
              >
                <Archive className="h-3.5 w-3.5" />
                归档
              </button>
            )}
            {canRestore && (
              <button
                type="button"
                onClick={onRestore}
                className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs hover:bg-surface-muted"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                恢复
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
