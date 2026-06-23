import type { AudioContentItem, ImageContentItem, ImageRole, SeedanceGenerationMode, VideoContentItem } from './types'

export const SEEDANCE_MODE_OPTIONS: Array<{
  value: SeedanceGenerationMode
  label: string
  description: string
}> = [
  {
    value: 'text_to_video',
    label: '文生视频',
    description: '仅文本提示词，无需参考图',
  },
  {
    value: 'image_to_video',
    label: '图生视频',
    description: '1 张首帧图 + 文本描述',
  },
  {
    value: 'first_last_frame',
    label: '首尾帧',
    description: '首帧 + 尾帧各 1 张图',
  },
  {
    value: 'omni_reference',
    label: '全能参考',
    description: '最多 9 图 + 3 视频 + 3 音频（Seedance 2.0）',
  },
]

export function getModeDescription(mode: SeedanceGenerationMode): string {
  return SEEDANCE_MODE_OPTIONS.find(o => o.value === mode)?.description ?? ''
}

export function countValidImages(images?: ImageContentItem[]): number {
  return (images ?? []).filter(img => img.imageUrl?.trim()).length
}

export function prepareImagesForMode(
  mode: SeedanceGenerationMode,
  images?: ImageContentItem[],
): ImageContentItem[] {
  const valid = (images ?? []).filter(img => img.imageUrl?.trim())

  switch (mode) {
    case 'text_to_video':
      return []

    case 'image_to_video': {
      const first = valid.find(img => img.imageRole === 'first_frame') ?? valid[0]
      if (!first)
        return []
      return [{ imageUrl: first.imageUrl.trim(), imageRole: 'first_frame' }]
    }

    case 'first_last_frame': {
      const firstCandidate = valid.find(img => img.imageRole === 'first_frame') ?? valid[0]
      const lastCandidate = valid.find(img => img.imageRole === 'last_frame')
        ?? valid.find(img => img !== firstCandidate)
        ?? valid[1]

      if (!firstCandidate)
        return []

      if (!lastCandidate)
        return [{ imageUrl: firstCandidate.imageUrl.trim(), imageRole: 'first_frame' }]

      return [
        { imageUrl: firstCandidate.imageUrl.trim(), imageRole: 'first_frame' },
        { imageUrl: lastCandidate.imageUrl.trim(), imageRole: 'last_frame' },
      ]
    }

    case 'omni_reference':
      return valid.slice(0, 9).map(img => ({
        imageUrl: img.imageUrl.trim(),
        imageRole: 'reference_image' as ImageRole,
      }))
  }
}

export function countValidVideos(videos?: VideoContentItem[]): number {
  return (videos ?? []).filter(item => item.videoUrl?.trim()).length
}

export function countValidAudios(audios?: AudioContentItem[]): number {
  return (audios ?? []).filter(item => item.audioUrl?.trim()).length
}

export function prepareVideosForMode(
  mode: SeedanceGenerationMode,
  videos?: VideoContentItem[],
): VideoContentItem[] {
  if (mode !== 'omni_reference')
    return []

  return (videos ?? [])
    .filter(item => item.videoUrl?.trim())
    .slice(0, 3)
    .map(item => ({ videoUrl: item.videoUrl.trim() }))
}

export function prepareAudiosForMode(
  mode: SeedanceGenerationMode,
  audios?: AudioContentItem[],
): AudioContentItem[] {
  if (mode !== 'omni_reference')
    return []

  return (audios ?? [])
    .filter(item => item.audioUrl?.trim())
    .slice(0, 3)
    .map(item => ({ audioUrl: item.audioUrl.trim() }))
}

export function validateSeedanceMode(
  mode: SeedanceGenerationMode,
  images?: ImageContentItem[],
  options?: {
    videos?: VideoContentItem[]
    audios?: AudioContentItem[]
  },
): string | null {
  const count = countValidImages(images)
  const videoCount = countValidVideos(options?.videos)
  const audioCount = countValidAudios(options?.audios)

  switch (mode) {
    case 'text_to_video':
      if (count > 0)
        return '文生视频模式不能包含参考图片'
      return null

    case 'image_to_video':
      if (count < 1)
        return '图生视频需要连接 1 张参考图片，并确保图片已上传'
      if (count > 1)
        return '图生视频模式最多 1 张参考图片'
      return null

    case 'first_last_frame':
      if (count < 2)
        return '首尾帧模式需要连接 2 张参考图片（首帧 + 尾帧），并确保图片已上传'
      if (count > 2)
        return '首尾帧模式最多 2 张参考图片'
      return null

    case 'omni_reference':
      if (count < 1 && videoCount < 1 && audioCount < 1)
        return '全能参考需要连接至少 1 个参考素材（图片、视频或音频），并确保素材已上传'
      if (count > 9)
        return '全能参考模式最多 9 张参考图片'
      if (videoCount > 3)
        return '全能参考模式最多 3 个参考视频'
      if (audioCount > 3)
        return '全能参考模式最多 3 个参考音频'
      return null
  }
}

export function getSeedancePromptRequiredMessage(mode: SeedanceGenerationMode): string {
  switch (mode) {
    case 'text_to_video':
      return '文生视频需要填写文本描述（提示词）'
    case 'image_to_video':
      return '图生视频需要填写文本描述（提示词）'
    case 'first_last_frame':
      return '首尾帧模式需要填写文本描述（提示词）'
    case 'omni_reference':
      return '全能参考需要填写文本描述（提示词）'
  }
}

export function validateSeedanceTaskRequest(input: {
  mode: SeedanceGenerationMode
  prompt?: string | null
  images?: ImageContentItem[]
  videos?: VideoContentItem[]
  audios?: AudioContentItem[]
}): string | null {
  if (!input.prompt?.trim())
    return getSeedancePromptRequiredMessage(input.mode)

  return validateSeedanceMode(input.mode, input.images, {
    videos: input.videos,
    audios: input.audios,
  })
}
