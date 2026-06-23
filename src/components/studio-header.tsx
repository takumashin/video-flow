'use client'

import { ListOrdered } from 'lucide-react'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import { SiteLogo } from '@/components/site-logo'
import WorkflowManager from '@/components/workflow-manager'
import WorkflowCollaborators from '@/components/workflow-collaborators'
import WorkspaceSwitcher from '@/components/workspace-switcher'
import WorkflowFileMenu from '@/components/workflow-file-menu'
import { btnCompactClass } from '@/lib/ui-classes'
import { useTaskQueueStore } from '@/store/task-queue-store'

export default function StudioHeader() {
  const openTaskQueue = useTaskQueueStore(s => s.openPanel)

  return (
    <header className="fixed inset-x-0 top-0 z-[100] flex h-12 items-center justify-between gap-3 border-b border-border bg-surface px-4 shadow-md">
      <div className="flex min-w-0 items-center gap-2.5">
        <SiteLogo size={28} className="h-7 w-7 rounded-lg" />
        <h1 className="truncate text-sm font-semibold text-foreground">
          <SeedanceBrandText text="Seedance Studio" />
        </h1>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <WorkflowCollaborators />
        <WorkflowFileMenu />
        <WorkflowManager compact menuPlacement="below" />
        <button
          type="button"
          onClick={openTaskQueue}
          className={btnCompactClass}
        >
          <ListOrdered className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">任务队列</span>
        </button>
        <WorkspaceSwitcher compact menuPlacement="below" />
      </div>
    </header>
  )
}
