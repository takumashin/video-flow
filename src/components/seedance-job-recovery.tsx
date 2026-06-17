'use client'

import { useEffect } from 'react'
import { SEEDANCE_POLL_INTERVAL_MS } from '@/lib/seedance-progress'
import { useWorkflowStore } from '@/store/workflow-store'
import { NodeType } from '@/lib/types'

export default function SeedanceJobRecovery() {
  const serverHydrated = useWorkflowStore(s => s.serverHydrated)
  const activeSessionId = useWorkflowStore(s => s.activeSessionId)
  const activeWorkflowId = useWorkflowStore(s => s.sessions.find(
    session => session.id === s.activeSessionId,
  )?.workflowId ?? null)
  const runningTaskSignature = useWorkflowStore(s => {
    const session = s.sessions.find(item => item.id === s.activeSessionId)
    return session?.nodes
      .filter((node): node is typeof node & { data: { type: NodeType.Seedance, taskId?: string, status?: string } } =>
        node.data.type === NodeType.Seedance
        && node.data.status === 'running'
        && Boolean(node.data.taskId))
      .map(node => `${node.id}:${node.data.taskId}`)
      .join('|') ?? ''
  })

  useEffect(() => {
    if (!serverHydrated)
      return

    void (async () => {
      const store = useWorkflowStore.getState()
      await store.reconcileFailedTasks()
      await store.reconcileActiveTasks()
      store.resumeStuckSeedanceJobs()
    })()
  }, [serverHydrated, activeWorkflowId, activeSessionId])

  useEffect(() => {
    if (!serverHydrated || !runningTaskSignature)
      return

    let cancelled = false

    const syncRunningNodes = async () => {
      const store = useWorkflowStore.getState()
      const session = store.sessions.find(item => item.id === store.activeSessionId)
      if (!session)
        return

      const runningNodes = session.nodes.filter((node): node is typeof node & { data: { type: NodeType.Seedance, taskId: string } } =>
        node.data.type === NodeType.Seedance
        && node.data.status === 'running'
        && Boolean(node.data.taskId),
      )

      for (const node of runningNodes) {
        if (cancelled || !node.data.taskId)
          continue

        try {
          const response = await fetch(`/api/seedance/tasks/${encodeURIComponent(node.data.taskId)}`, {
            cache: 'no-store',
          })
          const data = await response.json()
          if (!response.ok)
            continue

          store.syncSeedanceTaskStatusToWorkflow({
            taskId: node.data.taskId,
            status: data.status,
            nodeId: node.id,
            workflowId: session.workflowId,
            error: data.error,
            errorCode: data.errorCode,
            progress: data.progress,
            videoUrl: data.videoUrl,
            queuePosition: data.queuePosition,
            progressStartedAt: data.progressStartedAt,
          })
        }
        catch {
          // 单次同步失败不影响其他节点
        }
      }
    }

    void syncRunningNodes()
    const timer = window.setInterval(() => {
      void syncRunningNodes()
    }, SEEDANCE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [serverHydrated, runningTaskSignature, activeSessionId])

  return null
}
