'use client'

import { cn } from '@/lib/cn'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'

export default function RunLogPanel() {
  const activeSession = useActiveWorkflowSession()
  const runLogs = activeSession?.runLogs ?? []
  const sessionName = activeSession?.name ?? ''
  const clearLogs = useWorkflowStore(s => s.clearLogs)

  if (runLogs.length === 0)
    return null

  return (
    <div className="border-t border-border bg-surface-muted">
      <div className="flex items-center justify-between px-4 py-2">
        <p className="text-xs font-medium text-secondary">
          运行日志
          {sessionName && <span className="text-muted"> · {sessionName}</span>}
        </p>
        <button
          type="button"
          onClick={clearLogs}
          className="text-xs text-muted hover:text-foreground"
        >
          清空
        </button>
      </div>
      <div className="max-h-36 overflow-y-auto px-4 pb-3">
        {runLogs.map(log => (
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
