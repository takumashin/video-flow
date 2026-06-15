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
    status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'
    progress?: number
    videoUrl?: string
    createdAt: number
  }) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void
  appendOutputVideo: (nodeId: string, item: { videoUrl: string; taskId?: string; createdAt: number }) => void
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
    taskId: string
    prompt: string
    progressStartedAt: number
    signal?: AbortSignal
  },
) {
  const { taskId, prompt, progressStartedAt, signal } = payload

  const pollResult = await pollSeedanceTaskClient(taskId, {
    intervalMs: SEEDANCE_POLL_INTERVAL_MS,
    startedAtMs: progressStartedAt,
    signal,
    onProgress: (result) => {
      if (result.status === 'succeeded' || result.status === 'failed' || result.status === 'cancelled')
        return

      deps.updateNodeData(node.id, {
        status: 'running',
        progress: result.progress,
        progressStartedAt,
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
      })
    },
  })

  if (pollResult.status !== 'succeeded') {
    deps.updateNodeData(node.id, {
      status: mapTaskStatusToNodeStatus(pollResult.status),
      progress: pollResult.progress,
      progressStartedAt: undefined,
      error: pollResult.error || '视频生成失败',
    })
    deps.addLog({
      nodeId: node.id,
      nodeTitle: node.data.title,
      message: pollResult.error || '视频生成失败',
      level: 'error',
    })
    throw new Error(pollResult.error || '视频生成失败')
  }

  const remoteVideoUrl = pollResult.videoUrl
  if (!remoteVideoUrl) {
    deps.updateNodeData(node.id, {
      status: 'failed',
      progress: 0,
      progressStartedAt: undefined,
      error: '生成成功但未返回视频地址',
    })
    throw new Error('生成成功但未返回视频地址')
  }

  deps.updateNodeData(node.id, {
    status: 'succeeded',
    taskId,
    progress: 100,
    progressStartedAt: undefined,
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

  const currentEdges = deps.getEdges()
  const downstream = currentEdges.filter(e => e.source === node.id)
  for (const edge of downstream) {
    const target = deps.getNodes().find(n => n.id === edge.target)
    if (target?.data.type === NodeType.Output) {
      deps.appendOutputVideo(target.id, {
        videoUrl: finalVideoUrl,
        taskId,
        createdAt: Date.now(),
      })
    }
  }
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
      taskId: node.data.taskId,
      prompt: node.data.prompt,
      progressStartedAt,
      signal: options.signal,
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
    deps.updateNodeData(node.id, {
      status: 'failed',
      progress: 0,
      progressStartedAt: undefined,
      error: createResult.error || '生成失败',
    })
    deps.addLog({
      nodeId: node.id,
      nodeTitle: node.data.title,
      message: createResult.error || '生成失败',
      level: 'error',
    })
    throw new Error(createResult.error || '生成失败')
  }

  const taskId = createResult.taskId
  const progressStartedAt = Date.now()
  const initialProgress = computeFakeSeedanceProgress(progressStartedAt, 'queued')
  deps.updateNodeData(node.id, { taskId, progress: initialProgress, progressStartedAt })
  deps.upsertLocalTask({
    id: taskId,
    taskId,
    prompt: inputs.prompt,
    nodeTitle: node.data.title,
    status: 'queued',
    progress: initialProgress,
    createdAt: progressStartedAt,
  })
  deps.addLog({
    nodeId: node.id,
    nodeTitle: node.data.title,
    message: `任务已提交，开始查询进度，任务 ID: ${taskId}`,
    level: 'info',
  })

  await pollAndCompleteSeedanceTask(
    { id: node.id, data: node.data },
    deps,
    {
      taskId,
      prompt: inputs.prompt ?? node.data.prompt ?? '',
      progressStartedAt,
      signal: options.signal,
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

  const message = error instanceof Error ? error.message : '运行失败'
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
}

export function finalizeSeedanceSessionJob(options: RunSeedanceOptions, nodeId: string) {
  endSeedanceJob(options.sessionId, nodeId)
}
