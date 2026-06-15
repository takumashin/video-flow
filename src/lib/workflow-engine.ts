import type {
  AudioContentItem,
  ImageContentItem,
  SeedanceGenerationMode,
  VideoContentItem,
  WorkflowEdge,
  WorkflowNode,
} from './types'
import { NodeType } from './types'
import { prepareAudiosForMode, prepareImagesForMode, prepareVideosForMode } from './seedance-modes'
import { validateSeedanceModeInputs } from './seedance-connection-rules'
import {
  buildSeedanceExecutionPrompt,
  getSeedanceUpstreamRefs,
  hasSeedancePromptContent,
} from './seedance-upstream'

export function getUpstreamNodes(nodeId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const incoming = edges.filter(edge => edge.target === nodeId)
  const upstreamIds = new Set(incoming.map(edge => edge.source))
  return nodes.filter(node => upstreamIds.has(node.id))
}

/** 按连线顺序返回连到 Seedance 的上游图片节点（与 edges 数组顺序一致） */
export function getOrderedUpstreamImageNodes(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const ordered: WorkflowNode[] = []
  const seen = new Set<string>()

  for (const edge of edges) {
    if (edge.target !== seedanceNodeId)
      continue
    if (seen.has(edge.source))
      continue
    const source = nodes.find(node => node.id === edge.source)
    if (source?.data.type !== NodeType.ImageInput)
      continue
    seen.add(source.id)
    ordered.push(source)
  }

  return ordered
}

/** 按连线顺序返回连到 Seedance 的上游视频节点 */
export function getOrderedUpstreamVideoNodes(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const ordered: WorkflowNode[] = []
  const seen = new Set<string>()

  for (const edge of edges) {
    if (edge.target !== seedanceNodeId)
      continue
    if (seen.has(edge.source))
      continue
    const source = nodes.find(node => node.id === edge.source)
    if (source?.data.type !== NodeType.VideoInput)
      continue
    seen.add(source.id)
    ordered.push(source)
  }

  return ordered
}

/** 按连线顺序返回连到 Seedance 的上游音频节点 */
export function getOrderedUpstreamAudioNodes(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const ordered: WorkflowNode[] = []
  const seen = new Set<string>()

  for (const edge of edges) {
    if (edge.target !== seedanceNodeId)
      continue
    if (seen.has(edge.source))
      continue
    const source = nodes.find(node => node.id === edge.source)
    if (source?.data.type !== NodeType.AudioInput)
      continue
    seen.add(source.id)
    ordered.push(source)
  }

  return ordered
}

export function getDownstreamNodes(nodeId: string, nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const outgoing = edges.filter(edge => edge.source === nodeId)
  const downstreamIds = new Set(outgoing.map(edge => edge.target))
  return nodes.filter(node => downstreamIds.has(node.id))
}

export function findStartNode(nodes: WorkflowNode[]): WorkflowNode | undefined {
  return nodes.find(node => node.data.type === NodeType.Start)
}

export function topologicalOrder(nodes: WorkflowNode[], edges: WorkflowEdge[]): WorkflowNode[] {
  const start = findStartNode(nodes)
  if (!start)
    return nodes

  const visited = new Set<string>()
  const order: WorkflowNode[] = []

  const walk = (nodeId: string) => {
    if (visited.has(nodeId))
      return
    visited.add(nodeId)

    const node = nodes.find(n => n.id === nodeId)
    if (node)
      order.push(node)

    getDownstreamNodes(nodeId, nodes, edges).forEach(child => walk(child.id))
  }

  walk(start.id)
  return order
}

export function validateSeedanceNode(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string | null {
  const seedanceNode = nodes.find(node => node.id === seedanceNodeId)
  if (!seedanceNode || seedanceNode.data.type !== NodeType.Seedance)
    return '无效的 Seedance 生成节点'

  const data = seedanceNode.data

  if (!hasSeedancePromptContent(seedanceNode))
    return `节点「${data.title}」请在节点内填写视频描述（文本提示词）`

  const mode = data.generationMode ?? 'text_to_video'
  const modeError = validateSeedanceModeInputs(mode, seedanceNode.id, nodes, edges)
  if (modeError)
    return `节点「${data.title}」：${modeError}`

  return null
}

export function validateWorkflow(nodes: WorkflowNode[], edges: WorkflowEdge[]): string | null {
  const seedanceNodes = nodes.filter(node => node.data.type === NodeType.Seedance)

  if (seedanceNodes.length === 0)
    return '工作流缺少「Seedance 生成」节点'

  for (const seedanceNode of seedanceNodes) {
    const error = validateSeedanceNode(seedanceNode.id, nodes, edges)
    if (error)
      return error
  }

  return null
}

export type ExecutionContext = {
  prompt?: string
  images?: ImageContentItem[]
  videos?: VideoContentItem[]
  audios?: AudioContentItem[]
  videoUrl?: string
  taskId?: string
}

function mergeImages(target: ImageContentItem[], source?: ImageContentItem[]) {
  if (!source?.length)
    return
  target.push(...source)
}

function mergeVideos(target: VideoContentItem[], source?: VideoContentItem[]) {
  if (!source?.length)
    return
  target.push(...source)
}

function mergeAudios(target: AudioContentItem[], source?: AudioContentItem[]) {
  if (!source?.length)
    return
  target.push(...source)
}

export function collectInputsForNode(
  node: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  context: Map<string, ExecutionContext>,
): ExecutionContext {
  const upstream = getUpstreamNodes(node.id, nodes, edges)
  const merged: ExecutionContext = {}
  const images: ImageContentItem[] = []
  const videos: VideoContentItem[] = []
  const audios: AudioContentItem[] = []

  for (const up of upstream) {
    const ctx = context.get(up.id)
    if (!ctx)
      continue
    if (ctx.prompt)
      merged.prompt = ctx.prompt
    mergeImages(images, ctx.images)
    mergeVideos(videos, ctx.videos)
    mergeAudios(audios, ctx.audios)
    if (ctx.videoUrl)
      merged.videoUrl = ctx.videoUrl
    if (ctx.taskId)
      merged.taskId = ctx.taskId
  }

  if (images.length > 0)
    merged.images = images
  if (videos.length > 0)
    merged.videos = videos
  if (audios.length > 0)
    merged.audios = audios

  if (node.data.type === NodeType.Seedance) {
    const built = buildSeedanceExecutionPrompt(node, nodes, edges)
    if (built.prompt)
      merged.prompt = built.prompt
    if (built.images.length > 0)
      merged.images = built.images
    if (built.videos.length > 0)
      merged.videos = built.videos
    if (built.audios.length > 0)
      merged.audios = built.audios
    return merged
  }

  if (node.data.type === NodeType.TextPrompt) {
    merged.prompt = node.data.prompt
  }

  if (node.data.type === NodeType.ImageInput && node.data.imageUrl.trim()) {
    const item: ImageContentItem = {
      imageUrl: node.data.imageUrl.trim(),
      imageRole: node.data.role,
    }
    merged.images = [...(merged.images ?? []), item]
  }

  if (node.data.type === NodeType.VideoInput && node.data.mediaUrl.trim()) {
    merged.videos = [...(merged.videos ?? []), { videoUrl: node.data.mediaUrl.trim() }]
  }

  if (node.data.type === NodeType.AudioInput && node.data.mediaUrl.trim()) {
    merged.audios = [...(merged.audios ?? []), { audioUrl: node.data.mediaUrl.trim() }]
  }

  return merged
}

export function prepareSeedanceRequestVideos(
  node: WorkflowNode,
  videos?: VideoContentItem[],
): VideoContentItem[] {
  if (node.data.type !== NodeType.Seedance)
    return videos ?? []

  const mode = node.data.generationMode ?? 'text_to_video'
  return prepareVideosForMode(mode, videos)
}

export function prepareSeedanceRequestAudios(
  node: WorkflowNode,
  audios?: AudioContentItem[],
): AudioContentItem[] {
  if (node.data.type !== NodeType.Seedance)
    return audios ?? []

  const mode = node.data.generationMode ?? 'text_to_video'
  return prepareAudiosForMode(mode, audios)
}

export function prepareSeedanceRequestImages(
  node: WorkflowNode,
  images?: ImageContentItem[],
): ImageContentItem[] {
  if (node.data.type !== NodeType.Seedance)
    return images ?? []

  const mode = node.data.generationMode ?? 'text_to_video'
  return prepareImagesForMode(mode, images)
}
