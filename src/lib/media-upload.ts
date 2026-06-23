import {
  AUDIO_ACCEPT,
  getMaxSizeForKind,
  getUploadKind,
  IMAGE_ACCEPT,
  isAudioFile,
  isImageFile,
  isVideoFile,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  VIDEO_ACCEPT,
} from './media-upload-shared'

export {
  AUDIO_ACCEPT,
  IMAGE_ACCEPT,
  isAudioFile,
  isImageFile,
  isVideoFile,
  MAX_AUDIO_SIZE,
  MAX_IMAGE_SIZE,
  MAX_VIDEO_SIZE,
  VIDEO_ACCEPT,
} from './media-upload-shared'

export async function uploadMediaFile(
  file: File,
  expectedKind?: 'image' | 'video' | 'audio',
  folderId?: string | null,
): Promise<string> {
  const kind = getUploadKind(file)
  if (!kind)
    throw new Error('请上传图片、视频或音频文件')

  if (expectedKind && kind !== expectedKind) {
    if (expectedKind === 'video')
      throw new Error('请上传视频文件（MP4 / WebM / MOV）')
    if (expectedKind === 'audio')
      throw new Error('请上传音频文件（MP3 / WAV / M4A）')
    throw new Error('请上传图片文件（JPG / PNG / WebP 等）')
  }

  const maxSize = getMaxSizeForKind(kind)
  if (file.size > maxSize) {
    if (kind === 'image')
      throw new Error('图片大小不能超过 10MB')
    if (kind === 'video')
      throw new Error('视频大小不能超过 50MB')
    throw new Error('音频大小不能超过 10MB')
  }

  const formData = new FormData()
  formData.append('file', file)
  if (folderId)
    formData.append('folderId', folderId)

  const response = await fetch('/api/uploads', {
    method: 'POST',
    body: formData,
  })

  const result = await response.json()

  if (!response.ok)
    throw new Error(result.error || '上传失败')

  return result.url as string
}

export async function processMediaFile(
  file: File,
  expectedKind?: 'image' | 'video' | 'audio',
  folderId?: string | null,
): Promise<string> {
  return uploadMediaFile(file, expectedKind, folderId)
}

export async function processVideoFiles(files: File[], folderId?: string | null): Promise<string[]> {
  const results: string[] = []
  for (const file of files)
    results.push(await uploadMediaFile(file, 'video', folderId))
  return results
}

export async function processAudioFiles(files: File[], folderId?: string | null): Promise<string[]> {
  const results: string[] = []
  for (const file of files)
    results.push(await uploadMediaFile(file, 'audio', folderId))
  return results
}
