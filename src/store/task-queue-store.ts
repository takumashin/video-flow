'use client'

import { create } from 'zustand'
import type { SeedanceTaskStatus } from '@/lib/types'

export type LocalTaskQueueItem = {
  id: string
  taskId: string
  prompt?: string
  nodeTitle?: string
  workflowId?: string
  nodeId?: string
  status: SeedanceTaskStatus
  progress?: number
  videoUrl?: string
  createdAt: number
  progressStartedAt?: number
}

type TaskQueueStore = {
  open: boolean
  statusFilter: SeedanceTaskStatus | 'all'
  pageNum: number
  pageSize: number
  localTasks: LocalTaskQueueItem[]
  serverHydrated: boolean
  openPanel: () => void
  closePanel: () => void
  setStatusFilter: (status: SeedanceTaskStatus | 'all') => void
  setPageNum: (page: number) => void
  setLocalTasks: (tasks: LocalTaskQueueItem[]) => void
  setServerHydrated: (hydrated: boolean) => void
  clearTasks: () => void
  upsertLocalTask: (item: LocalTaskQueueItem) => void
  removeLocalTask: (taskId: string) => void
}

const syncTimers = new Map<string, ReturnType<typeof setTimeout>>()

function scheduleTaskSync(item: LocalTaskQueueItem) {
  const existing = syncTimers.get(item.taskId)
  if (existing)
    clearTimeout(existing)

  syncTimers.set(item.taskId, setTimeout(() => {
    syncTimers.delete(item.taskId)
    void fetch(`/api/seedance/tasks/${encodeURIComponent(item.taskId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: item.prompt,
        nodeTitle: item.nodeTitle,
        workflowId: item.workflowId,
        nodeId: item.nodeId,
        status: item.status,
        progress: item.progress,
        videoUrl: item.videoUrl,
        progressStartedAt: item.progressStartedAt ?? item.createdAt,
      }),
    })
  }, 400))
}

export const useTaskQueueStore = create<TaskQueueStore>()(set => ({
  open: false,
  statusFilter: 'all',
  pageNum: 1,
  pageSize: 20,
  localTasks: [],
  serverHydrated: false,

  openPanel: () => set({ open: true }),
  closePanel: () => set({ open: false }),
  setStatusFilter: status => set({ statusFilter: status, pageNum: 1 }),
  setPageNum: page => set({ pageNum: page }),
  setLocalTasks: tasks => set({ localTasks: tasks, serverHydrated: true }),
  setServerHydrated: hydrated => set({ serverHydrated: hydrated }),
  clearTasks: () => set({ localTasks: [], serverHydrated: false }),

  upsertLocalTask: item => {
    const createdAt = item.createdAt
    const next: LocalTaskQueueItem = {
      ...item,
      createdAt,
      progressStartedAt: item.progressStartedAt ?? createdAt,
    }

    set(state => {
      const index = state.localTasks.findIndex(t => t.taskId === item.taskId)
      if (index === -1)
        return { localTasks: [next, ...state.localTasks].slice(0, 100) }

      const localTasks = [...state.localTasks]
      localTasks[index] = { ...localTasks[index], ...next }
      return { localTasks }
    })

    scheduleTaskSync(next)
  },

  removeLocalTask: taskId => set(state => ({
    localTasks: state.localTasks.filter(t => t.taskId !== taskId),
  })),
}))
