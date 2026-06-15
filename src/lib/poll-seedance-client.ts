import type { SeedanceTaskStatus } from './types'

export type SeedanceTaskPollResult = {
  taskId: string
  status: SeedanceTaskStatus
  progress: number
  videoUrl?: string
  error?: string
}

const TERMINAL_STATUSES: SeedanceTaskStatus[] = ['succeeded', 'failed', 'cancelled']

export async function pollSeedanceTaskClient(
  taskId: string,
  options?: {
    intervalMs?: number
    maxAttempts?: number
    onProgress?: (result: SeedanceTaskPollResult) => void
  },
): Promise<SeedanceTaskPollResult> {
  const intervalMs = options?.intervalMs ?? 5000
  const maxAttempts = options?.maxAttempts ?? 72

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const response = await fetch(`/api/seedance/tasks/${taskId}`, { cache: 'no-store' })
    const data = await response.json()

    if (!response.ok) {
      throw new Error(data.error || '查询任务失败')
    }

    const result: SeedanceTaskPollResult = {
      taskId: data.taskId ?? taskId,
      status: data.status,
      progress: typeof data.progress === 'number' ? data.progress : 0,
      videoUrl: data.videoUrl,
      error: data.error,
    }

    options?.onProgress?.(result)

    if (TERMINAL_STATUSES.includes(result.status))
      return result

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }

  throw new Error('视频生成超时，请稍后在任务列表中查看')
}
