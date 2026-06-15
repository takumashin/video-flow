import { pollSeedanceTaskClient } from './poll-seedance-client'
import {
  collectInputsForNode,
  prepareSeedanceRequestAudios,
  prepareSeedanceRequestImages,
  prepareSeedanceRequestVideos,
  validateSeedanceNode,
} from './workflow-engine'
import type { ExecutionContext } from './workflow-engine'
import type { WorkflowSession } from './workflow-session'
import type { RunLogEntry, WorkflowNodeData } from './types'
import { NodeType } from './types'

type RunSeedanceDeps = {
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

export async function runSeedanceNodeSession(
  session: WorkflowSession,
  seedanceNodeId: string,
  deps: RunSeedanceDeps,
): Promise<void> {
  const { nodes, edges } = session
  const node = nodes.find(n => n.id === seedanceNodeId)

  if (!node || node.data.type !== NodeType.Seedance)
    return

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
  })

  const createResult = await response.json()

  if (!response.ok) {
    deps.updateNodeData(node.id, {
      status: 'failed',
      progress: 0,
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
  deps.updateNodeData(node.id, { taskId, progress: 5 })
  deps.upsertLocalTask({
    id: taskId,
    taskId,
    prompt: inputs.prompt,
    nodeTitle: node.data.title,
    status: 'queued',
    progress: 5,
    createdAt: Date.now(),
  })
  deps.addLog({
    nodeId: node.id,
    nodeTitle: node.data.title,
    message: `任务已提交，开始查询进度，任务 ID: ${taskId}`,
    level: 'info',
  })

  const pollResult = await pollSeedanceTaskClient(taskId, {
    intervalMs: 5000,
    onProgress: (result) => {
      deps.updateNodeData(node.id, {
        status: 'running',
        progress: result.progress,
      })
      deps.upsertLocalTask({
        id: taskId,
        taskId,
        prompt: inputs.prompt,
        nodeTitle: node.data.title,
        status: result.status,
        progress: result.progress,
        videoUrl: result.videoUrl,
        createdAt: Date.now(),
      })
    },
  })

  if (pollResult.status !== 'succeeded') {
    deps.updateNodeData(node.id, {
      status: 'failed',
      progress: pollResult.progress,
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
      error: '生成成功但未返回视频地址',
    })
    throw new Error('生成成功但未返回视频地址')
  }

  let finalVideoUrl: string = remoteVideoUrl

  try {
    const saveResponse = await fetch('/api/videos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceUrl: finalVideoUrl }),
    })
    const saveResult = await saveResponse.json()
    if (saveResponse.ok && typeof saveResult.videoUrl === 'string')
      finalVideoUrl = saveResult.videoUrl
  }
  catch (saveError) {
    console.error('保存视频到本地失败，将使用远程 URL:', saveError)
  }

  deps.updateNodeData(node.id, {
    status: 'succeeded',
    taskId,
    progress: 100,
  })
  deps.upsertLocalTask({
    id: taskId,
    taskId,
    prompt: inputs.prompt,
    nodeTitle: node.data.title,
    status: 'succeeded',
    progress: 100,
    videoUrl: finalVideoUrl,
    createdAt: Date.now(),
  })

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
