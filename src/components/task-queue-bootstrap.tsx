'use client'

import { useSession } from 'next-auth/react'
import { useEffect, useRef } from 'react'
import type { SeedanceTaskListItem } from '@/lib/types'
import { useTaskQueueStore } from '@/store/task-queue-store'

function mapServerTask(task: SeedanceTaskListItem) {
  const createdAt = task.created_at
    ? (task.created_at > 1e12 ? task.created_at : task.created_at * 1000)
    : Date.now()

  return {
    id: task.id,
    taskId: task.id,
    prompt: task.prompt,
    nodeTitle: task.nodeTitle,
    workflowId: task.workflowId,
    nodeId: task.nodeId,
    status: task.status,
    progress: task.progress,
    videoUrl: task.content?.video_url,
    createdAt,
    progressStartedAt: task.progressStartedAt ?? createdAt,
  }
}

export default function TaskQueueBootstrap() {
  const { status, data: session } = useSession()
  const previousUserId = useRef<string | null>(null)
  const setLocalTasks = useTaskQueueStore(s => s.setLocalTasks)
  const clearTasks = useTaskQueueStore(s => s.clearTasks)
  const setServerHydrated = useTaskQueueStore(s => s.setServerHydrated)

  useEffect(() => {
    if (status === 'loading')
      return

    const userId = session?.user?.id ?? null

    if (status === 'unauthenticated' || !userId) {
      clearTasks()
      previousUserId.current = null
      return
    }

    if (previousUserId.current && previousUserId.current !== userId)
      clearTasks()

    previousUserId.current = userId

    let cancelled = false

    async function hydrate() {
      setServerHydrated(false)
      try {
        const response = await fetch('/api/seedance/tasks?page_num=1&page_size=100')
        const data = await response.json()
        if (cancelled || !response.ok)
          return

        setLocalTasks((data.items ?? []).map(mapServerTask))
      }
      catch (error) {
        console.error('[task-queue] hydrate failed:', error)
      }
      finally {
        if (!cancelled)
          setServerHydrated(true)
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [status, session?.user?.id, clearTasks, setLocalTasks, setServerHydrated])

  return null
}
