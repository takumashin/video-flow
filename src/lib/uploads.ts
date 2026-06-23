import fs from 'node:fs/promises'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { and, desc, eq, isNull, or } from 'drizzle-orm'
import { db } from '@/db'
import { assets } from '@/db/schema'
import { getAssetFolderById } from '@/lib/asset-folders/service'
import { extractVideoId } from '@/lib/video-url'
import { getRemoteVideoUrlForLocalVideo } from '@/lib/video-storage'

const UPLOAD_ROOT = path.join(process.cwd(), 'data', 'uploads')

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
  'video/x-quicktime': '.mov',
  'audio/mpeg': '.mp3',
  'audio/mp3': '.mp3',
  'audio/wav': '.wav',
  'audio/x-wav': '.wav',
  'audio/mp4': '.m4a',
  'audio/aac': '.aac',
}

export const UPLOAD_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

function getWorkspaceUploadDir(workspaceId: string) {
  return path.join(UPLOAD_ROOT, workspaceId)
}

export async function ensureUploadDir(workspaceId: string) {
  await fs.mkdir(getWorkspaceUploadDir(workspaceId), { recursive: true })
}

export function getUploadFilePath(workspaceId: string, filename: string) {
  if (!UPLOAD_ID_PATTERN.test(filename))
    throw new Error('无效的文件 ID')
  return path.join(getWorkspaceUploadDir(workspaceId), filename)
}

export function getMimeTypeFromFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'application/octet-stream'
}

export function getExtensionFromMime(mime: string, kind?: UploadAssetKind, originalFilename?: string): string {
  const normalized = mime.split(';')[0].trim().toLowerCase()
  const fromMime = EXT_BY_MIME[normalized]
  if (fromMime)
    return fromMime

  if (originalFilename) {
    const ext = path.extname(originalFilename).toLowerCase()
    if (MIME_BY_EXT[ext])
      return ext
  }

  if (kind === 'video')
    return '.mp4'
  if (kind === 'audio')
    return '.mp3'
  if (kind === 'image')
    return '.jpg'

  return '.bin'
}

export type UploadAssetKind = 'image' | 'video' | 'audio'

export type UploadListItem = {
  id: string
  url: string
  kind: UploadAssetKind
  filename: string
  size: number
  createdAt: number
  folderId: string | null
}

export type UploadFolderFilter = 'all' | 'uncategorized' | string

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

async function findAssetByFilename(filename: string) {
  const [row] = await db
    .select()
    .from(assets)
    .where(or(eq(assets.filename, filename), eq(assets.id, filename)))
    .limit(1)

  return row ?? null
}

export async function saveUpload(
  buffer: Buffer,
  mimeType: string,
  workspaceId: string,
  userId: string,
  originalFilename?: string,
  folderId?: string | null,
  kindHint?: UploadAssetKind,
): Promise<{ id: string, url: string, kind: UploadAssetKind }> {
  await ensureUploadDir(workspaceId)

  if (folderId) {
    const folder = await getAssetFolderById(folderId, workspaceId)
    if (!folder)
      throw new Error('文件夹不存在')
  }

  const ext = getExtensionFromMime(mimeType, kindHint, originalFilename)
  const filename = `${uuidv4()}${ext}`
  const storagePath = path.join('uploads', workspaceId, filename)
  const filePath = path.join(process.cwd(), 'data', storagePath)
  await fs.writeFile(filePath, buffer)

  const kind = getUploadKindFromFilename(filename) ?? kindHint
  if (!kind)
    throw new Error('不支持的文件类型')

  const [row] = await db
    .insert(assets)
    .values({
      workspaceId,
      folderId: folderId ?? null,
      kind,
      filename,
      storagePath,
      mimeType,
      size: buffer.length,
      uploadedBy: userId,
    })
    .returning()

  return {
    id: row.filename,
    url: `/api/uploads/${row.filename}`,
    kind,
  }
}

export async function readUpload(
  filename: string,
  workspaceId?: string,
): Promise<{ buffer: Buffer, mimeType: string, workspaceId: string } | null> {
  const asset = await findAssetByFilename(filename)
  if (!asset)
    return null

  if (workspaceId && asset.workspaceId !== workspaceId)
    return null

  try {
    const filePath = path.join(process.cwd(), 'data', asset.storagePath)
    const buffer = await fs.readFile(filePath)
    return { buffer, mimeType: asset.mimeType, workspaceId: asset.workspaceId }
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

export async function listUploads(
  workspaceId: string,
  folderFilter: UploadFolderFilter = 'all',
): Promise<UploadListItem[]> {
  const conditions = [eq(assets.workspaceId, workspaceId)]

  if (folderFilter === 'uncategorized')
    conditions.push(isNull(assets.folderId))
  else if (folderFilter !== 'all')
    conditions.push(eq(assets.folderId, folderFilter))

  const rows = await db
    .select()
    .from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt))

  return rows.map(row => ({
    id: row.filename,
    url: `/api/uploads/${row.filename}`,
    kind: row.kind,
    filename: row.filename,
    size: row.size,
    createdAt: row.createdAt.getTime(),
    folderId: row.folderId,
  }))
}

export async function moveUploadToFolder(
  filename: string,
  workspaceId: string,
  folderId: string | null,
): Promise<boolean> {
  const asset = await findAssetByFilename(filename)
  if (!asset || asset.workspaceId !== workspaceId)
    return false

  if (folderId) {
    const folder = await getAssetFolderById(folderId, workspaceId)
    if (!folder)
      return false
  }

  await db
    .update(assets)
    .set({ folderId })
    .where(eq(assets.id, asset.id))

  return true
}

export async function deleteUpload(filename: string, workspaceId: string): Promise<boolean> {
  const asset = await findAssetByFilename(filename)
  if (!asset || asset.workspaceId !== workspaceId)
    return false

  try {
    await fs.unlink(path.join(process.cwd(), 'data', asset.storagePath))
  }
  catch {
    // file may already be gone
  }

  await db.delete(assets).where(eq(assets.id, asset.id))
  return true
}

export function extractUploadId(imageUrl: string): string | null {
  const trimmed = imageUrl.trim()
  const match = trimmed.match(/\/api\/uploads\/([^/?#]+)/)
  return match?.[1] ?? null
}

export async function resolveImageUrlForApi(imageUrl: string): Promise<string> {
  return resolveMediaUrlForApi(imageUrl, '图片')
}

/** Seedance reference_video 仅接受公网 HTTPS URL，不能使用 data URL 或需登录的本地地址 */
export async function resolveVideoUrlForApi(videoUrl: string): Promise<string> {
  const trimmed = videoUrl.trim()

  if (!trimmed)
    throw new Error('视频地址为空')

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://'))
    return trimmed

  const videoId = extractVideoId(trimmed)
  if (videoId) {
    const remoteUrl = await getRemoteVideoUrlForLocalVideo(videoId)
    if (remoteUrl)
      return remoteUrl
    throw new Error('无法解析本地视频的远程地址，请重新生成该视频后再作为参考（远程链接 24 小时内有效）')
  }

  if (extractUploadId(trimmed)) {
    throw new Error('本地上传的参考视频暂不支持提交，请使用 Seedance 生成的视频或公网可访问的视频 URL')
  }

  throw new Error('无效的视频地址')
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
