'use client'

import { Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { getActiveSession, useWorkflowStore } from '@/store/workflow-store'

export default function WorkflowTabs() {
  const sessions = useWorkflowStore(s => s.sessions)
  const activeSessionId = useWorkflowStore(s => s.activeSessionId)
  const setActiveSession = useWorkflowStore(s => s.setActiveSession)
  const addSession = useWorkflowStore(s => s.addSession)
  const closeSession = useWorkflowStore(s => s.closeSession)

  const runningCount = sessions.filter(s => s.isRunning).length

  return (
    <div className="flex items-center gap-1 border-b border-border bg-surface px-2 py-1.5">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
        {sessions.map(session => {
          const isActive = session.id === activeSessionId
          return (
            <div
              key={session.id}
              className={cn(
                'group flex max-w-[200px] shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-xs transition',
                isActive
                  ? 'border-primary-light bg-primary/10 text-foreground'
                  : 'border-transparent text-secondary hover:bg-surface-muted hover:text-foreground',
              )}
            >
              <button
                type="button"
                onClick={() => setActiveSession(session.id)}
                className="flex min-w-0 flex-1 items-center gap-1.5"
              >
                {session.isRunning && (
                  <Loader2 className="h-3 w-3 shrink-0 animate-spin text-primary-light" />
                )}
                <span className="truncate font-medium">{session.name}</span>
              </button>
              <button
                type="button"
                onClick={() => closeSession(session.id)}
                className={cn(
                  'rounded p-0.5 text-muted opacity-0 transition hover:bg-surface hover:text-foreground group-hover:opacity-100',
                  isActive && 'opacity-70',
                )}
                aria-label="关闭工作流"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          )
        })}
      </div>

      <button
        type="button"
        onClick={() => addSession()}
        className="inline-flex shrink-0 items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-medium text-secondary hover:bg-surface-muted hover:text-foreground"
        aria-label="新建工作流标签"
      >
        <Plus className="h-3.5 w-3.5" />
        新建
      </button>

      {runningCount > 0 && (
        <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-medium text-primary-light">
          {runningCount} 个运行中
        </span>
      )}
    </div>
  )
}

export function useActiveWorkflowSession() {
  return useWorkflowStore(getActiveSession)
}
