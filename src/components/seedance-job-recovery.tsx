'use client'

import { useEffect } from 'react'
import { useWorkflowStore } from '@/store/workflow-store'

export default function SeedanceJobRecovery() {
  const resumeStuckSeedanceJobs = useWorkflowStore(s => s.resumeStuckSeedanceJobs)

  useEffect(() => {
    resumeStuckSeedanceJobs()
  }, [resumeStuckSeedanceJobs])

  return null
}
