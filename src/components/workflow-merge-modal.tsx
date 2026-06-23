'use client'

import { useEffect, useState } from 'react'
import {
  AlertTriangle,
  ArrowRight,
  GitMerge,
  Loader2,
  Minus,
  PenTool,
  Plus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'
import type { WorkflowDiffEntry } from '@/lib/types'

export default function WorkflowMergeModal() {
  const mergeModalOpen = useWorkflowVersionStore(s => s.mergeModalOpen)
  const mergeTargetBranch = useWorkflowVersionStore(s => s.mergeTargetBranch)
  const closeMergeModal = useWorkflowVersionStore(s => s.closeMergeModal)
  const branches = useWorkflowVersionStore(s => s.branches)
  const diffResult = useWorkflowVersionStore(s => s.diffResult)
  const diffLoading = useWorkflowVersionStore(s => s.diffLoading)
  const actionLoading = useWorkflowVersionStore(s => s.actionLoading)
  const error = useWorkflowVersionStore(s => s.error)
  const clearError = useWorkflowVersionStore(s => s.clearError)
  const loadDiff = useWorkflowVersionStore(s => s.loadDiff)
  const mergeBranch = useWorkflowVersionStore(s => s.mergeBranch)
  const loadBranches = useWorkflowVersionStore(s => s.loadBranches)

  const activeSession = useActiveWorkflowSession()
  const workflowId = activeSession?.workflowId ?? null
  const isRunning = activeSession?.isRunning ?? false

  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes')

  useEffect(() => {
    if (!mergeModalOpen || !workflowId || !mergeTargetBranch) return

    void loadBranches(workflowId, { status: 'active' })
  }, [mergeModalOpen, workflowId, mergeTargetBranch]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!mergeModalOpen || !workflowId || !mergeTargetBranch) return

    const mainBranch = branches.find(b => b.isMain)
    const targetBranch = branches.find(b => b.name === mergeTargetBranch)
    if (mainBranch?.latestVersionId && targetBranch?.latestVersionId) {
      void loadDiff(workflowId, mainBranch.latestVersionId, targetBranch.latestVersionId)
    }
  }, [mergeModalOpen, workflowId, mergeTargetBranch, branches]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!mergeModalOpen || !workflowId || !mergeTargetBranch || !activeSession) return null

  const handleMerge = async () => {
    const ok = await mergeBranch(workflowId, activeSession.id, mergeTargetBranch)
    if (ok)
      closeMergeModal()
  }

  const nodeChanges = diffResult?.nodeChanges ?? []
  const edgeChanges = diffResult?.edgeChanges ?? []
  const added = nodeChanges.filter(c => c.type === 'added').length + edgeChanges.filter(c => c.type === 'added').length
  const removed = nodeChanges.filter(c => c.type === 'removed').length + edgeChanges.filter(c => c.type === 'removed').length
  const modified = nodeChanges.filter(c => c.type === 'modified').length + edgeChanges.filter(c => c.type === 'modified').length

  return (
    <div className="fixed inset-0 z-[215] flex items-center justify-center bg-black/45 p-4">
      <div className="flex h-[min(560px,85vh)] w-full max-w-xl flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <GitMerge className="h-5 w-5 text-primary-light" />
            <h2 className="text-base font-semibold text-foreground">合并分支</h2>
          </div>
          <button
            type="button"
            onClick={closeMergeModal}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="border-b border-border px-5 py-3 text-sm text-foreground">
          将分支
          {' '}
          <span className="font-medium text-primary-light">{mergeTargetBranch}</span>
          {' '}
          合并到
          {' '}
          <span className="font-medium">main</span>
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

        {diffLoading
          ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在对比 main 与分支差异…
              </div>
            )
          : diffResult
            ? (
                <>
                  <div className="flex items-center gap-3 border-b border-border px-5 py-3 text-xs">
                    <span className="font-medium">main</span>
                    <ArrowRight className="h-3 w-3 text-muted" />
                    <span className="font-medium">{mergeTargetBranch}</span>
                  </div>

                  <div className="flex gap-4 border-b border-border px-5 py-2 text-[10px]">
                    <span className="text-green-600">+{added} 新增</span>
                    <span className="text-red-500">-{removed} 删除</span>
                    <span className="text-amber-500">~{modified} 修改</span>
                  </div>

                  <div className="flex border-b border-border px-5">
                    <button
                      type="button"
                      onClick={() => setActiveTab('nodes')}
                      className={cn(
                        'mr-1 border-b-2 px-3 py-2 text-xs font-medium transition',
                        activeTab === 'nodes'
                          ? 'border-primary-light text-primary-light'
                          : 'border-transparent text-muted hover:text-foreground',
                      )}
                    >
                      节点 ({nodeChanges.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setActiveTab('edges')}
                      className={cn(
                        'border-b-2 px-3 py-2 text-xs font-medium transition',
                        activeTab === 'edges'
                          ? 'border-primary-light text-primary-light'
                          : 'border-transparent text-muted hover:text-foreground',
                      )}
                    >
                      连线 ({edgeChanges.length})
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-3">
                    {(activeTab === 'nodes' ? nodeChanges : edgeChanges).length === 0
                      ? (
                          <p className="py-8 text-center text-sm text-muted">无变更</p>
                        )
                      : (activeTab === 'nodes' ? nodeChanges : edgeChanges).map(change => (
                          <DiffRow key={change.id} change={change} />
                        ))}
                  </div>
                </>
              )
            : (
                <div className="flex flex-1 items-center justify-center px-5 text-center text-sm text-muted">
                  无法加载差异预览，仍可继续合并（将使用分支最新内容覆盖 main）
                </div>
              )}

        <div className="flex items-center justify-end gap-2 border-t border-border px-5 py-4">
          <button
            type="button"
            onClick={closeMergeModal}
            disabled={actionLoading}
            className="rounded-lg border border-border px-4 py-2 text-xs font-medium text-foreground hover:bg-surface-muted"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => void handleMerge()}
            disabled={isRunning || actionLoading}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
          >
            {actionLoading
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <GitMerge className="h-3.5 w-3.5" />}
            合并到 main
          </button>
        </div>
      </div>
    </div>
  )
}

function DiffRow({ change }: { change: WorkflowDiffEntry }) {
  const icon = change.type === 'added'
    ? <Plus className="h-3 w-3 text-green-600" />
    : change.type === 'removed'
      ? <Minus className="h-3 w-3 text-red-500" />
      : <PenTool className="h-3 w-3 text-amber-500" />

  const label = change.type === 'added'
    ? '新增'
    : change.type === 'removed'
      ? '删除'
      : '修改'

  return (
    <div className="mb-1 flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs hover:bg-surface-muted">
      {icon}
      <span className={cn(
        'shrink-0 rounded px-1 py-0.5 text-[10px] font-medium',
        change.type === 'added' && 'bg-green-500/10 text-green-600',
        change.type === 'removed' && 'bg-red-500/10 text-red-500',
        change.type === 'modified' && 'bg-amber-500/10 text-amber-600',
      )}
      >
        {label}
      </span>
      <span className="truncate text-foreground">{change.title || change.id}</span>
    </div>
  )
}
