import { computeFakeSeedanceProgress, SEEDANCE_POLL_INTERVAL_MS } from './seedance-progress'
import { sleep } from './sleep'
import type { SeedanceTaskStatus } from './types'

export type SeedanceTaskPollResult = {
  taskId: string
  status: SeedanceTaskStatus
  progress: number
  videoUrl?: string
  error?: string
  errorCode?: string
  queuePosition?: number
  progressStartedAt?: number
}

const TERMINAL_STATUSES: SeedanceTaskStatus[] = ['succeeded', 'failed', 'cancelled']

export async function pollSeedanceTaskClient(
  taskId: string,
  options?: {
    intervalMs?: number
    startedAtMs?: number
    signal?: AbortSignal
    onProgress?: (result: SeedanceTaskPollResult) => void
  },
): Promise<SeedanceTaskPollResult> {
  const intervalMs = options?.intervalMs ?? SEEDANCE_POLL_INTERVAL_MS
  const startedAtMs = options?.startedAtMs ?? Date.now()
  const signal = options?.signal

  while (true) {
    if (signal?.aborted)
      throw new DOMException('Aborted', 'AbortError')

    const response = await fetch(`/api/seedance/tasks/${taskId}`, { cache: 'no-store', signal })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '查询任务失败')
    }

    const status = data.status as SeedanceTaskStatus
    const progressStartedAt = typeof data.progressStartedAt === 'number'
      ? data.progressStartedAt
      : startedAtMs
    const result: SeedanceTaskPollResult = {
      taskId: data.taskId ?? taskId,
      status,
      progress: status === 'waiting' || status === 'submitting'
        ? 0
        : (typeof data.progress === 'number'
            ? data.progress
            : computeFakeSeedanceProgress(progressStartedAt, status)),
      videoUrl: data.videoUrl,
      error: data.error,
      errorCode: typeof data.errorCode === 'string' ? data.errorCode : undefined,
      queuePosition: typeof data.queuePosition === 'number' ? data.queuePosition : undefined,
      progressStartedAt,
    }

    options?.onProgress?.(result)

    if (TERMINAL_STATUSES.includes(result.status))
      return result

    await sleep(intervalMs, signal)
  }
}
