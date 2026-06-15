import type { SeedanceTaskStatus } from './types'

/** 客户端查询任务状态的轮询间隔 */
export const SEEDANCE_POLL_INTERVAL_MS = 10_000

/** 生成中假进度上限，成功前保持在此值 */
export const SEEDANCE_FAKE_PROGRESS_CAP = 99

/** 约 10 分钟缓动到 99% */
const FAKE_PROGRESS_RAMP_SEC = 600

export function isActiveSeedanceTaskStatus(
  status: SeedanceTaskStatus | 'idle' | 'running' | 'succeeded' | 'failed' | undefined,
): status is 'queued' | 'running' {
  return status === 'queued' || status === 'running'
}

/** 基于开始时间的平滑假进度，未完成前最高 99%，成功后 100% */
export function computeFakeSeedanceProgress(
  startedAtMs: number,
  status: SeedanceTaskStatus | 'idle' | 'running' | 'succeeded' | 'failed',
  nowMs: number = Date.now(),
): number {
  if (status === 'succeeded')
    return 100

  if (status === 'failed' || status === 'cancelled')
    return 0

  if (!isActiveSeedanceTaskStatus(status))
    return 0

  const elapsedSec = Math.max(0, (nowMs - startedAtMs) / 1000)
  const min = 8
  const cap = SEEDANCE_FAKE_PROGRESS_CAP
  const t = Math.min(1, elapsedSec / FAKE_PROGRESS_RAMP_SEC)
  const eased = 1 - (1 - t) ** 2

  return Math.min(cap, Math.round(min + (cap - min) * eased))
}

export function resolveSeedanceDisplayProgress(options: {
  startedAtMs?: number
  status: SeedanceTaskStatus | 'idle' | 'running' | 'succeeded' | 'failed'
  storedProgress?: number
  nowMs?: number
}): number | undefined {
  const { startedAtMs, status, storedProgress, nowMs } = options

  if (status === 'succeeded')
    return 100

  if (status === 'failed' || status === 'cancelled')
    return storedProgress ?? 0

  if (startedAtMs != null && isActiveSeedanceTaskStatus(status))
    return computeFakeSeedanceProgress(startedAtMs, status, nowMs)

  if (isActiveSeedanceTaskStatus(status))
    return storedProgress ?? SEEDANCE_FAKE_PROGRESS_CAP

  return storedProgress
}
