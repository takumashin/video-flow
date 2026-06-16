'use client'

import { Sparkles, ListOrdered } from 'lucide-react'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import AddBlockPanel from '@/components/canvas/add-block-panel'
import AccountBalance from '@/components/account-balance'
import ThemeToggle from '@/components/theme-toggle'
import WorkflowManager from '@/components/workflow-manager'
import { useTaskQueueStore } from '@/store/task-queue-store'

export default function StudioHeader() {
  const openTaskQueue = useTaskQueueStore(s => s.openPanel)

  return (
    <header className="fixed inset-x-0 top-0 z-[100] flex h-14 items-center justify-between gap-4 border-b border-border bg-surface px-4 shadow-md">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-orange-500 to-rose-500">
          <Sparkles className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-sm font-semibold text-foreground">
            <SeedanceBrandText text="Seedance Studio" />
          </h1>
          <p className="text-xs text-muted">AI 视频生成工作流 · 火山引擎</p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-2 sm:gap-3">
        <AccountBalance />
        <ThemeToggle />
        <button
          type="button"
          onClick={openTaskQueue}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-input px-3 py-2 text-sm font-medium text-foreground shadow-sm transition hover:bg-surface-muted"
        >
          <ListOrdered className="h-4 w-4" />
          任务队列
        </button>
        <WorkflowManager />
        <AddBlockPanel />
      </div>
    </header>
  )
}
