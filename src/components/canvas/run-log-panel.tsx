'use client'

import { ScrollText, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'

export default function RunLogPanel() {
  const activeSession = useActiveWorkflowSession()
  const runLogs = activeSession?.runLogs ?? []
  const sessionName = activeSession?.name ?? ''
  const open = activeSession?.runLogPanelOpen ?? false
  const clearLogs = useWorkflowStore(s => s.clearLogs)
  const closeRunLogPanel = useWorkflowStore(s => s.closeRunLogPanel)

  if (!open)
    return null

  return (
    <div className="border-t border-border bg-surface-muted">
      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-xs font-medium text-secondary">
          运行日志
          {sessionName && <span className="text-muted"> · {sessionName}</span>}
          {runLogs.length > 0 && (
            <span className="text-muted"> · {runLogs.length} 条</span>
          )}
        </p>
        <div className="flex items-center gap-2">
          {runLogs.length > 0 && (
            <button
              type="button"
              onClick={clearLogs}
              className="text-xs text-muted hover:text-foreground"
            >
              清空
            </button>
          )}
          <button
            type="button"
            onClick={closeRunLogPanel}
            className="rounded p-1 text-muted hover:bg-surface hover:text-foreground"
            aria-label="关闭运行日志"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="max-h-36 overflow-y-auto px-4 pb-3">
        {runLogs.length === 0
          ? (
              <p className="py-2 text-xs text-muted">暂无运行日志</p>
            )
          : runLogs.map(log => (
              <div key={log.id} className="mb-1 flex gap-2 text-xs">
                <span className="shrink-0 text-muted">
                  {new Date(log.timestamp).toLocaleTimeString()}
                </span>
                <span className={cn(
                  log.level === 'error' && 'text-red-600 dark:text-red-400',
                  log.level === 'success' && 'text-emerald-600 dark:text-emerald-400',
                  log.level === 'info' && 'text-secondary',
                )}
                >
                  [
                  {log.nodeTitle}
                  ]
                  {' '}
                  {log.message}
                </span>
              </div>
            ))}
      </div>
    </div>
  )
}

export function RunLogToggle() {
  const activeSession = useActiveWorkflowSession()
  const runLogs = activeSession?.runLogs ?? []
  const open = activeSession?.runLogPanelOpen ?? false
  const toggleRunLogPanel = useWorkflowStore(s => s.toggleRunLogPanel)
  const errorCount = runLogs.filter(log => log.level === 'error').length

  return (
    <button
      type="button"
      onClick={toggleRunLogPanel}
      className={cn(
        'relative inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium shadow-sm transition',
        open
          ? 'border-primary-light bg-primary/10 text-primary-light'
          : 'border-border bg-input text-foreground hover:bg-surface-muted',
      )}
      aria-expanded={open}
      aria-label="运行日志"
    >
      <ScrollText className="h-3.5 w-3.5" />
      <span className="hidden sm:inline">运行日志</span>
      {runLogs.length > 0 && (
        <span className={cn(
          'inline-flex min-w-[1.125rem] items-center justify-center rounded-full px-1 text-[10px] font-semibold leading-4',
          errorCount > 0
            ? 'bg-red-500/15 text-red-600 dark:text-red-400'
            : 'bg-surface-muted text-muted',
        )}
        >
          {runLogs.length}
        </span>
      )}
    </button>
  )
}
