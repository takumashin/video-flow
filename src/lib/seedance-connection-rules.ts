import type { AudioContentItem, ImageContentItem, ImageRole, SeedanceGenerationMode, VideoContentItem, WorkflowEdge, WorkflowNode } from './types'
import { NodeType } from './types'
import { validateSeedanceMode } from './seedance-modes'
import { getOrderedUpstreamImageNodes, getUpstreamNodes } from './workflow-engine'

export function resolveSeedanceModeForConnection(
  sourceNode: WorkflowNode,
  targetNode: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): SeedanceGenerationMode | null {
  if (targetNode.data.type !== NodeType.Seedance)
    return null

  const currentMode = targetNode.data.generationMode ?? 'text_to_video'

  if (sourceNode.data.type === NodeType.ImageInput) {
    if (currentMode === 'text_to_video')
      return 'image_to_video'

    const existingCount = countUpstreamImageConnections(targetNode.id, nodes, edges, {
      excludeSourceId: sourceNode.id,
    })
    const totalAfterConnect = existingCount + 1

    if (currentMode === 'image_to_video' && totalAfterConnect >= 2)
      return 'first_last_frame'

    return null
  }

  if (
    sourceNode.data.type === NodeType.VideoInput
    || sourceNode.data.type === NodeType.AudioInput
  ) {
    if (currentMode !== 'omni_reference')
      return 'omni_reference'
  }

  return null
}

export type SeedanceModeInputRules = {
  allowImages: boolean
  maxImages: number
  allowVideos: boolean
  maxVideos: number
  allowAudios: boolean
  maxAudios: number
  allowTextUpstream: boolean
  hint: string
}

export function getSeedanceModeInputRules(mode: SeedanceGenerationMode): SeedanceModeInputRules {
  switch (mode) {
    case 'text_to_video':
      return {
        allowImages: false,
        maxImages: 0,
        allowVideos: false,
        maxVideos: 0,
        allowAudios: false,
        maxAudios: 0,
        allowTextUpstream: true,
        hint: '文生视频：仅填写文本描述，请勿连接参考图片',
      }
    case 'image_to_video':
      return {
        allowImages: true,
        maxImages: 1,
        allowVideos: false,
        maxVideos: 0,
        allowAudios: false,
        maxAudios: 0,
        allowTextUpstream: true,
        hint: '图生视频：可连接 1 张首帧图 + 文本描述',
      }
    case 'first_last_frame':
      return {
        allowImages: true,
        maxImages: 2,
        allowVideos: false,
        maxVideos: 0,
        allowAudios: false,
        maxAudios: 0,
        allowTextUpstream: true,
        hint: '首尾帧：最多连接 2 张图（首帧 + 尾帧），可配合文本描述',
      }
    case 'omni_reference':
      return {
        allowImages: true,
        maxImages: 9,
        allowVideos: true,
        maxVideos: 3,
        allowAudios: true,
        maxAudios: 3,
        allowTextUpstream: true,
        hint: '全能参考：最多 9 张图 + 3 视频 + 3 音频，可配合文本描述',
      }
  }
}

export function countUpstreamVideoConnections(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: { excludeSourceId?: string },
): number {
  return edges.filter(edge => {
    if (edge.target !== seedanceNodeId)
      return false
    if (options?.excludeSourceId && edge.source === options.excludeSourceId)
      return false
    const source = nodes.find(node => node.id === edge.source)
    return source?.data.type === NodeType.VideoInput
  }).length
}

export function countUpstreamAudioConnections(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: { excludeSourceId?: string },
): number {
  return edges.filter(edge => {
    if (edge.target !== seedanceNodeId)
      return false
    if (options?.excludeSourceId && edge.source === options.excludeSourceId)
      return false
    const source = nodes.find(node => node.id === edge.source)
    return source?.data.type === NodeType.AudioInput
  }).length
}

export function countUpstreamImageConnections(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  options?: { excludeSourceId?: string },
): number {
  return edges.filter(edge => {
    if (edge.target !== seedanceNodeId)
      return false
    if (options?.excludeSourceId && edge.source === options.excludeSourceId)
      return false
    const source = nodes.find(node => node.id === edge.source)
    return source?.data.type === NodeType.ImageInput
  }).length
}

export type ConnectionEndpoints = {
  source?: string | null
  target?: string | null
}

export function validateSeedanceConnection(
  connection: ConnectionEndpoints,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { ok: true } | { ok: false; reason: string } {
  const { source, target } = connection
  if (!source || !target)
    return { ok: false, reason: '连接无效' }

  const targetNode = nodes.find(node => node.id === target)
  const sourceNode = nodes.find(node => node.id === source)
  if (!targetNode || !sourceNode)
    return { ok: false, reason: '节点不存在' }

  if (targetNode.data.type !== NodeType.Seedance)
    return { ok: true }

  const autoMode = resolveSeedanceModeForConnection(sourceNode, targetNode, nodes, edges)
  const mode = autoMode ?? (targetNode.data.generationMode ?? 'text_to_video')
  const rules = getSeedanceModeInputRules(mode)

  if (sourceNode.data.type === NodeType.TextPrompt) {
    if (!rules.allowTextUpstream)
      return { ok: false, reason: '当前生成模式不支持连接文本节点' }
    return { ok: true }
  }

  if (sourceNode.data.type === NodeType.ImageInput) {
    if (!rules.allowImages)
      return { ok: false, reason: '文生视频模式不能连接参考图片，请切换为图生视频等模式' }

    const existingCount = countUpstreamImageConnections(target, nodes, edges, {
      excludeSourceId: source,
    })
    if (existingCount >= rules.maxImages) {
      if (mode === 'image_to_video')
        return { ok: false, reason: '图生视频模式最多连接 1 张参考图片' }
      if (mode === 'first_last_frame')
        return { ok: false, reason: '首尾帧模式最多连接 2 张参考图片' }
      if (mode === 'omni_reference')
        return { ok: false, reason: '全能参考模式最多连接 9 张参考图片' }
      return { ok: false, reason: '当前模式已达到参考图片数量上限' }
    }

    return { ok: true }
  }

  if (sourceNode.data.type === NodeType.VideoInput) {
    if (!rules.allowVideos)
      return { ok: false, reason: '参考视频仅支持全能参考模式' }

    const existingCount = countUpstreamVideoConnections(target, nodes, edges, {
      excludeSourceId: source,
    })
    if (existingCount >= rules.maxVideos)
      return { ok: false, reason: '全能参考模式最多连接 3 个参考视频' }

    return { ok: true }
  }

  if (sourceNode.data.type === NodeType.AudioInput) {
    if (!rules.allowAudios)
      return { ok: false, reason: '参考音频仅支持全能参考模式' }

    const existingCount = countUpstreamAudioConnections(target, nodes, edges, {
      excludeSourceId: source,
    })
    if (existingCount >= rules.maxAudios)
      return { ok: false, reason: '全能参考模式最多连接 3 个参考音频' }

    return { ok: true }
  }

  return { ok: true }
}

/** 按生成模式为已连接的图片节点写入正确角色（首尾帧：首连=首帧，次连=尾帧） */
export function applySeedanceImageRolesForMode(
  seedanceNodeId: string,
  mode: SeedanceGenerationMode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  const imageNodes = getOrderedUpstreamImageNodes(seedanceNodeId, nodes, edges)
  if (imageNodes.length === 0)
    return nodes

  const roleByNodeId = new Map<string, ImageRole>()

  switch (mode) {
    case 'image_to_video':
      roleByNodeId.set(imageNodes[0].id, 'first_frame')
      break
    case 'first_last_frame':
      if (imageNodes[0])
        roleByNodeId.set(imageNodes[0].id, 'first_frame')
      if (imageNodes[1])
        roleByNodeId.set(imageNodes[1].id, 'last_frame')
      break
    case 'omni_reference':
      imageNodes.forEach(node => roleByNodeId.set(node.id, 'reference_image'))
      break
    default:
      return nodes
  }

  return nodes.map(node => {
    const role = roleByNodeId.get(node.id)
    if (!role || node.data.type !== NodeType.ImageInput)
      return node
    if (node.data.role === role)
      return node
    return { ...node, data: { ...node.data, role } }
  })
}

/** 为工作流中所有 Seedance 节点同步图片角色 */
export function normalizeWorkflowImageRoles(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): WorkflowNode[] {
  let nextNodes = nodes
  for (const node of nodes) {
    if (node.data.type !== NodeType.Seedance)
      continue
    const mode = node.data.generationMode ?? 'text_to_video'
    nextNodes = applySeedanceImageRolesForMode(node.id, mode, nextNodes, edges)
  }
  return nextNodes
}

export function pruneSeedanceUpstreamEdges(
  seedanceNodeId: string,
  mode: SeedanceGenerationMode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { edges: WorkflowEdge[]; removedCount: number } {
  const rules = getSeedanceModeInputRules(mode)
  const incoming = edges.filter(edge => edge.target === seedanceNodeId)

  const imageEdges = incoming.filter(edge => {
    const source = nodes.find(node => node.id === edge.source)
    return source?.data.type === NodeType.ImageInput
  })

  const videoEdges = incoming.filter(edge => {
    const source = nodes.find(node => node.id === edge.source)
    return source?.data.type === NodeType.VideoInput
  })

  const audioEdges = incoming.filter(edge => {
    const source = nodes.find(node => node.id === edge.source)
    return source?.data.type === NodeType.AudioInput
  })

  const removeIds = new Set<string>()

  if (!rules.allowImages) {
    imageEdges.forEach(edge => removeIds.add(edge.id))
  }
  else if (imageEdges.length > rules.maxImages) {
    imageEdges.slice(rules.maxImages).forEach(edge => removeIds.add(edge.id))
  }

  if (!rules.allowVideos) {
    videoEdges.forEach(edge => removeIds.add(edge.id))
  }
  else if (videoEdges.length > rules.maxVideos) {
    videoEdges.slice(rules.maxVideos).forEach(edge => removeIds.add(edge.id))
  }

  if (!rules.allowAudios) {
    audioEdges.forEach(edge => removeIds.add(edge.id))
  }
  else if (audioEdges.length > rules.maxAudios) {
    audioEdges.slice(rules.maxAudios).forEach(edge => removeIds.add(edge.id))
  }

  if (removeIds.size === 0)
    return { edges, removedCount: 0 }

  return {
    edges: edges.filter(edge => !removeIds.has(edge.id)),
    removedCount: removeIds.size,
  }
}

/** 运行前校验：按模式检查已连接素材数量 */
export function validateSeedanceModeInputs(
  mode: SeedanceGenerationMode,
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): string | null {
  const rules = getSeedanceModeInputRules(mode)
  const upstream = getUpstreamNodes(seedanceNodeId, nodes, edges)
  const imageCount = upstream.filter(node => node.data.type === NodeType.ImageInput).length
  const videoCount = upstream.filter(node => node.data.type === NodeType.VideoInput).length
  const audioCount = upstream.filter(node => node.data.type === NodeType.AudioInput).length
  const textCount = upstream.filter(node => node.data.type === NodeType.TextPrompt).length

  if (!rules.allowImages && imageCount > 0)
    return '文生视频模式不能连接参考图片，请断开图片节点或切换生成模式'

  if (!rules.allowVideos && videoCount > 0)
    return '当前模式不能连接参考视频，请切换为全能参考模式'

  if (!rules.allowAudios && audioCount > 0)
    return '当前模式不能连接参考音频，请切换为全能参考模式'

  if (rules.allowImages && imageCount > rules.maxImages) {
    if (mode === 'image_to_video')
      return '图生视频模式最多连接 1 张参考图片'
    if (mode === 'first_last_frame')
      return '首尾帧模式最多连接 2 张参考图片'
    if (mode === 'omni_reference')
      return '全能参考模式最多连接 9 张参考图片'
    return `当前模式最多连接 ${rules.maxImages} 张参考图片`
  }

  if (rules.allowVideos && videoCount > rules.maxVideos)
    return '全能参考模式最多连接 3 个参考视频'

  if (rules.allowAudios && audioCount > rules.maxAudios)
    return '全能参考模式最多连接 3 个参考音频'

  if (!rules.allowTextUpstream && textCount > 0)
    return '当前生成模式不支持连接文本节点'

  const images: ImageContentItem[] = []
  for (const node of upstream) {
    if (node.data.type !== NodeType.ImageInput)
      continue
    const imageData = node.data
    if (!imageData.imageUrl.trim())
      continue
    images.push({
      imageUrl: imageData.imageUrl.trim(),
      imageRole: imageData.role,
    })
  }

  const videos: VideoContentItem[] = []
  for (const node of upstream) {
    if (node.data.type !== NodeType.VideoInput)
      continue
    const videoData = node.data
    if (!videoData.mediaUrl.trim())
      continue
    videos.push({ videoUrl: videoData.mediaUrl.trim() })
  }

  const audios: AudioContentItem[] = []
  for (const node of upstream) {
    if (node.data.type !== NodeType.AudioInput)
      continue
    const audioData = node.data
    if (!audioData.mediaUrl.trim())
      continue
    audios.push({ audioUrl: audioData.mediaUrl.trim() })
  }

  return validateSeedanceMode(mode, images, { videos, audios })
}
