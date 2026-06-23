export const VIDEO_ID_PATTERN = /^[a-zA-Z0-9._-]+$/

export function extractVideoId(videoUrl: string): string | null {
  const trimmed = videoUrl.trim()
  const match = trimmed.match(/\/api\/videos\/([^/?#]+)/)
  return match?.[1] ?? null
}

export function isLocalVideoUrl(videoUrl: string): boolean {
  return extractVideoId(videoUrl) != null
}
