import type { SeedanceNodeData, SeedanceVideoRatio, SeedanceVideoResolution } from './types'

export const RESOLUTION_OPTIONS: Array<{ value: SeedanceVideoResolution; label: string }> = [
  { value: '480p', label: '480p' },
  { value: '720p', label: '720p（推荐）' },
  { value: '1080p', label: '1080p 高清' },
]

export const RATIO_OPTIONS: Array<{ value: SeedanceVideoRatio; label: string }> = [
  { value: '16:9', label: '16:9 横屏' },
  { value: '9:16', label: '9:16 竖屏' },
  { value: '1:1', label: '1:1 方形' },
  { value: '4:3', label: '4:3' },
  { value: '3:4', label: '3:4' },
  { value: '21:9', label: '21:9 超宽' },
  { value: 'adaptive', label: '自适应（跟随素材）' },
]

export const DURATION_MIN = 4
export const DURATION_MAX = 15
export const DURATION_SMART = -1

export const DURATION_OPTIONS: Array<{ value: number; label: string }> = [
  { value: DURATION_SMART, label: '智能时长' },
  ...Array.from({ length: 12 }, (_, i) => {
    const sec = i + DURATION_MIN
    return { value: sec, label: `${sec} 秒` }
  }),
  { value: 13, label: '13 秒' },
  { value: 14, label: '14 秒' },
  { value: 15, label: '15 秒' },
]

export type SeedanceApiVideoParams = {
  resolution: SeedanceVideoResolution
  ratio: SeedanceVideoRatio
  duration: number
  seed?: number
  camera_fixed: boolean
  watermark: boolean
  generate_audio: boolean
}

export function buildSeedanceApiVideoParamsFromRequest(body: {
  resolution?: string
  ratio?: string
  duration?: number
  seed?: number
  generateAudio?: boolean
  watermark?: boolean
  cameraFixed?: boolean
}): SeedanceApiVideoParams {
  const resolution = (body.resolution ?? '720p') as SeedanceVideoResolution
  const ratio = (body.ratio ?? '16:9') as SeedanceVideoRatio
  const duration = body.duration ?? 5
  const seed = body.seed ?? -1

  return {
    resolution,
    ratio,
    duration,
    seed: seed >= 0 ? seed : undefined,
    camera_fixed: body.cameraFixed ?? false,
    watermark: body.watermark ?? false,
    generate_audio: body.generateAudio ?? false,
  }
}

export function buildSeedanceApiVideoParams(data: SeedanceNodeData): SeedanceApiVideoParams {
  return {
    resolution: data.resolution ?? '720p',
    ratio: data.ratio ?? '16:9',
    duration: data.duration ?? 5,
    seed: data.seed != null && data.seed >= 0 ? data.seed : undefined,
    camera_fixed: data.cameraFixed ?? false,
    watermark: data.watermark ?? false,
    generate_audio: data.generateAudio ?? false,
  }
}

export function normalizeSeedanceNodeParams(data: Partial<SeedanceNodeData>): Partial<SeedanceNodeData> {
  const next: Partial<SeedanceNodeData> = { ...data }

  if (next.duration != null) {
    const d = Number(next.duration)
    if (d === -1 || (d >= 4 && d <= 15))
      next.duration = d as SeedanceNodeData['duration']
  }

  if (next.seed != null) {
    const s = Number(next.seed)
    next.seed = s < 0 ? -1 : Math.min(Math.floor(s), 2 ** 32 - 1)
  }

  return next
}
