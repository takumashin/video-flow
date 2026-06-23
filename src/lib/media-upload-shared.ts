export const MAX_IMAGE_SIZE = 10 * 1024 * 1024
/** 与火山 Seedance 参考视频单文件上限一致 */
export const MAX_VIDEO_SIZE = 50 * 1024 * 1024
export const MAX_AUDIO_SIZE = 10 * 1024 * 1024

export const MAX_FILE_SIZE = MAX_IMAGE_SIZE

export const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/bmp,image/tiff,image/heic,image/heif'
export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/x-quicktime,.mp4,.webm,.mov'
export const AUDIO_ACCEPT = 'audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/mp4,audio/aac'

const IMAGE_TYPES = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/tiff', 'image/heic', 'image/heif',
])

const VIDEO_TYPES = new Set([
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-quicktime',
])

const VIDEO_EXTENSIONS = /\.(mp4|webm|mov|m4v|qt)$/i

const AUDIO_TYPES = new Set(['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/x-wav', 'audio/mp4', 'audio/aac'])

const EXT_TO_MIME: Record<string, string> = {
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.bmp': 'image/bmp',
  '.tif': 'image/tiff',
  '.tiff': 'image/tiff',
  '.heic': 'image/heic',
  '.heif': 'image/heif',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
  '.m4v': 'video/mp4',
  '.qt': 'video/quicktime',
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
}

const GENERIC_MIME_TYPES = new Set(['', 'application/octet-stream', 'binary/octet-stream'])

export function normalizeMimeType(mime: string): string {
  return mime.split(';')[0].trim().toLowerCase()
}

export function getMimeTypeFromFileName(filename: string): string | null {
  const match = filename.match(/(\.[a-z0-9]+)$/i)
  if (!match)
    return null
  return EXT_TO_MIME[match[1].toLowerCase()] ?? null
}

export function resolveUploadMimeType(
  file: File,
  kind: 'image' | 'video' | 'audio',
): string {
  const browserMime = normalizeMimeType(file.type)

  if (browserMime === 'video/x-quicktime')
    return 'video/quicktime'

  if (browserMime && !GENERIC_MIME_TYPES.has(browserMime)) {
    if (kind === 'video' && (VIDEO_TYPES.has(browserMime) || browserMime.startsWith('video/')))
      return browserMime
    if (kind === 'audio' && (AUDIO_TYPES.has(browserMime) || browserMime.startsWith('audio/')))
      return browserMime
    if (kind === 'image' && (IMAGE_TYPES.has(browserMime) || browserMime.startsWith('image/')))
      return browserMime
  }

  const fromName = getMimeTypeFromFileName(file.name)
  if (fromName) {
    if (kind === 'video' && fromName.startsWith('video/'))
      return fromName
    if (kind === 'audio' && fromName.startsWith('audio/'))
      return fromName
    if (kind === 'image' && fromName.startsWith('image/'))
      return fromName
  }

  if (kind === 'video')
    return 'video/mp4'
  if (kind === 'audio')
    return 'audio/mpeg'
  return 'image/jpeg'
}

export function isImageFile(file: File): boolean {
  if (IMAGE_TYPES.has(file.type))
    return true
  return /\.(jpe?g|png|webp|gif|bmp|tiff?|heic|heif)$/i.test(file.name)
}

export function isVideoFile(file: File): boolean {
  const mime = normalizeMimeType(file.type)
  if (VIDEO_TYPES.has(mime))
    return true
  if (mime.startsWith('video/') && VIDEO_EXTENSIONS.test(file.name))
    return true
  return VIDEO_EXTENSIONS.test(file.name)
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
