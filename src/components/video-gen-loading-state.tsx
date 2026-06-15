'use client'

import { useEffect, useRef } from 'react'
import { cn } from '@/lib/cn'

/** 与任务进度条一致的五彩色 */
const RAINBOW_RGB: Array<[number, number, number]> = [
  [244, 114, 182],
  [192, 132, 252],
  [129, 140, 248],
  [56, 189, 248],
  [52, 211, 153],
  [253, 224, 71],
]

function positiveMod(value: number, divisor: number): number {
  if (!Number.isFinite(value) || divisor <= 0)
    return 0
  return ((value % divisor) + divisor) % divisor
}

function sampleRainbowColor(x: number, y: number, w: number, h: number, t: number): string {
  const n = RAINBOW_RGB.length
  if (w <= 0 || h <= 0)
    return 'rgb(129, 140, 248)'

  const raw = (x / w) * 1.2 + (y / h) * 0.8 + t * 0.15
  const pos = positiveMod(raw, n)
  const i = Math.min(n - 1, Math.floor(pos))
  const j = (i + 1) % n
  const frac = pos - Math.floor(pos)
  const [r0, g0, b0] = RAINBOW_RGB[i]!
  const [r1, g1, b1] = RAINBOW_RGB[j]!
  const r = Math.round(r0 + (r1 - r0) * frac)
  const g = Math.round(g0 + (g1 - g0) * frac)
  const b = Math.round(b0 + (b1 - b0) * frac)
  return `rgb(${r}, ${g}, ${b})`
}

type VideoGenLoadingStateProps = {
  progress?: number
  label?: string
  className?: string
  /** square = 1:1，video = 16:9 */
  aspectRatio?: 'square' | 'video'
  maxWidth?: number | string
}

export default function VideoGenLoadingState({
  progress,
  label = '正在生成视频…',
  className,
  aspectRatio = 'video',
  maxWidth = 480,
}: VideoGenLoadingStateProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    const surface = surfaceRef.current
    if (!canvas || !surface)
      return

    const ctx = canvas.getContext('2d')
    if (!ctx)
      return

    let animationId = 0
    let startTime = performance.now()
    let lastWidth = 0
    let lastHeight = 0

    const syncCanvasSize = (width: number, height: number) => {
      if (width <= 0 || height <= 0)
        return false

      const roundedWidth = Math.round(width)
      const roundedHeight = Math.round(height)
      if (roundedWidth === lastWidth && roundedHeight === lastHeight)
        return true

      lastWidth = roundedWidth
      lastHeight = roundedHeight
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.floor(roundedWidth * dpr))
      canvas.height = Math.max(1, Math.floor(roundedHeight * dpr))
      return true
    }

    const readSurfaceSize = () => ({
      width: surface.clientWidth,
      height: surface.clientHeight,
    })

    const draw = (time: number) => {
      const { width: w, height: h } = readSurfaceSize()

      if (!syncCanvasSize(w, h)) {
        animationId = requestAnimationFrame(draw)
        return
      }

      const dpr = canvas.width / w
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const t = (time - startTime) / 1000
      const spacing = 12
      const cols = Math.ceil(w / spacing) + 2
      const rows = Math.ceil(h / spacing) + 2

      for (let row = -1; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = col * spacing + spacing * 0.5
          const y = row * spacing + spacing * 0.5

          const wave1 = Math.sin(col * 0.45 + t * 1.8)
          const wave2 = Math.sin(row * 0.38 - t * 1.4)
          const wave3 = Math.sin((col + row) * 0.22 + t * 2.1)
          const combined = (wave1 + wave2 + wave3) / 3
          const pulse = 0.5 + combined * 0.5
          const radius = 1.2 + pulse * 2.8
          const alpha = 0.32 + pulse * 0.48

          ctx.beginPath()
          ctx.arc(x, y, radius, 0, Math.PI * 2)
          ctx.fillStyle = sampleRainbowColor(x, y, w, h, t)
          ctx.globalAlpha = alpha
          ctx.fill()
        }
      }

      ctx.globalAlpha = 1
      animationId = requestAnimationFrame(draw)
    }

    animationId = requestAnimationFrame(draw)

    const ro = new ResizeObserver(() => {
      lastWidth = 0
      lastHeight = 0
    })
    ro.observe(surface)

    return () => {
      cancelAnimationFrame(animationId)
      ro.disconnect()
    }
  }, [])

  return (
    <div
      className={cn('relative w-full', className)}
      style={{ maxWidth }}
      data-testid="video-gen-loading-state-frame"
    >
      <div
        ref={surfaceRef}
        aria-label={label}
        data-testid="video-gen-loading-state"
        className={cn(
          'relative isolate w-full overflow-hidden rounded-[36px] bg-surface-muted/80 text-foreground dark:bg-surface-muted/60',
          aspectRatio === 'square' ? 'aspect-square' : 'aspect-video',
        )}
      >
        <canvas
          ref={canvasRef}
          aria-hidden
          data-testid="video-gen-loading-state-dots"
          className="absolute inset-0 block h-full w-full opacity-50"
        />

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_35%,rgba(0,0,0,0.18)_100%)]" />

        <div className="absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 bg-gradient-to-t from-black/55 via-black/25 to-transparent px-4 pb-4 pt-10">
          <p className="text-xs font-medium text-white drop-shadow-sm">{label}</p>
          {progress != null && (
            <div className="flex w-full max-w-[220px] items-center gap-2">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/25">
                <div
                  className="task-progress-bar-fill h-full rounded-full transition-[width] duration-500 ease-out"
                  style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                />
              </div>
              <span className="text-[10px] font-semibold tabular-nums text-white/95">
                {Math.round(progress)}%
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
