import fs from 'node:fs/promises'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { extractVideoId, isLocalVideoUrl, VIDEO_ID_PATTERN } from './video-url'

export { extractVideoId, isLocalVideoUrl, VIDEO_ID_PATTERN } from './video-url'

const VIDEO_DIR = path.join(process.cwd(), 'data', 'videos')

const MIME_BY_EXT: Record<string, string> = {
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.mov': 'video/quicktime',
}

const EXT_BY_MIME: Record<string, string> = {
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
}

export async function ensureVideoDir() {
  await fs.mkdir(VIDEO_DIR, { recursive: true })
}

export function getVideoFilePath(id: string) {
  if (!VIDEO_ID_PATTERN.test(id))
    throw new Error('无效的视频 ID')
  return path.join(VIDEO_DIR, id)
}

export function getMimeTypeFromVideoFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'video/mp4'
}

export function getExtensionFromVideoMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase()
  return EXT_BY_MIME[base] ?? '.mp4'
}

/** 将火山返回的远程 URL 下载到本地 data/videos，返回站内访问路径 */
export async function saveVideoFromUrl(sourceUrl: string): Promise<{ id: string; url: string }> {
  const trimmed = sourceUrl.trim()
  if (!trimmed)
    throw new Error('视频地址为空')

  if (isLocalVideoUrl(trimmed)) {
    const id = extractVideoId(trimmed)!
    return { id, url: trimmed.startsWith('/') ? trimmed : `/${trimmed}` }
  }

  const response = await fetch(trimmed)
  if (!response.ok)
    throw new Error(`下载视频失败 (${response.status})`)

  const contentType = response.headers.get('content-type') ?? 'video/mp4'
  const ext = getExtensionFromVideoMime(contentType)
  const buffer = Buffer.from(await response.arrayBuffer())

  await ensureVideoDir()
  const id = `${uuidv4()}${ext}`
  await fs.writeFile(path.join(VIDEO_DIR, id), buffer)

  return { id, url: `/api/videos/${id}` }
}

export async function readVideo(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const filePath = getVideoFilePath(id)
    const buffer = await fs.readFile(filePath)
    const mimeType = getMimeTypeFromVideoFilename(id)
    return { buffer, mimeType }
  }
  catch {
    return null
  }
}
