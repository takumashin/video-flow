import { extractVideoId } from './video-url'

export function buildVideoDownloadFilename(options?: {
  taskId?: string
  createdAt?: number
  videoId?: string
}): string {
  const parts = ['seedance']
  if (options?.taskId)
    parts.push(options.taskId.replace(/[^\w-]/g, '').slice(0, 16))
  else if (options?.videoId)
    parts.push(options.videoId.replace(/\.[^.]+$/, '').slice(0, 16))
  if (options?.createdAt)
    parts.push(String(options.createdAt))
  return `${parts.join('-')}.mp4`
}

/** 是否为允许代理下载的远程视频地址 */
export function isAllowedRemoteVideoUrl(url: string): boolean {
  try {
    const parsed = new URL(url.trim())
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:')
      return false

    const host = parsed.hostname.toLowerCase()
    const allowedSuffixes = [
      'volces.com',
      'volcengine.com',
      'byteimg.com',
      'bytedance.com',
      'tos-cn-beijing.volces.com',
    ]

    return allowedSuffixes.some(
      suffix => host === suffix || host.endsWith(`.${suffix}`),
    )
  }
  catch {
    return false
  }
}

/** 构建站内下载 API 地址（同源，触发浏览器下载而非新页播放） */
export function getVideoDownloadHref(
  videoUrl: string,
  options?: { taskId?: string; createdAt?: number },
): string {
  const trimmed = videoUrl.trim()
  const localId = extractVideoId(trimmed)

  if (localId) {
    const params = new URLSearchParams({ download: '1' })
    if (options?.taskId)
      params.set('taskId', options.taskId)
    if (options?.createdAt != null)
      params.set('createdAt', String(options.createdAt))
    return `/api/videos/${localId}?${params.toString()}`
  }

  const params = new URLSearchParams({ url: trimmed })
  if (options?.taskId)
    params.set('taskId', options.taskId)
  if (options?.createdAt != null)
    params.set('createdAt', String(options.createdAt))
  return `/api/videos/download?${params.toString()}`
}
