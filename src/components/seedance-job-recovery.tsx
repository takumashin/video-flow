'use client'

import { useEffect } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'

export default function SeedanceJobRecovery() {
  const serverHydrated = useWorkflowStore(s => s.serverHydrated)
  const activeSessionId = useWorkflowStore(s => s.activeSessionId)
  const activeWorkflowId = useWorkflowStore(s => s.sessions.find(
    session => session.id === s.activeSessionId,
  )?.workflowId ?? null)

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

  return null
}
