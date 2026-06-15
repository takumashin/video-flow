'use client'

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { SeedanceTaskStatus } from '@/lib/types'

export type LocalTaskQueueItem = {
  id: string
  taskId: string
  prompt?: string
  nodeTitle?: string
  status: SeedanceTaskStatus
  progress?: number
  videoUrl?: string
  createdAt: number
  updatedAt: number
}

type TaskQueueStore = {
  open: boolean
  statusFilter: SeedanceTaskStatus | 'all'
  pageNum: number
  pageSize: number
  localTasks: LocalTaskQueueItem[]
  openPanel: () => void
  closePanel: () => void
  setStatusFilter: (status: SeedanceTaskStatus | 'all') => void
  setPageNum: (page: number) => void
  upsertLocalTask: (item: Omit<LocalTaskQueueItem, 'updatedAt'> & { updatedAt?: number }) => void
  removeLocalTask: (taskId: string) => void
}

export const useTaskQueueStore = create<TaskQueueStore>()(
  persist(
    set => ({
      open: false,
      statusFilter: 'all',
      pageNum: 1,
      pageSize: 20,
      localTasks: [],

      openPanel: () => set({ open: true }),
      closePanel: () => set({ open: false }),
      setStatusFilter: status => set({ statusFilter: status, pageNum: 1 }),
      setPageNum: page => set({ pageNum: page }),

      upsertLocalTask: item => set(state => {
        const updatedAt = item.updatedAt ?? Date.now()
        const next: LocalTaskQueueItem = { ...item, updatedAt }
        const index = state.localTasks.findIndex(t => t.taskId === item.taskId)
        if (index === -1)
          return { localTasks: [next, ...state.localTasks].slice(0, 100) }
        const localTasks = [...state.localTasks]
        localTasks[index] = { ...localTasks[index], ...next }
        return { localTasks }
      }),

      removeLocalTask: taskId => set(state => ({
        localTasks: state.localTasks.filter(t => t.taskId !== taskId),
      })),
    }),
    {
      name: 'seedance-studio-task-queue',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        localTasks: state.localTasks,
        pageSize: state.pageSize,
      }),
    },
  ),
)
