import { pollSeedanceTaskClient } from './poll-seedance-client'
import { endSeedanceJob, isAbortError } from './seedance-generation-control'
import { computeFakeSeedanceProgress, SEEDANCE_POLL_INTERVAL_MS } from './seedance-progress'
import {
  collectInputsForNode,
  prepareSeedanceRequestAudios,
  prepareSeedanceRequestImages,
  prepareSeedanceRequestVideos,
  validateSeedanceNode,
} from './workflow-engine'
import type { ExecutionContext } from './workflow-engine'
import type { WorkflowSession } from './workflow-session'
import type { RunLogEntry, SeedanceNodeData, SeedanceTaskStatus, WorkflowNodeData } from './types'
import { NodeType } from './types'
import { notifyCreditsChanged } from '@/lib/credits/client-events'
import { formatSeedanceUserError } from '@/lib/seedance-error-messages'
import { flushWorkflowSessionSave } from '@/lib/workflow-auto-save-control'

function mapTaskStatusToNodeStatus(
  status: SeedanceTaskStatus,
): 'running' | 'succeeded' | 'failed' {
  if (status === 'succeeded')
    return 'succeeded'
  if (status === 'failed' || status === 'cancelled')
    return 'failed'
  return 'running'
}

export type RunSeedanceDeps = {
  upsertLocalTask: (item: {
    id: string
    taskId: string
    prompt?: string
    nodeTitle?: string
    status: SeedanceTaskStatus
    progress?: number
    videoUrl?: string
    createdAt: number
    progressStartedAt?: number
    workflowId?: string | null
    nodeId?: string
  }) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void
  appendSeedanceVideo: (nodeId: string, item: { videoUrl: string; taskId?: string; createdAt: number }) => void
  addLog: (entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  getNodes: () => WorkflowSession['nodes']
  getEdges: () => WorkflowSession['edges']
}

type RunSeedanceOptions = {
  sessionId: string
  signal?: AbortSignal
  resume?: boolean
}

async function pollAndCompleteSeedanceTask(
  node: { id: string; data: SeedanceNodeData },
  deps: RunSeedanceDeps,
  payload: {
    sessionId: string
    taskId: string
    prompt: string
    progressStartedAt: number
    signal?: AbortSignal
    workflowId?: string | null
  },
) {
  const { sessionId, taskId, prompt, progressStartedAt, signal, workflowId } = payload

  const pollResult = await pollSeedanceTaskClient(taskId, {
    intervalMs: SEEDANCE_POLL_INTERVAL_MS,
    startedAtMs: progressStartedAt,
    signal,
    onProgress: (result) => {
      if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'cancelled')
        return

      const isSystemQueue = result.status === 'waiting' || result.status === 'submitting'
      const activeProgressStartedAt = isSystemQueue
        ? undefined
        : (result.progressStartedAt ?? progressStartedAt)

      deps.updateNodeData(node.id, {
        status: 'running',
        progress: result.progress,
        progressStartedAt: activeProgressStartedAt,
        taskStatus: result.status,
        queuePosition: result.queuePosition,
      })
      deps.upsertLocalTask({
        id: taskId,
        taskId,
        prompt,
        nodeTitle: node.data.title,
        status: result.status,
        progress: result.progress,
        videoUrl: result.videoUrl,
        createdAt: progressStartedAt,
        progressStartedAt: activeProgressStartedAt,
        workflowId,
        nodeId: node.id,
      })
    },
  })

  if (pollResult.status !== 'succeeded') {
    if (pollResult.status === 'cancelled') {
      deps.updateNodeData(node.id, {
        status: 'idle',
        progress: undefined,
        progressStartedAt: undefined,
        taskId: undefined,
        taskStatus: undefined,
        queuePosition: undefined,
        error: undefined,
      })
      deps.upsertLocalTask({
        id: taskId,
        taskId,
        prompt,
        nodeTitle: node.data.title,
        status: 'cancelled',
        progress: 0,
        createdAt: progressStartedAt,
        workflowId,
        nodeId: node.id,
      })
      deps.addLog({
        nodeId: node.id,
        nodeTitle: node.data.title,
        message: '任务已取消',
        level: 'info',
      })
      return
    }

    const failureMessage = formatSeedanceUserError(
      pollResult.error,
      pollResult.errorCode,
      '视频生成失败',
    )

    deps.updateNodeData(node.id, {
      status: mapTaskStatusToNodeStatus(pollResult.status),
      progress: pollResult.progress,
      progressStartedAt: undefined,
      taskStatus: undefined,
      queuePosition: undefined,
      error: failureMessage,
    })
    deps.addLog({
      nodeId: node.id,
      nodeTitle: node.data.title,
      message: failureMessage,
      level: 'error',
    })
    notifyCreditsChanged()
    flushWorkflowSessionSave(sessionId)
    throw new Error(failureMessage)
  }

  const remoteVideoUrl = pollResult.videoUrl
  if (!remoteVideoUrl) {
    deps.updateNodeData(node.id, {
      status: 'failed',
      progress: 0,
      progressStartedAt: undefined,
      error: '生成成功但未返回视频地址',
    })
    flushWorkflowSessionSave(sessionId)
    throw new Error('生成成功但未返回视频地址')
  }

  deps.updateNodeData(node.id, {
    status: 'succeeded',
    taskId,
    videoUrl: remoteVideoUrl,
    progress: 100,
    progressStartedAt: undefined,
    taskStatus: undefined,
    queuePosition: undefined,
    error: undefined,
  })
  deps.upsertLocalTask({
    id: taskId,
    taskId,
    prompt,
    nodeTitle: node.data.title,
    status: 'succeeded',
    progress: 100,
    videoUrl: remoteVideoUrl,
    createdAt: progressStartedAt,
    workflowId,
    nodeId: node.id,
  })

  let finalVideoUrl: string = remoteVideoUrl

  try {
    const saveResponse = await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl: finalVideoUrl }),
      signal,
    })
    const saveResult = await saveResponse.json()
    if (saveResponse.ok && typeof saveResult.videoUrl === 'string')
      finalVideoUrl = saveResult.videoUrl
  }
  catch (saveError) {
    if (isAbortError(saveError))
      throw saveError
    console.error('保存视频到本地失败，将使用远程 URL:', saveError)
  }

  if (finalVideoUrl !== remoteVideoUrl) {
    deps.upsertLocalTask({
      id: taskId,
      taskId,
      prompt,
      nodeTitle: node.data.title,
      status: 'succeeded',
      progress: 100,
      videoUrl: finalVideoUrl,
      createdAt: progressStartedAt,
      workflowId,
      nodeId: node.id,
    })
  }

  deps.addLog({
    nodeId: node.id,
    nodeTitle: node.data.title,
    message: finalVideoUrl.startsWith('/api/videos/')
      ? `视频生成成功并已保存到本地，任务 ID: ${taskId}`
      : `视频生成成功，任务 ID: ${taskId}`,
    level: 'success',
  })

  deps.appendSeedanceVideo(node.id, {
    videoUrl: finalVideoUrl,
    taskId,
    createdAt: Date.now(),
  })
}

export async function resumeSeedanceNodeSession(
  session: WorkflowSession,
  seedanceNodeId: string,
  deps: RunSeedanceDeps,
  options: RunSeedanceOptions,
): Promise<void> {
  const node = session.nodes.find(n => n.id === seedanceNodeId)
  if (!node || node.data.type !== NodeType.Seedance)
    return

  if (!node.data.taskId) {
    deps.updateNodeData(node.id, {
      status: 'idle',
      progress: undefined,
      progressStartedAt: undefined,
      error: undefined,
    })
    return
  }

  const progressStartedAt = node.data.progressStartedAt ?? Date.now()
  if (!node.data.progressStartedAt) {
    deps.updateNodeData(node.id, { progressStartedAt })
  }

  deps.addLog({
    nodeId: node.id,
    nodeTitle: node.data.title,
    message: `恢复查询任务进度，任务 ID: ${node.data.taskId}`,
    level: 'info',
  })

  await pollAndCompleteSeedanceTask(
    { id: node.id, data: node.data },
    deps,
    {
      sessionId: options.sessionId,
      taskId: node.data.taskId,
      prompt: node.data.prompt,
      progressStartedAt,
      signal: options.signal,
      workflowId: session.workflowId,
    },
  )
}

export async function runSeedanceNodeSession(
  session: WorkflowSession,
  seedanceNodeId: string,
  deps: RunSeedanceDeps,
  options: RunSeedanceOptions,
): Promise<void> {
  const { nodes, edges } = session
  const node = nodes.find(n => n.id === seedanceNodeId)

  if (!node || node.data.type !== NodeType.Seedance)
    return

  if (options.resume) {
    await resumeSeedanceNodeSession(session, seedanceNodeId, deps, options)
    return
  }

  const validationError = validateSeedanceNode(seedanceNodeId, nodes, edges)
  if (validationError) {
    deps.addLog({
      nodeId: seedanceNodeId,
      nodeTitle: node.data.title,
      message: validationError,
      level: 'error',
    })
    return
  }

  deps.clearLogs()

  const context = new Map<string, ExecutionContext>()
  const inputs = collectInputsForNode(node, nodes, edges, context)
  context.set(node.id, inputs)

  deps.updateNodeData(node.id, {
    status: 'running',
    error: undefined,
    taskId: undefined,
    progress: 0,
    progressStartedAt: undefined,
    taskStatus: undefined,
    queuePosition: undefined,
  })
  deps.addLog({
    nodeId: node.id,
    nodeTitle: node.data.title,
    message: '正在提交 Seedance 视频生成任务...',
    level: 'info',
  })

  const requestImages = prepareSeedanceRequestImages(node, inputs.images)
  const requestVideos = prepareSeedanceRequestVideos(node, inputs.videos)
  const requestAudios = prepareSeedanceRequestAudios(node, inputs.audios)

  const response = await fetch('/api/seedance/tasks', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      prompt: inputs.prompt,
      images: requestImages,
      videos: requestVideos,
      audios: requestAudios,
      generationMode: node.data.generationMode ?? 'text_to_video',
      model: node.data.model || undefined,
      nodeTitle: node.data.title,
      workflowId: session.workflowId ?? undefined,
      nodeId: node.id,
      ratio: node.data.ratio,
      resolution: node.data.resolution ?? '720p',
      duration: node.data.duration,
      seed: node.data.seed ?? -1,
      generateAudio: node.data.generateAudio,
      watermark: node.data.watermark,
      cameraFixed: node.data.cameraFixed,
      waitForResult: false,
    }),
    signal: options.signal,
  })

  const createResult = await response.json()

  if (!response.ok) {
    const createErrorCode = typeof createResult.code === 'string' ? createResult.code : undefined
    const createErrorMessage = formatSeedanceUserError(
      typeof createResult.error === 'string' ? createResult.error : undefined,
      createErrorCode,
      '生成失败',
    )

    deps.updateNodeData(node.id, {
      status: 'failed',
      progress: 0,
      progressStartedAt: undefined,
      error: createErrorMessage,
    })
    deps.addLog({
      nodeId: node.id,
      nodeTitle: node.data.title,
      message: createErrorMessage,
      level: 'error',
    })
    flushWorkflowSessionSave(options.sessionId)
    throw new Error(createErrorMessage)
  }

  const taskId = createResult.taskId
  notifyCreditsChanged()
  const initialStatus = (createResult.status as SeedanceTaskStatus | undefined) ?? 'queued'
  const queuePosition = typeof createResult.queuePosition === 'number'
    ? createResult.queuePosition
    : undefined
  const isSystemQueue = initialStatus === 'waiting' || initialStatus === 'submitting'
  const progressStartedAt = Date.now()
  const initialProgress = isSystemQueue
    ? 0
    : computeFakeSeedanceProgress(progressStartedAt, 'queued')

  deps.updateNodeData(node.id, {
    taskId,
    progress: initialProgress,
    progressStartedAt: isSystemQueue ? undefined : progressStartedAt,
    taskStatus: initialStatus,
    queuePosition,
  })
  deps.upsertLocalTask({
    id: taskId,
    taskId,
    prompt: inputs.prompt,
    nodeTitle: node.data.title,
    status: initialStatus,
    progress: initialProgress,
    createdAt: progressStartedAt,
    progressStartedAt: isSystemQueue ? undefined : progressStartedAt,
    workflowId: session.workflowId,
    nodeId: node.id,
  })
  deps.addLog({
    nodeId: node.id,
    nodeTitle: node.data.title,
    message: isSystemQueue
      ? queuePosition != null && queuePosition > 1
        ? `已进入系统排队（第 ${queuePosition} 位），任务 ID: ${taskId}`
        : `已进入系统排队，任务 ID: ${taskId}`
      : `任务已提交，开始查询进度，任务 ID: ${taskId}`,
    level: 'info',
  })

  await pollAndCompleteSeedanceTask(
    { id: node.id, data: node.data },
    deps,
    {
      sessionId: options.sessionId,
      taskId,
      prompt: inputs.prompt ?? node.data.prompt ?? '',
      progressStartedAt,
      signal: options.signal,
      workflowId: session.workflowId,
    },
  )
}

export function handleSeedanceSessionError(
  nodeId: string,
  nodeTitle: string,
  deps: RunSeedanceDeps,
  error: unknown,
  options: RunSeedanceOptions,
) {
  if (isAbortError(error)) {
    deps.updateNodeData(nodeId, {
      status: 'idle',
      progress: undefined,
      progressStartedAt: undefined,
      error: undefined,
    })
    deps.addLog({
      nodeId,
      nodeTitle,
      message: '已取消生成',
      level: 'info',
    })
    return
  }

  const message = formatSeedanceUserError(
    error instanceof Error ? error.message : undefined,
    undefined,
    '运行失败',
  )
  deps.updateNodeData(nodeId, {
    status: 'failed',
    progress: undefined,
    progressStartedAt: undefined,
    error: message,
  })
  deps.addLog({
    nodeId,
    nodeTitle,
    message,
    level: 'error',
  })
  flushWorkflowSessionSave(options.sessionId)
}

export function finalizeSeedanceSessionJob(options: RunSeedanceOptions, nodeId: string) {
  endSeedanceJob(options.sessionId, nodeId)
}
