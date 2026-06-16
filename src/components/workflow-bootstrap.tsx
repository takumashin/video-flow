'use client'

import { useEffect, useRef } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'

export default function WorkflowBootstrap() {
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current)
      return
    startedRef.current = true

    let cancelled = false

    async function restoreLastWorkflow() {
      const store = useWorkflowStore.getState()
      store.setServerHydrated(false)

      try {
        const response = await fetch('/api/workflows/last')
        const data = await response.json()

        if (!cancelled && response.ok && data.workflow) {
          store.applyWorkflow({
            id: data.workflow.id,
            name: data.workflow.name,
            nodes: data.workflow.nodes,
            edges: data.workflow.edges,
            revision: data.workflow.revision,
          }, { newTab: false })
          await store.reconcileFailedTasks()
        }
      }
      catch (error) {
        console.error('[workflow] 恢复上次工作流失败:', error)
      }
      finally {
        if (!cancelled)
          useWorkflowStore.getState().setServerHydrated(true)
      }
    }

    void restoreLastWorkflow()

    return () => {
      cancelled = true
    }
  }, [])

  return null
}
