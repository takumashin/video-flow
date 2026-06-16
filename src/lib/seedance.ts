import type { ListSeedanceTasksOptions, SeedanceCreateTaskRequest, SeedanceTaskListResponse, SeedanceTaskResponse } from './types'
import type { SeedanceApiVideoParams } from './seedance-params'
import { SEEDANCE_POLL_INTERVAL_MS } from './seedance-progress'

const DEFAULT_BASE_URL = 'https://ark.cn-beijing.volces.com'

export function getSeedanceConfig() {
  const apiKey = process.env.ARK_API_KEY
  const baseUrl = process.env.ARK_BASE_URL || DEFAULT_BASE_URL
  const defaultModel = process.env.ARK_MODEL || 'doubao-seedance-1-5-pro-251215'

  if (!apiKey) {
    throw new Error('ARK_API_KEY 未配置，请在 .env.local 中设置火山方舟 API Key')
  }

  return { apiKey, baseUrl, defaultModel }
}

export async function createSeedanceTask(payload: SeedanceCreateTaskRequest): Promise<{ id: string }> {
  const { apiKey, baseUrl } = getSeedanceConfig()

  const response = await fetch(`${baseUrl}/api/v3/contents/generations/tasks`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `创建任务失败 (${response.status})`)
  }

  return { id: data.id }
}

/** 取消 queued 任务或删除终态任务记录（火山 DELETE /api/v3/contents/generations/tasks/{id}） */
export async function cancelSeedanceTask(taskId: string): Promise<void> {
  const { apiKey, baseUrl } = getSeedanceConfig()

  const response = await fetch(`${baseUrl}/api/v3/contents/generations/tasks/${taskId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
  })

  if (!response.ok) {
    let message = `取消任务失败 (${response.status})`
    try {
      const data = await response.json()
      message = data?.error?.message || data?.message || message
    }
    catch {
      // ignore parse errors
    }
    throw new Error(message)
  }
}

export async function getSeedanceTask(taskId: string): Promise<SeedanceTaskResponse> {
  const { apiKey, baseUrl } = getSeedanceConfig()

  const response = await fetch(`${baseUrl}/api/v3/contents/generations/tasks/${taskId}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: 'no-store',
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `查询任务失败 (${response.status})`)
  }

  return data as SeedanceTaskResponse
}

export async function listSeedanceTasks(
  options?: ListSeedanceTasksOptions,
): Promise<SeedanceTaskListResponse> {
  const { apiKey, baseUrl } = getSeedanceConfig()

  const params = new URLSearchParams()
  const pageNum = options?.pageNum ?? 1
  const pageSize = options?.pageSize ?? 20
  params.set('page_num', String(pageNum))
  params.set('page_size', String(pageSize))

  if (options?.status)
    params.set('filter.status', options.status)

  if (options?.taskIds?.length)
    for (const taskId of options.taskIds)
      params.append('filter.task_ids', taskId)

  const response = await fetch(
    `${baseUrl}/api/v3/contents/generations/tasks?${params.toString()}`,
    {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: 'no-store',
    },
  )

  const data = await response.json()

  if (!response.ok) {
    throw new Error(data?.error?.message || data?.message || `查询任务列表失败 (${response.status})`)
  }

  return {
    total: Number(data.total ?? 0),
    items: Array.isArray(data.items) ? data.items : [],
  }
}

/** 按火山官方推荐方式组装请求体（参数走 body，不拼进 text） */
export function buildSeedanceTaskPayload(
  model: string,
  prompt: string,
  content: SeedanceCreateTaskRequest['content'],
  videoParams: SeedanceApiVideoParams,
): SeedanceCreateTaskRequest {
  const payload: SeedanceCreateTaskRequest = {
    model,
    content,
    generate_audio: videoParams.generate_audio,
    resolution: videoParams.resolution,
    ratio: videoParams.ratio,
    duration: videoParams.duration,
    camera_fixed: videoParams.camera_fixed,
    watermark: videoParams.watermark,
  }

  if (videoParams.seed != null && videoParams.seed >= 0)
    payload.seed = videoParams.seed

  return payload
}

function parseProgressValue(raw: unknown): number | null {
  if (raw == null)
    return null

  if (typeof raw === 'number' && Number.isFinite(raw)) {
    if (raw <= 1 && raw >= 0)
      return Math.round(raw * 100)
    return Math.min(100, Math.max(0, Math.round(raw)))
  }

  if (typeof raw === 'string') {
    const match = raw.trim().match(/(\d+(?:\.\d+)?)/)
    if (match)
      return Math.min(100, Math.max(0, Math.round(Number(match[1]))))
  }

  return null
}

function toUnixSeconds(value: number | string | undefined): number | null {
  if (value == null)
    return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

/** 从查询任务 API 响应解析进度百分比（优先 progress 字段，否则按状态与时间估算） */
export function extractSeedanceTaskProgress(
  task: SeedanceTaskResponse,
  options?: { expectedDurationSec?: number },
): number {
  const fromTop = parseProgressValue(task.progress)
  if (fromTop != null)
    return fromTop

  const content = task.content && typeof task.content === 'object' ? task.content : null
  const fromContent = parseProgressValue(content?.progress)
  if (fromContent != null)
    return fromContent

  if (task.status === 'succeeded')
    return 100

  if (task.status === 'failed' || task.status === 'cancelled')
    return 0

  const createdAt = toUnixSeconds(task.created_at)
  const updatedAt = toUnixSeconds(task.updated_at)
  if (task.status === 'running' && createdAt != null && updatedAt != null) {
    const elapsed = Math.max(0, updatedAt - createdAt)
    const durationSec = options?.expectedDurationSec ?? task.duration ?? 5
    const estimatedTotal = Math.max(60, durationSec * 24)
    const fromElapsed = Math.round((elapsed / estimatedTotal) * 100)
    return Math.min(95, Math.max(20, fromElapsed))
  }

  if (task.status === 'queued')
    return 10

  if (task.status === 'running')
    return 50

  return 0
}

export async function pollSeedanceTask(
  taskId: string,
  options?: {
    intervalMs?: number
    expectedDurationSec?: number
    onProgress?: (status: SeedanceTaskResponse, progress: number) => void
  },
): Promise<SeedanceTaskResponse> {
  const intervalMs = options?.intervalMs ?? SEEDANCE_POLL_INTERVAL_MS

  while (true) {
    const task = await getSeedanceTask(taskId)
    const progress = extractSeedanceTaskProgress(task, { expectedDurationSec: options?.expectedDurationSec })
    options?.onProgress?.(task, progress)

    if (task.status === 'succeeded' || task.status === 'failed' || task.status === 'cancelled') {
      return task
    }

    await new Promise(resolve => setTimeout(resolve, intervalMs))
  }
}
