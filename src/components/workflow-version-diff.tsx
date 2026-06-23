'use client'

import { useState } from 'react'
import { ArrowRight, GitCompare, Loader2, Minus, Plus, X, PenTool } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'
import type { WorkflowDiffEntry } from '@/lib/types'

export default function WorkflowVersionDiff() {
  const diffViewerOpen = useWorkflowVersionStore(s => s.diffViewerOpen)
  const closeDiffViewer = useWorkflowVersionStore(s => s.closeDiffViewer)
  const diffResult = useWorkflowVersionStore(s => s.diffResult)
  const diffLoading = useWorkflowVersionStore(s => s.diffLoading)

  const [activeTab, setActiveTab] = useState<'nodes' | 'edges'>('nodes')

  if (!diffViewerOpen) return null

  return (
    <div className="fixed inset-0 z-[210] flex items-center justify-center bg-black/45 p-4">
      <div className="flex h-[600px] max-h-[85vh] w-full max-w-xl flex-col rounded-2xl border border-border bg-surface shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div className="flex items-center gap-2">
            <GitCompare className="h-5 w-5 text-primary-light" />
            <h2 className="text-base font-semibold text-foreground">版本对比</h2>
          </div>
          <button
            type="button"
            onClick={closeDiffViewer}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {diffLoading
          ? (
              <div className="flex flex-1 items-center justify-center text-sm text-muted">
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                正在加载差异...
              </div>
            )
          : diffResult
            ? (
                <>
                  {/* Version labels */}
                  <div className="flex items-center gap-3 border-b border-border px-5 py-3 text-xs">
                    <span className="font-medium text-foreground">
                      {diffResult.versionA.label || `r${diffResult.versionA.revision}`}
                    </span>
                    <ArrowRight className="h-3 w-3 text-muted" />
                    <span className="font-medium text-foreground">
                      {diffResult.versionB.label || `r${diffResult.versionB.revision}`}
                    </span>
                  </div>

                  {/* Summary */}
                  <div className="flex gap-4 border-b border-border px-5 py-2 text-[10px]">
                    <span className="text-green-600">
                      +{diffResult.nodeChanges.filter(c => c.type === 'added').length + diffResult.edgeChanges.filter(c => c.type === 'added').length} 新增
                    </span>
                    <span className="text-red-500">
                      -{diffResult.nodeChanges.filter(c => c.type === 'removed').length + diffResult.edgeChanges.filter(c => c.type === 'removed').length} 删除
                    </span>
                    <span className="text-amber-500">
                      ~{diffResult.nodeChanges.filter(c => c.type === 'modified').length + diffResult.edgeChanges.filter(c => c.type === 'modified').length} 修改
                    </span>
                  </div>

                  {/* Tabs */}
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
                      节点 ({diffResult.nodeChanges.length})
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
                      连线 ({diffResult.edgeChanges.length})
                    </button>
                  </div>

                  {/* Change list */}
                  <div className="flex-1 overflow-y-auto p-2">
                    {activeTab === 'nodes'
                      ? <DiffEntries entries={diffResult.nodeChanges} label="节点" />
                      : <DiffEntries entries={diffResult.edgeChanges} label="连线" />}
                  </div>
                </>
              )
            : (
                <div className="flex flex-1 items-center justify-center text-sm text-muted">
                  无法加载差异
                </div>
              )}
      </div>
    </div>
  )
}

function DiffEntries({ entries, label }: { entries: WorkflowDiffEntry[]; label: string }) {
  if (entries.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-muted">
        无{label}变更
      </div>
    )
  }

  return (
    <div className="space-y-1">
      {entries.map(entry => (
        <div
          key={`${entry.type}-${entry.id}`}
          className={cn(
            'rounded-lg border px-3 py-2.5',
            entry.type === 'added' && 'border-green-500/20 bg-green-500/5',
            entry.type === 'removed' && 'border-red-500/20 bg-red-500/5',
            entry.type === 'modified' && 'border-amber-500/20 bg-amber-500/5',
          )}
        >
          <div className="flex items-center gap-2">
            <span className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[10px] font-bold text-white',
              entry.type === 'added' && 'bg-green-500',
              entry.type === 'removed' && 'bg-red-500',
              entry.type === 'modified' && 'bg-amber-500',
            )}>
              {entry.type === 'added' ? <Plus className="h-3 w-3" /> : entry.type === 'removed' ? <Minus className="h-3 w-3" /> : <PenTool className="h-3 w-3" />}
            </span>
            <span className="truncate text-xs font-medium text-foreground">
              {entry.title || entry.id}
            </span>
            {entry.nodeType && (
              <span className="text-[10px] text-muted">{entry.nodeType}</span>
            )}
            {entry.source && entry.target && (
              <span className="text-[10px] text-muted">
                {entry.source} → {entry.target}
              </span>
            )}
          </div>

          {/* Field-level changes */}
          {entry.changes && entry.changes.length > 0 && (
            <div className="mt-2 space-y-0.5 pl-7">
              {entry.changes.map(change => (
                <div key={change.field} className="flex gap-1.5 text-[10px]">
                  <span className="shrink-0 font-medium text-muted">{change.field}:</span>
                  <span className="text-red-400 line-through truncate max-w-[160px]">
                    {formatChangeValue(change.before)}
                  </span>
                  <span className="text-muted">→</span>
                  <span className="text-green-400 truncate max-w-[160px]">
                    {formatChangeValue(change.after)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}

function formatChangeValue(value: unknown): string {
  if (value === undefined || value === null) return '空'
  if (typeof value === 'object') return JSON.stringify(value).slice(0, 60)
  return String(value).slice(0, 80)
}
