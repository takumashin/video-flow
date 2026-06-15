import fs from 'node:fs/promises'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'

const UPLOAD_DIR = path.join(process.cwd(), 'data', 'uploads')

const MIME_BY_EXT: Record<string, string> = {
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
  '.mp3': 'audio/mpeg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.aac': 'audio/aac',
}

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/tiff': '.tiff',
  'image/heic': '.heic',
  'image/heif': '.heif',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
}

export const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

export async function ensureUploadDir() {
  await fs.mkdir(UPLOAD_DIR, { recursive: true })
}

export function getUploadFilePath(id: string) {
  if (!UPLOAD_ID_PATTERN.test(id))
    throw new Error('无效的文件 ID')
  return path.join(UPLOAD_DIR, id)
}

export function getMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export function getExtensionFromMime(mime: string): string {
  return EXT_BY_MIME[mime] ?? '.jpg'
}

export async function saveUpload(buffer: Buffer, mimeType: string): Promise<{ id: string; url: string }> {
  await ensureUploadDir()
  const ext = getExtensionFromMime(mimeType)
  const id = `${uuidv4()}${ext}`
  const filePath = path.join(UPLOAD_DIR, id)
  await fs.writeFile(filePath, buffer)
  return { id, url: `/api/uploads/${id}` }
}

export async function readUpload(id: string): Promise<{ buffer: Buffer; mimeType: string } | null> {
  try {
    const filePath = getUploadFilePath(id)
    const buffer = await fs.readFile(filePath)
    const mimeType = getMimeTypeFromFilename(id)
    return { buffer, mimeType }
  }
  catch {
    return null
  }
}

export async function readUploadAsDataUrl(id: string): Promise<string | null> {
  const file = await readUpload(id)
  if (!file)
    return null
  const base64 = file.buffer.toString('base64')
  return `data:${file.mimeType};base64,${base64}`
}

export type UploadAssetKind = 'image' | 'video' | 'audio'

export type UploadListItem = {
  id: string
  url: string
  kind: UploadAssetKind
  filename: string
  size: number
  createdAt: number
}

export function getUploadKindFromFilename(filename: string): UploadAssetKind | null {
  const mime = getMimeTypeFromFilename(filename)
  if (mime.startsWith('image/'))
    return 'image'
  if (mime.startsWith('video/'))
    return 'video'
  if (mime.startsWith('audio/'))
    return 'audio'
  return null
}

export async function listUploads(): Promise<UploadListItem[]> {
  await ensureUploadDir()
  const entries = await fs.readdir(UPLOAD_DIR)
  const items: UploadListItem[] = []

  for (const filename of entries) {
    const kind = getUploadKindFromFilename(filename)
    if (!kind)
      continue

    const filePath = path.join(UPLOAD_DIR, filename)
    const stat = await fs.stat(filePath)
    if (!stat.isFile())
      continue

    items.push({
      id: filename,
      url: `/api/uploads/${filename}`,
      kind,
      filename,
      size: stat.size,
      createdAt: stat.mtimeMs,
    })
  }

  return items.sort((a, b) => b.createdAt - a.createdAt)
}

export function extractUploadId(imageUrl: string): string | null {
  const trimmed = imageUrl.trim()
  const match = trimmed.match(/\/api\/uploads\/([^/?#]+)/)
  return match?.[1] ?? null
}

export async function resolveImageUrlForApi(imageUrl: string): Promise<string> {
  return resolveMediaUrlForApi(imageUrl, '图片')
}

export async function resolveMediaUrlForApi(mediaUrl: string, label = '媒体'): Promise<string> {
  const trimmed = mediaUrl.trim()

  if (!trimmed)
    throw new Error(`${label}地址为空`)

  if (trimmed.startsWith('data:'))
    return trimmed

  const uploadId = extractUploadId(trimmed)
  if (uploadId) {
    const dataUrl = await readUploadAsDataUrl(uploadId)
    if (!dataUrl)
      throw new Error(`找不到已保存的文件：${uploadId}`)
    return dataUrl
  }

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
    return trimmed

  throw new Error(`无效的${label}地址`)
}
