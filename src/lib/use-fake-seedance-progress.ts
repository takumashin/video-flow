'use client'

import { useEffect, useState } from 'react'
import { resolveSeedanceDisplayProgress } from '@/lib/seedance-progress'
import type { SeedanceTaskStatus } from '@/lib/types'

const UI_TICK_MS = 1000

export function useFakeSeedanceProgress(
  startedAtMs: number | undefined,
  status: SeedanceTaskStatus | 'idle' | 'running' | 'succeeded' | 'failed' | undefined,
  storedProgress?: number,
): number | undefined {
  const [nowMs, setNowMs] = useState(() => Date.now())
  const isActive = status === 'queued' || status === 'running'

  useEffect(() => {
    if (!isActive || startedAtMs == null)
      return

    const timer = window.setInterval(() => setNowMs(Date.now()), UI_TICK_MS)
    return () => window.clearInterval(timer)
  }, [isActive, startedAtMs])

  if (!status)
    return storedProgress

  return resolveSeedanceDisplayProgress({
    startedAtMs,
    status,
    storedProgress,
    nowMs,
  })
}
