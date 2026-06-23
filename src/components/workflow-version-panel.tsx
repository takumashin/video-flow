'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeftRight,
  GitBranch,
  GitCommit,
  History,
  Loader2,
  Plus,
  RotateCcw,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import type { WorkflowVersionSummary } from '@/lib/types'

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

function VersionIcon({ type }: { type: string }) {
  if (type === 'manual') {
    return <BookmarkIcon />
  }
  if (type === 'restore') {
    return <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
  }
  return <GitCommit className="h-3.5 w-3.5 text-muted" />
}

function BookmarkIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-primary-light" viewBox="0 0 14 14" fill="currentColor">
      <path d="M3 1.5a.5.5 0 0 0-.5.5v10.5l4.5-3 4.5 3V2a.5.5 0 0 0-.5-.5H3z" />
    </svg>
  )
}

function VersionTypeLabel({ type }: { type: string }) {
  if (type === 'manual') return <span className="text-[10px] font-medium text-primary-light">手动保存</span>
  if (type === 'restore') return <span className="text-[10px] font-medium text-amber-500">恢复</span>
  return <span className="text-[10px] text-muted">自动保存</span>
}

export default function WorkflowVersionPanel() {
  const panelOpen = useWorkflowVersionStore(s => s.versionPanelOpen)
  const closePanel = useWorkflowVersionStore(s => s.closeVersionPanel)
  const versions = useWorkflowVersionStore(s => s.versions)
  const versionsLoading = useWorkflowVersionStore(s => s.versionsLoading)
  const actionLoading = useWorkflowVersionStore(s => s.actionLoading)
  const error = useWorkflowVersionStore(s => s.error)
  const selectedForCompare = useWorkflowVersionStore(s => s.selectedForCompare)
  const activeBranch = useWorkflowVersionStore(s => s.activeBranch)
  const diffLoading = useWorkflowVersionStore(s => s.diffLoading)

  const loadVersions = useWorkflowVersionStore(s => s.loadVersions)
  const loadBranches = useWorkflowVersionStore(s => s.loadBranches)
  const openDiffViewer = useWorkflowVersionStore(s => s.openDiffViewer)
  const selectForCompare = useWorkflowVersionStore(s => s.selectForCompare)
  const restoreVersion = useWorkflowVersionStore(s => s.restoreVersion)
  const checkoutBranch = useWorkflowVersionStore(s => s.checkoutBranch)
  const branches = useWorkflowVersionStore(s => s.branches)
  const clearError = useWorkflowVersionStore(s => s.clearError)
  const createBranchFromStore = useWorkflowVersionStore(s => s.createBranch)

  const activeSession = useActiveWorkflowSession()
  const workflowId = activeSession?.workflowId ?? null
  const isRunning = activeSession?.isRunning ?? false
  const applyWorkflow = useWorkflowStore(s => s.applyWorkflow)

  const [typeFilter, setTypeFilter] = useState<string>('all')
  const [branchInputOpen, setBranchInputOpen] = useState(false)
  const [newBranchName, setNewBranchName] = useState('')
  const [restoringId, setRestoringId] = useState<string | null>(null)

  useEffect(() => {
    if (panelOpen && workflowId) {
      void loadVersions(workflowId)
      void loadBranches(workflowId)
    }
  }, [panelOpen, workflowId, activeBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!panelOpen || !workflowId) return null

  const filteredVersions = typeFilter === 'all'
    ? versions
    : versions.filter(v => v.type === typeFilter)

  const handleCompare = (versionId: string) => {
    if (!selectedForCompare) {
      selectForCompare(versionId)
    }
    else if (selectedForCompare === versionId) {
      selectForCompare(null)
    }
    else {
      void openDiffViewer(selectedForCompare, versionId, workflowId)
      selectForCompare(null)
    }
  }

  const handleRestore = async (versionId: string) => {
    if (isRunning) return
    setRestoringId(versionId)
    const ok = await restoreVersion(workflowId, versionId)
    if (ok && activeSession) {
      // Reload the workflow to reflect restored state
      try {
        const response = await fetch(`/api/workflows/${workflowId}`)
        const data = await response.json()
        if (response.ok) {
          applyWorkflow({
            id: data.id,
            name: data.name,
            nodes: data.nodes,
            edges: data.edges,
            revision: data.revision,
          })
        }
      }
      catch (_) { /* ignore reload errors */ }
    }
    setRestoringId(null)
  }

  const handleBranchSwitch = async (branch: string) => {
    if (branch === activeBranch || !activeSession) return
    await checkoutBranch(
      workflowId,
      activeSession.id,
      branch,
      {
        name: activeSession.name,
        nodes: activeSession.nodes,
        edges: activeSession.edges,
        revision: activeSession.revision ?? 0,
      },
    )
    void loadVersions(workflowId)
  }

  const handleCreateBranch = async () => {
    if (!newBranchName.trim()) return
    await createBranchFromStore(
      workflowId,
      newBranchName.trim(),
      undefined,
      selectedForCompare ?? undefined,
    )
    setNewBranchName('')
    setBranchInputOpen(false)
    selectForCompare(null)
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4">
      <div className="flex h-[600px] max-h-[85vh] w-full max-w-lg flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary-light" />
            <h2 className="text-base font-semibold text-foreground">版本历史</h2>
          </div>
          <button
            type="button"
            onClick={closePanel}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Branch selector */}
        <div className="flex items-center gap-2 border-b border-border px-5 py-2">
          <GitBranch className="h-3.5 w-3.5 text-muted" />
          <select
            value={activeBranch}
            onChange={e => handleBranchSwitch(e.target.value)}
            className="nodrag nowheel rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-primary-light"
          >
            {branches.map(b => (
              <option key={b.name} value={b.name}>
                {b.name}
                {b.latestRevision > 0 ? ` (r${b.latestRevision})` : ''}
              </option>
            ))}
          </select>
          {selectedForCompare && (
            <button
              type="button"
              onClick={() => setBranchInputOpen(!branchInputOpen)}
              className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] text-muted hover:bg-surface-muted hover:text-foreground"
              title="从选中版本创建分支"
            >
              <Plus className="h-3 w-3" />
              新分支
            </button>
          )}
        </div>

        {/* New branch input (inline) */}
        {branchInputOpen && (
          <div className="flex items-center gap-2 border-b border-border px-5 py-2">
            <input
              type="text"
              value={newBranchName}
              onChange={e => setNewBranchName(e.target.value)}
              placeholder="分支名称..."
              className="nodrag nowheel nokey flex-1 rounded-md border border-border bg-input px-2 py-1 text-xs text-foreground outline-none focus:border-primary-light"
              onKeyDown={e => { if (e.key === 'Enter') void handleCreateBranch() }}
            />
            <button
              type="button"
              onClick={() => void handleCreateBranch()}
              disabled={!newBranchName.trim() || actionLoading}
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
            >
              创建
            </button>
            <button
              type="button"
              onClick={() => { setBranchInputOpen(false); setNewBranchName('') }}
              className="rounded-md px-2 py-1 text-xs text-muted hover:text-foreground"
            >
              取消
            </button>
          </div>
        )}

        {/* Type filter */}
        <div className="flex gap-1 border-b border-border px-5 py-2">
          {(['all', 'manual', 'auto', 'restore'] as const).map(t => (
            <button
              key={t}
              type="button"
              onClick={() => setTypeFilter(t)}
              className={cn(
                'rounded-md px-2.5 py-1 text-[11px] font-medium transition',
                typeFilter === t
                  ? 'bg-primary/15 text-primary-light'
                  : 'text-muted hover:bg-surface-muted hover:text-foreground',
              )}
            >
              {t === 'all' ? '全部' : t === 'manual' ? '手动' : t === 'auto' ? '自动' : '恢复'}
            </button>
          ))}
        </div>

        {/* Compare hint */}
        {selectedForCompare && (
          <div className="flex items-center gap-2 border-b border-primary-light/20 bg-primary/5 px-5 py-2 text-xs text-primary-light">
            <ArrowLeftRight className="h-3.5 w-3.5" />
            已选中版本进行对比 — 点击另一个版本即可查看差异
            <button
              type="button"
              onClick={() => selectForCompare(null)}
              className="ml-auto text-muted hover:text-foreground"
            >
              取消
            </button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-5 py-2 text-xs text-red-600">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={clearError} className="text-red-400 hover:text-red-600">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {/* Version list */}
        <div className="flex-1 overflow-y-auto p-2">
          {versionsLoading
            ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  加载版本历史...
                </div>
              )
            : filteredVersions.length === 0
              ? (
                  <div className="py-12 text-center">
                    <GitCommit className="mx-auto h-8 w-8 text-muted/40" />
                    <p className="mt-2 text-sm text-muted">
                      {activeBranch !== 'main'
                        ? '该分支暂无版本记录'
                        : '暂无版本记录，开始编辑后将自动创建'}
                    </p>
                  </div>
                )
              : (
                  filteredVersions.map((version) => {
                    const isSelected = selectedForCompare === version.id
                    const isRestoring = restoringId === version.id

                    return (
                      <VersionRow
                        key={version.id}
                        version={version}
                        isSelected={isSelected}
                        isRunning={isRunning}
                        isRestoring={isRestoring}
                        onCompare={() => handleCompare(version.id)}
                        onRestore={() => void handleRestore(version.id)}
                      />
                    )
                  })
                )}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-2 text-[10px] text-muted">
          {filteredVersions.length > 0 && `显示 ${filteredVersions.length} 个版本`}
        </div>

        {/* Diff loading overlay */}
        {diffLoading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-surface/80">
            <div className="flex items-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              正在加载差异对比...
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function VersionRow({
  version,
  isSelected,
  isRunning,
  isRestoring,
  onCompare,
  onRestore,
}: {
  version: WorkflowVersionSummary
  isSelected: boolean
  isRunning: boolean
  isRestoring: boolean
  onCompare: () => void
  onRestore: () => void
}) {
  return (
    <div
      className={cn(
        'mb-1 flex items-center gap-3 rounded-lg border px-3 py-2.5 transition',
        isSelected
          ? 'border-primary-light bg-primary/10'
          : 'border-transparent hover:bg-surface-muted',
      )}
    >
      {/* Icon */}
      <div className="shrink-0">
        <VersionIcon type={version.type} />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          {version.label
            ? (
                <span className="truncate text-sm font-medium text-foreground">
                  {version.label}
                </span>
              )
            : (
                <span className="text-sm text-muted">自动保存</span>
              )}
          <VersionTypeLabel type={version.type} />
        </div>
        <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
          {version.createdByName && (
            <span>{version.createdByName}</span>
          )}
          <span>·</span>
          <span>{relativeTime(version.createdAt)}</span>
          <span>·</span>
          <span>r{version.revision}</span>
        </div>
        {version.description && (
          <p className="mt-1 text-[10px] text-muted/70 truncate">{version.description}</p>
        )}
      </div>

      {/* Actions */}
      <div className="flex shrink-0 gap-1">
        <button
          type="button"
          onClick={onCompare}
          className={cn(
            'rounded-md px-2 py-1 text-[10px] font-medium transition',
            isSelected
              ? 'bg-primary/20 text-primary-light'
              : 'text-muted hover:bg-surface-muted hover:text-foreground',
          )}
        >
          <ArrowLeftRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={onRestore}
          disabled={isRunning || isRestoring}
          className="rounded-md px-2 py-1 text-[10px] font-medium text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-30"
          title={isRunning ? '运行中无法恢复版本' : '恢复到此版本'}
        >
          {isRestoring
            ? <Loader2 className="h-3 w-3 animate-spin" />
            : <RotateCcw className="h-3 w-3" />}
        </button>
      </div>
    </div>
  )
}
