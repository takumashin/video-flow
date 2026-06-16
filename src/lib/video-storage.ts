import fs from 'node:fs/promises'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import { eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { generatedVideos } from '@/db/schema'
import { extractVideoId, isLocalVideoUrl, VIDEO_ID_PATTERN } from './video-url'

export { extractVideoId, isLocalVideoUrl, VIDEO_ID_PATTERN } from './video-url'

const VIDEO_ROOT = path.join(process.cwd(), 'data', 'videos')

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

function getWorkspaceVideoDir(workspaceId: string) {
  return path.join(VIDEO_ROOT, workspaceId)
}

export async function ensureVideoDir(workspaceId: string) {
  await fs.mkdir(getWorkspaceVideoDir(workspaceId), { recursive: true })
}

export function getVideoFilePath(workspaceId: string, filename: string) {
  if (!VIDEO_ID_PATTERN.test(filename))
    throw new Error('无效的视频 ID')
  return path.join(getWorkspaceVideoDir(workspaceId), filename)
}

export function getMimeTypeFromVideoFilename(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  return MIME_BY_EXT[ext] ?? 'video/mp4'
}

export function getExtensionFromVideoMime(mime: string): string {
  const base = mime.split(';')[0].trim().toLowerCase()
  return EXT_BY_MIME[base] ?? '.mp4'
}

async function findVideoByFilename(filename: string) {
  const [row] = await db
    .select()
    .from(generatedVideos)
    .where(or(eq(generatedVideos.filename, filename), eq(generatedVideos.id, filename)))
    .limit(1)

  return row ?? null
}

export async function saveVideoFromUrl(
  sourceUrl: string,
  workspaceId: string,
  userId: string,
  sourceTaskId?: string,
): Promise<{ id: string, url: string }> {
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

  await ensureVideoDir(workspaceId)
  const filename = `${uuidv4()}${ext}`
  const storagePath = path.join('videos', workspaceId, filename)
  await fs.writeFile(path.join(process.cwd(), 'data', storagePath), buffer)

  const [row] = await db
    .insert(generatedVideos)
    .values({
      workspaceId,
      filename,
      storagePath,
      sourceTaskId,
      mimeType: contentType.split(';')[0],
      size: buffer.length,
      createdBy: userId,
    })
    .returning()

  return { id: row.filename, url: `/api/videos/${row.filename}` }
}

export async function readVideo(
  filename: string,
  workspaceId?: string,
): Promise<{ buffer: Buffer, mimeType: string, workspaceId: string } | null> {
  const video = await findVideoByFilename(filename)
  if (!video)
    return null

  if (workspaceId && video.workspaceId !== workspaceId)
    return null

  try {
    const filePath = path.join(process.cwd(), 'data', video.storagePath)
    const buffer = await fs.readFile(filePath)
    return { buffer, mimeType: video.mimeType, workspaceId: video.workspaceId }
  }
  catch {
    return null
  }
}
