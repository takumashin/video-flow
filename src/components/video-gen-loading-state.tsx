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

function sampleRainbowColor(x: number, y: number, w: number, h: number, t: number): string {
  const n = RAINBOW_RGB.length
  const pos = ((x / w) * 1.2 + (y / h) * 0.8 + t * 0.15) % n
  const i = Math.floor(pos) % n
  const j = (i + 1) % n
  const frac = pos - Math.floor(pos)
  const [r0, g0, b0] = RAINBOW_RGB[i]
  const [r1, g1, b1] = RAINBOW_RGB[j]
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

    const resize = () => {
      const rect = surface.getBoundingClientRect()
      if (rect.width <= 0 || rect.height <= 0)
        return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.floor(rect.width * dpr)
      canvas.height = Math.floor(rect.height * dpr)
      canvas.style.width = `${rect.width}px`
      canvas.style.height = `${rect.height}px`
    }

    const draw = (time: number) => {
      const rect = surface.getBoundingClientRect()
      const w = rect.width
      const h = rect.height
      if (w <= 0 || h <= 0) {
        animationId = requestAnimationFrame(draw)
        return
      }

      const dpr = canvas.width / w
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, w, h)

      const t = (time - startTime) / 1000
      const spacing = 13
      const cols = Math.ceil(w / spacing) + 1
      const rows = Math.ceil(h / spacing) + 1

      for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
          const x = col * spacing + spacing * 0.5
          const y = row * spacing + spacing * 0.5

          const wave1 = Math.sin(col * 0.45 + t * 1.8)
          const wave2 = Math.sin(row * 0.38 - t * 1.4)
          const wave3 = Math.sin((col + row) * 0.22 + t * 2.1)
          const combined = (wave1 + wave2 + wave3) / 3
          const pulse = 0.5 + combined * 0.5
          const radius = 1.2 + pulse * 2.8

          const alpha = 0.28 + pulse * 0.52
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

    resize()
    animationId = requestAnimationFrame(draw)

    const ro = new ResizeObserver(() => resize())
    ro.observe(surface)

    return () => {
      cancelAnimationFrame(animationId)
      ro.disconnect()
    }
  }, [])

  const paddingBottom = aspectRatio === 'square' ? '100%' : '56.25%'

  return (
    <div
      className={cn('relative w-full', className)}
      style={{ maxWidth }}
      data-testid="video-gen-loading-state-frame"
    >
      <div
        className="relative w-full"
        data-testid="video-gen-loading-state-entry-surface"
      >
        <div
          ref={surfaceRef}
          aria-label={label}
          data-testid="video-gen-loading-state"
          className="relative isolate w-full overflow-hidden rounded-[36px] bg-surface-muted/80 text-foreground transition-colors duration-200 ease-out dark:bg-surface-muted/60"
          style={{ paddingBottom }}
        >
          <div className="absolute inset-0 z-10">
            <div
              aria-hidden
              data-testid="video-gen-loading-state-dots"
              className="pointer-events-none absolute inset-0 overflow-hidden"
            >
              <div className="h-full" data-testid="loading-halftone-dots-animation" style={{ opacity: 0.42 }}>
                <div className="relative h-full w-full">
                  <canvas
                    ref={canvasRef}
                    aria-hidden
                    className="block h-full w-full [mask-image:linear-gradient(to_top_left,rgba(0,0,0,0)_0%,rgba(0,0,0,1)_28%,rgba(0,0,0,1)_72%,rgba(0,0,0,0)_100%)] [mask-repeat:no-repeat] [mask-size:100%_100%] [-webkit-mask-image:linear-gradient(to_top_left,rgba(0,0,0,0)_0%,rgba(0,0,0,1)_28%,rgba(0,0,0,1)_72%,rgba(0,0,0,0)_100%)] [-webkit-mask-repeat:no-repeat] [-webkit-mask-size:100%_100%]"
                  />
                </div>
              </div>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20 flex flex-col items-center gap-2 px-4 pb-4 pt-10 bg-gradient-to-t from-black/50 via-black/20 to-transparent">
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
      </div>
    </div>
  )
}
