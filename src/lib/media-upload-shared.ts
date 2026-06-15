export const MAX_IMAGE_SIZE = 10 * 1024 * 1024
export const MAX_VIDEO_SIZE = 5 * 1024 * 1024
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024

export const MAX_FILE_SIZE = MAX_IMAGE_SIZE

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/heic,image/heif'
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime'
export const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac'

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
])

const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime'])
const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac'])

export function isImageFile(file: File): boolean {
  if (IMAGE_TYPES.has(file.type))
    return true
  return /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif)$/i.test(file.name)
}

export function isVideoFile(file: File): boolean {
  if (VIDEO_TYPES.has(file.type))
    return true
  return /\.(mp4|webm|mov)$/i.test(file.name)
}

export function isAudioFile(file: File): boolean {
  if (AUDIO_TYPES.has(file.type))
    return true
  return /\.(mp3|wav|m4a|aac)$/i.test(file.name)
}

export function getImageFiles(files: FileList | File[] | null | undefined): File[] {
  if (!files)
    return []
  return Array.from(files).filter(isImageFile)
}

export function getVideoFiles(files: FileList | File[] | null | undefined): File[] {
  if (!files)
    return []
  return Array.from(files).filter(isVideoFile)
}

export function getAudioFiles(files: FileList | File[] | null | undefined): File[] {
  if (!files)
    return []
  return Array.from(files).filter(isAudioFile)
}

export type DragFileKind = 'image' | 'video' | 'audio' | 'unknown'

export function hasFileDrag(dataTransfer: DataTransfer): boolean {
  return dataTransfer.types.includes('Files')
}

/** dragover 阶段根据 DataTransfer 推断正在拖拽的文件类型 */
export function detectDragFileKinds(dataTransfer: DataTransfer): DragFileKind[] {
  const kinds = new Set<DragFileKind>()

  if (dataTransfer.items?.length) {
    for (const item of dataTransfer.items) {
      if (item.kind !== 'file')
        continue
      const type = item.type.toLowerCase()
      if (!type) {
        kinds.add('unknown')
        continue
      }
      if (type.startsWith('image/'))
        kinds.add('image')
      else if (type.startsWith('video/'))
        kinds.add('video')
      else if (type.startsWith('audio/'))
        kinds.add('audio')
      else
        kinds.add('unknown')
    }
  }

  if (kinds.size === 0 && hasFileDrag(dataTransfer))
    kinds.add('unknown')

  return Array.from(kinds)
}

export function getUploadKind(file: File): 'image' | 'video' | 'audio' | null {
  if (isImageFile(file))
    return 'image'
  if (isVideoFile(file))
    return 'video'
  if (isAudioFile(file))
    return 'audio'
  return null
}

export function getMaxSizeForKind(kind: 'image' | 'video' | 'audio'): number {
  switch (kind) {
    case 'image':
      return MAX_IMAGE_SIZE
    case 'video':
      return MAX_VIDEO_SIZE
    case 'audio':
      return MAX_AUDIO_SIZE
  }
}
