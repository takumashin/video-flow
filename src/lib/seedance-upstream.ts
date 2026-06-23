import type {
  AudioContentItem,
  ImageContentItem,
  ImageRole,
  SeedanceGenerationMode,
  SeedanceNodeData,
  VideoContentItem,
  WorkflowEdge,
  WorkflowNode,
} from './types'
import { NodeType } from './types'
import {
  getOrderedUpstreamAudioNodes,
  getOrderedUpstreamImageNodes,
  getOrderedUpstreamVideoNodes,
  getUpstreamNodes,
} from './workflow-engine'

export type UpstreamTextRef = {
  nodeId: string
  title: string
  prompt: string
}

export type UpstreamImageRef = {
  nodeId: string
  title: string
  imageUrl: string
  role: ImageRole
  index: number
}

export type UpstreamVideoRef = {
  nodeId: string
  title: string
  mediaUrl: string
  index: number
}

export type UpstreamAudioRef = {
  nodeId: string
  title: string
  mediaUrl: string
  index: number
}

export type SeedanceUpstreamRefs = {
  texts: UpstreamTextRef[]
  images: UpstreamImageRef[]
  videos: UpstreamVideoRef[]
  audios: UpstreamAudioRef[]
}

const IMAGE_ROLE_LABEL: Record<ImageRole, string> = {
  first_frame: '首帧',
  last_frame: '尾帧',
  reference_image: '全能参考',
}

export function getImageRoleLabel(role: ImageRole): string {
  return IMAGE_ROLE_LABEL[role]
}

export function shouldShowImageRoleInPreview(mode: SeedanceGenerationMode): boolean {
  return mode === 'first_last_frame'
}

/** 首尾帧等模式下，按连线顺序推导展示/API 用角色（不依赖节点上可能过期的 role 字段） */
export function resolveUpstreamImageRole(
  mode: SeedanceGenerationMode,
  orderIndex: number,
  storedRole: ImageRole,
): ImageRole {
  switch (mode) {
    case 'first_last_frame':
      if (storedRole === 'first_frame' || storedRole === 'last_frame')
        return storedRole
      if (orderIndex === 1)
        return 'first_frame'
      if (orderIndex === 2)
        return 'last_frame'
      return storedRole
    case 'image_to_video':
      return 'first_frame'
    case 'omni_reference':
      return 'reference_image'
    default:
      return storedRole
  }
}

/** 图片节点若已连到 Seedance，返回该节点的生成模式 */
export function getConnectedSeedanceModeForImageNode(
  imageNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): SeedanceGenerationMode | null {
  for (const edge of edges) {
    if (edge.source !== imageNodeId)
      continue
    const target = nodes.find(node => node.id === edge.target)
    if (target?.data.type === NodeType.Seedance)
      return target.data.generationMode ?? 'text_to_video'
  }
  return null
}

/** 读取节点内编辑中的提示词（保留空格，不做 trim） */
export function readSeedanceNodePrompt(data: SeedanceNodeData): string {
  const legacy = (data as SeedanceNodeData & { composedPrompt?: string }).composedPrompt
  return data.prompt ?? legacy ?? ''
}

export function getSeedanceUpstreamRefs(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): SeedanceUpstreamRefs {
  const seedanceNode = nodes.find(node => node.id === seedanceNodeId)
  const mode: SeedanceGenerationMode = seedanceNode?.data.type === NodeType.Seedance
    ? (seedanceNode.data.generationMode ?? 'text_to_video')
    : 'text_to_video'

  const upstream = getUpstreamNodes(seedanceNodeId, nodes, edges)
  const texts: UpstreamTextRef[] = []
  const images: UpstreamImageRef[] = []
  const videos: UpstreamVideoRef[] = []
  const audios: UpstreamAudioRef[] = []
  let imageIndex = 0
  let videoIndex = 0
  let audioIndex = 0

  for (const node of upstream) {
    if (node.data.type === NodeType.TextPrompt) {
      texts.push({
        nodeId: node.id,
        title: node.data.title,
        prompt: node.data.prompt,
      })
    }
  }

  const orderedImages = getOrderedUpstreamImageNodes(seedanceNodeId, nodes, edges)
  for (const node of orderedImages) {
    if (node.data.type !== NodeType.ImageInput || !node.data.imageUrl.trim())
      continue
    imageIndex += 1
    images.push({
      nodeId: node.id,
      title: node.data.title,
      imageUrl: node.data.imageUrl.trim(),
      role: resolveUpstreamImageRole(mode, imageIndex, node.data.role),
      index: imageIndex,
    })
  }

  const orderedVideos = getOrderedUpstreamVideoNodes(seedanceNodeId, nodes, edges)
  for (const node of orderedVideos) {
    // 处理 VideoInput 节点
    if (node.data.type === NodeType.VideoInput && node.data.mediaUrl.trim()) {
      videoIndex += 1
      videos.push({
        nodeId: node.id,
        title: node.data.title,
        mediaUrl: node.data.mediaUrl.trim(),
        index: videoIndex,
      })
      continue
    }
    // 处理 Seedance 节点（续写功能）
    if (node.data.type === NodeType.Seedance) {
      const seedanceData = node.data
      // 优先使用 videoUrl，否则使用 videoHistory 中最新的视频
      let videoUrl = seedanceData.videoUrl
      if (!videoUrl && seedanceData.videoHistory && seedanceData.videoHistory.length > 0) {
        videoUrl = seedanceData.videoHistory[0].videoUrl
      }
      if (videoUrl && videoUrl.trim()) {
        videoIndex += 1
        videos.push({
          nodeId: node.id,
          title: seedanceData.title || 'Seedance 生成视频',
          mediaUrl: videoUrl.trim(),
          index: videoIndex,
        })
      }
    }
  }

  const orderedAudios = getOrderedUpstreamAudioNodes(seedanceNodeId, nodes, edges)
  for (const node of orderedAudios) {
    if (node.data.type !== NodeType.AudioInput || !node.data.mediaUrl.trim())
      continue
    audioIndex += 1
    audios.push({
      nodeId: node.id,
      title: node.data.title,
      mediaUrl: node.data.mediaUrl.trim(),
      index: audioIndex,
    })
  }

  return { texts, images, videos, audios }
}

export type MentionOption = {
  id: string
  label: string
  description?: string
  insert: string
  kind: 'image' | 'video' | 'audio' | 'text'
  imageUrl?: string
  mediaUrl?: string
}

export type PromptDisplaySegment =
  | { type: 'text'; value: string }
  | { type: 'image'; index: number; label: string; imageUrl?: string }
  | { type: 'video'; index: number; label: string; mediaUrl?: string }
  | { type: 'audio'; index: number; label: string; mediaUrl?: string }

const MEDIA_MENTION_RE = /@(图片|视频|音频)(\d+)/g

const MENTION_KIND_MAP: Record<string, 'image' | 'video' | 'audio'> = {
  图片: 'image',
  视频: 'video',
  音频: 'audio',
}

/** 移除某张上游素材后，清理并重新编号提示词中的 @标签N */
export function updatePromptAfterMentionRemoval(prompt: string, removedIndex: number, label: string): string {
  let result = prompt.replace(new RegExp(`@${label}${removedIndex}(?![0-9])`, 'g'), '')
  for (let i = removedIndex + 1; i <= 99; i++)
    result = result.replace(new RegExp(`@${label}${i}(?![0-9])`, 'g'), `@${label}${i - 1}`)
  return result
}

/** 移除某张上游图片后，清理并重新编号提示词中的 @图片N */
export function updatePromptAfterImageRemoval(prompt: string, removedIndex: number): string {
  return updatePromptAfterMentionRemoval(prompt, removedIndex, '图片')
}

export function updatePromptAfterVideoRemoval(prompt: string, removedIndex: number): string {
  return updatePromptAfterMentionRemoval(prompt, removedIndex, '视频')
}

export function updatePromptAfterAudioRemoval(prompt: string, removedIndex: number): string {
  return updatePromptAfterMentionRemoval(prompt, removedIndex, '音频')
}

/** 将提示词拆成普通文本与 @图片N / @视频N / @音频N 片段，用于输入框内嵌 chip 展示 */
export function splitPromptByMentions(
  text: string,
  refs: SeedanceUpstreamRefs,
): PromptDisplaySegment[] {
  if (!text)
    return []

  const matches: Array<{ start: number; end: number; segment: PromptDisplaySegment }> = []

  for (const match of text.matchAll(MEDIA_MENTION_RE)) {
    const start = match.index ?? 0
    const label = match[0]
    const kindKey = match[1]
    const mediaKind = MENTION_KIND_MAP[kindKey]
    const index = Number(match[2])

    if (!mediaKind)
      continue

    if (mediaKind === 'image') {
      const image = refs.images.find(img => img.index === index)
      matches.push({
        start,
        end: start + label.length,
        segment: {
          type: 'image',
          index,
          label,
          imageUrl: image?.imageUrl,
        },
      })
    }
    else if (mediaKind === 'video') {
      const video = refs.videos.find(item => item.index === index)
      matches.push({
        start,
        end: start + label.length,
        segment: {
          type: 'video',
          index,
          label,
          mediaUrl: video?.mediaUrl,
        },
      })
    }
    else {
      const audio = refs.audios.find(item => item.index === index)
      matches.push({
        start,
        end: start + label.length,
        segment: {
          type: 'audio',
          index,
          label,
          mediaUrl: audio?.mediaUrl,
        },
      })
    }
  }

  matches.sort((a, b) => a.start - b.start)

  const segments: PromptDisplaySegment[] = []
  let lastIndex = 0

  for (const match of matches) {
    if (match.start < lastIndex)
      continue
    if (match.start > lastIndex)
      segments.push({ type: 'text', value: text.slice(lastIndex, match.start) })
    segments.push(match.segment)
    lastIndex = match.end
  }

  if (lastIndex < text.length)
    segments.push({ type: 'text', value: text.slice(lastIndex) })

  return segments
}

/** @deprecated 使用 splitPromptByMentions */
export function splitPromptByImageMentions(
  text: string,
  refs: SeedanceUpstreamRefs,
): PromptDisplaySegment[] {
  return splitPromptByMentions(text, refs)
}

export function buildMentionOptions(
  refs: SeedanceUpstreamRefs,
  mode?: SeedanceGenerationMode,
): MentionOption[] {
  const options: MentionOption[] = []
  const showRole = mode != null && shouldShowImageRoleInPreview(mode)

  for (const image of refs.images) {
    options.push({
      id: `image-${image.nodeId}`,
      label: `图片${image.index}`,
      description: showRole
        ? `${image.title} · ${getImageRoleLabel(image.role)}`
        : image.title,
      insert: `@图片${image.index}`,
      kind: 'image',
      imageUrl: image.imageUrl,
    })
  }

  for (const video of refs.videos) {
    options.push({
      id: `video-${video.nodeId}`,
      label: `视频${video.index}`,
      description: video.title,
      insert: `@视频${video.index}`,
      kind: 'video',
      mediaUrl: video.mediaUrl,
    })
  }

  for (const audio of refs.audios) {
    options.push({
      id: `audio-${audio.nodeId}`,
      label: `音频${audio.index}`,
      description: audio.title,
      insert: `@音频${audio.index}`,
      kind: 'audio',
      mediaUrl: audio.mediaUrl,
    })
  }

  for (const text of refs.texts) {
    options.push({
      id: `text-${text.nodeId}`,
      label: text.title,
      description: text.prompt.trim() ? text.prompt.slice(0, 48) : '空文本',
      insert: `@文本:${text.title}`,
      kind: 'text',
    })
  }

  return options
}

export function resolvePromptMentions(
  prompt: string,
  refs: SeedanceUpstreamRefs,
): string {
  let resolved = prompt

  for (const image of refs.images) {
    resolved = resolved.replaceAll(`@图片${image.index}`, `图片${image.index}`)
    resolved = resolved.replaceAll(`@${image.title}`, `图片${image.index}`)
  }

  for (const video of refs.videos) {
    resolved = resolved.replaceAll(`@视频${video.index}`, `视频${video.index}`)
    resolved = resolved.replaceAll(`@${video.title}`, `视频${video.index}`)
  }

  for (const audio of refs.audios) {
    resolved = resolved.replaceAll(`@音频${audio.index}`, `音频${audio.index}`)
    resolved = resolved.replaceAll(`@${audio.title}`, `音频${audio.index}`)
  }

  for (const text of refs.texts) {
    const tag = `@文本:${text.title}`
    if (resolved.includes(tag) && text.prompt.trim())
      resolved = resolved.replaceAll(tag, text.prompt.trim())
  }

  return resolved.trim()
}

export function buildSeedanceExecutionPrompt(
  seedanceNode: WorkflowNode,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { prompt: string; images: ImageContentItem[]; videos: VideoContentItem[]; audios: AudioContentItem[] } {
  const data = seedanceNode.data
  if (data.type !== NodeType.Seedance)
    return { prompt: '', images: [], videos: [], audios: [] }

  const refs = getSeedanceUpstreamRefs(seedanceNode.id, nodes, edges)
  const images: ImageContentItem[] = refs.images.map(image => ({
    imageUrl: image.imageUrl,
    imageRole: image.role,
  }))
  const videos: VideoContentItem[] = refs.videos.map(video => ({
    videoUrl: video.mediaUrl,
  }))
  const audios: AudioContentItem[] = refs.audios.map(audio => ({
    audioUrl: audio.mediaUrl,
  }))

  const prompt = readSeedanceNodePrompt(data)
  if (!prompt.trim())
    return { prompt: '', images, videos, audios }

  return {
    prompt: resolvePromptMentions(prompt, refs),
    images,
    videos,
    audios,
  }
}

export function hasSeedancePromptContent(
  seedanceNode: WorkflowNode,
): boolean {
  const data = seedanceNode.data
  if (data.type !== NodeType.Seedance)
    return false

  return readSeedanceNodePrompt(data).trim().length > 0
}
