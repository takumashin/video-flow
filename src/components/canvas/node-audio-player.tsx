'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { MediaPreviewExpandButton } from '@/components/media-preview-modal'
import { decodeAudioPeaks, fallbackPeaks } from '@/lib/decode-audio-peaks'
import { formatMediaTime } from '@/lib/format-media-time'
import { formatNodeAudioTime } from '@/lib/format-node-audio-time'
import { cn } from '@/lib/cn'

type NodeAudioPlayerProps = {
  src: string
  previewTitle?: string
  className?: string
  showExpand?: boolean
  variant?: 'default' | 'node'
}

const WAVEFORM_BAR_COUNT = 96

function getMediaDuration(audio: HTMLAudioElement): number | null {
  if (Number.isFinite(audio.duration) && audio.duration > 0)
    return audio.duration

  if (audio.seekable.length > 0) {
    const end = audio.seekable.end(audio.seekable.length - 1)
    if (Number.isFinite(end) && end > 0)
      return end
  }

  return null
}

function getSeekRatioFromRect(clientX: number, rect: DOMRect): number {
  if (rect.width <= 0)
    return 0

  const ratio = (clientX - rect.left) / rect.width
  if (!Number.isFinite(ratio))
    return 0

  return Math.min(1, Math.max(0, ratio))
}

function readWaveformColors() {
  const styles = getComputedStyle(document.documentElement)
  return {
    played: styles.getPropertyValue('--primary-light').trim() || '#528bff',
    unplayed: styles.getPropertyValue('--border').trim() || '#d0d5dd',
  }
}

function drawWaveformBar(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath()
    ctx.roundRect(x, y, width, height, Math.min(width / 2, height / 2))
    ctx.fill()
    return
  }
  ctx.fillRect(x, y, width, height)
}

function drawWaveform(
  ctx: CanvasRenderingContext2D,
  peaks: number[],
  width: number,
  height: number,
  progressRatio: number,
) {
  ctx.clearRect(0, 0, width, height)

  const { played, unplayed } = readWaveformColors()
  const gap = 1.5
  const barWidth = Math.max(1.5, (width - gap * (peaks.length - 1)) / peaks.length)
  const progressX = progressRatio * width

  for (let i = 0; i < peaks.length; i++) {
    const peak = peaks[i] ?? 0
    const barHeight = Math.max(height * 0.08, peak * height * 0.9)
    const x = i * (barWidth + gap)
    const y = (height - barHeight) / 2
    const barCenter = x + barWidth / 2
    ctx.fillStyle = barCenter <= progressX ? played : unplayed
    ctx.globalAlpha = barCenter <= progressX ? 1 : 0.85
    drawWaveformBar(ctx, x, y, barWidth, barHeight)
  }

  ctx.globalAlpha = 1
}

export default function NodeAudioPlayer({
  src,
  previewTitle = '音频预览',
  className,
  showExpand = true,
  variant = 'default',
}: NodeAudioPlayerProps) {
  const isNode = variant === 'node'
  const audioRef = useRef<HTMLAudioElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const waveformRef = useRef<HTMLDivElement>(null)
  const pendingSeekRatioRef = useRef<number | null>(null)
  const scrubbingRef = useRef(false)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const [peaks, setPeaks] = useState<number[]>(() => fallbackPeaks(WAVEFORM_BAR_COUNT))

  const progress = duration > 0 ? currentTime / duration : 0

  const getLiveProgress = useCallback(() => {
    const audio = audioRef.current
    if (audio) {
      const total = getMediaDuration(audio)
      if (total != null && total > 0)
        return Math.min(1, Math.max(0, audio.currentTime / total))
    }
    return progress
  }, [progress])

  useEffect(() => {
    let cancelled = false
    setPeaks(fallbackPeaks(WAVEFORM_BAR_COUNT))

    void decodeAudioPeaks(src, WAVEFORM_BAR_COUNT).then((nextPeaks) => {
      if (!cancelled)
        setPeaks(nextPeaks)
    })

    return () => {
      cancelled = true
    }
  }, [src])

  const applySeekRatio = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio)
      return false

    const clampedRatio = Math.min(1, Math.max(0, ratio))
    if (!Number.isFinite(clampedRatio))
      return false

    const total = getMediaDuration(audio)
    if (total == null)
      return false

    const next = clampedRatio * total

    try {
      audio.currentTime = next
    }
    catch {
      return false
    }

    setCurrentTime(audio.currentTime)

    const syncedDuration = getMediaDuration(audio)
    if (syncedDuration != null)
      setDuration(syncedDuration)

    return true
  }, [])

  const seek = useCallback((ratio: number) => {
    if (applySeekRatio(ratio))
      return

    pendingSeekRatioRef.current = ratio

    const audio = audioRef.current
    if (!audio)
      return

    const onReady = () => {
      const pending = pendingSeekRatioRef.current
      if (pending == null)
        return
      if (applySeekRatio(pending))
        pendingSeekRatioRef.current = null
    }

    audio.addEventListener('loadedmetadata', onReady, { once: true })
    audio.addEventListener('durationchange', onReady, { once: true })
    audio.addEventListener('canplay', onReady, { once: true })
  }, [applySeekRatio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio)
      return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => {
      const total = getMediaDuration(audio)
      if (total != null)
        setDuration(total)

      const pending = pendingSeekRatioRef.current
      if (pending != null && applySeekRatio(pending))
        pendingSeekRatioRef.current = null
    }
    const onDurationChange = () => {
      const total = getMediaDuration(audio)
      if (total != null)
        setDuration(total)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    if (audio.readyState >= 1) {
      const total = getMediaDuration(audio)
      if (total != null)
        setDuration(total)
    }

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src, applySeekRatio])

  useEffect(() => {
    const audio = audioRef.current
    if (!audio)
      return
    audio.volume = volume
    audio.muted = muted
  }, [volume, muted])

  const togglePlay = useCallback(() => {
    const audio = audioRef.current
    if (!audio)
      return

    if (audio.paused) {
      void audio.play().catch(() => {})
    }
    else {
      audio.pause()
    }
  }, [])

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    seek(getSeekRatioFromRect(e.clientX, e.currentTarget.getBoundingClientRect()))
  }

  const peaksRef = useRef(peaks)
  const progressRef = useRef(progress)
  peaksRef.current = peaks
  progressRef.current = progress

  const paintWaveform = useCallback(() => {
    const container = waveformRef.current
    const canvas = canvasRef.current
    if (!container || !canvas || peaksRef.current.length === 0)
      return

    const width = container.offsetWidth
    const height = container.offsetHeight
    if (width <= 0 || height <= 0)
      return

    const dpr = window.devicePixelRatio || 1
    const pixelWidth = Math.floor(width * dpr)
    const pixelHeight = Math.floor(height * dpr)

    if (canvas.width !== pixelWidth || canvas.height !== pixelHeight) {
      canvas.width = pixelWidth
      canvas.height = pixelHeight
    }

    const ctx = canvas.getContext('2d')
    if (!ctx)
      return

    let liveProgress = progressRef.current
    const audio = audioRef.current
    if (audio) {
      const total = getMediaDuration(audio)
      if (total != null && total > 0)
        liveProgress = Math.min(1, Math.max(0, audio.currentTime / total))
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    drawWaveform(ctx, peaksRef.current, width, height, liveProgress)
  }, [])

  useEffect(() => {
    if (!isNode)
      return

    const container = waveformRef.current
    if (!container)
      return

    paintWaveform()

    const observer = new ResizeObserver(() => {
      paintWaveform()
    })
    observer.observe(container)

    return () => observer.disconnect()
  }, [isNode, src, paintWaveform])

  useEffect(() => {
    if (!isNode)
      return
    paintWaveform()
  }, [isNode, peaks, progress, paintWaveform])

  const seekRef = useRef(seek)
  seekRef.current = seek
  const paintWaveformRef = useRef(paintWaveform)
  paintWaveformRef.current = paintWaveform

  const handleWaveformPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    e.preventDefault()
    const container = e.currentTarget
    scrubbingRef.current = true
    container.setPointerCapture(e.pointerId)
    seekRef.current(getSeekRatioFromRect(e.clientX, container.getBoundingClientRect()))
    paintWaveformRef.current()
  }

  const handleWaveformPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!scrubbingRef.current || !e.currentTarget.hasPointerCapture(e.pointerId))
      return
    e.stopPropagation()
    e.preventDefault()
    seekRef.current(getSeekRatioFromRect(e.clientX, e.currentTarget.getBoundingClientRect()))
    paintWaveformRef.current()
  }

  const handleWaveformPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    scrubbingRef.current = false
    if (e.currentTarget.hasPointerCapture(e.pointerId))
      e.currentTarget.releasePointerCapture(e.pointerId)
  }

  if (isNode) {
    const liveProgress = getLiveProgress()

    return (
      <div
        className={cn(
          'node-inner relative h-full w-full overflow-hidden bg-surface',
          className,
        )}
      >
        <audio
          ref={audioRef}
          key={src}
          src={src}
          preload="auto"
          className="pointer-events-none absolute h-px w-px opacity-0"
          aria-hidden
        />

        <div
          ref={waveformRef}
          className="nodrag pointer-events-auto absolute inset-x-3 top-7 bottom-10 cursor-pointer overflow-hidden rounded-[10px] bg-[#484d752e] touch-none"
          title="点击调节进度"
          onPointerDown={handleWaveformPointerDown}
          onPointerMove={handleWaveformPointerMove}
          onPointerUp={handleWaveformPointerUp}
          onPointerCancel={handleWaveformPointerUp}
        >
          <canvas
            ref={canvasRef}
            className="nodrag nowheel pointer-events-none block h-full w-full"
            aria-hidden
          />
          <div className="pointer-events-none absolute inset-0">
            <div
              className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-primary-light"
              style={{ left: `${liveProgress * 100}%` }}
            />
          </div>
        </div>

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 flex h-10 items-center justify-between px-3 pb-2"
        >
          <div className="text-[10px] tabular-nums text-muted">
            <span>{formatNodeAudioTime(currentTime)} / {formatNodeAudioTime(duration)}</span>
          </div>
          <button
            type="button"
            className="nodrag pointer-events-auto flex h-7 w-7 items-center justify-center rounded-md text-foreground/80 transition hover:bg-surface-muted hover:text-foreground"
            onPointerDown={(e) => {
              e.stopPropagation()
              e.preventDefault()
              togglePlay()
            }}
            title={playing ? '暂停' : '播放'}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing
              ? <Pause className="h-3.5 w-3.5" />
              : <Play className="h-3.5 w-3.5 fill-current" />}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={cn(
        'node-inner relative overflow-hidden bg-gradient-to-br from-emerald-950 via-zinc-900 to-zinc-950',
        'min-h-[120px] rounded-md',
        className,
      )}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <audio ref={audioRef} key={src} src={src} preload="metadata" className="pointer-events-none absolute h-px w-px opacity-0" aria-hidden />

      <div className="flex min-h-[72px] items-center justify-center px-4 pt-3">
        <div
          className={cn(
            'flex h-14 w-14 items-center justify-center rounded-full bg-black/40 ring-1 ring-white/10 transition',
            playing && 'scale-105 ring-emerald-400/40',
          )}
        >
          <Music className={cn('h-6 w-6 text-emerald-400', playing && 'animate-pulse')} />
        </div>
      </div>

      {!playing && (
        <button
          type="button"
          className="nodrag absolute inset-0 flex items-center justify-center bg-black/10 transition hover:bg-black/20"
          onClick={(e) => {
            e.stopPropagation()
            togglePlay()
          }}
          aria-label="播放"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </button>
      )}

      <div
        className="nodrag absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent px-2 pb-2 pt-8"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="nodrag flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
            onClick={(e) => {
              e.stopPropagation()
              togglePlay()
            }}
            onPointerDown={e => e.stopPropagation()}
            aria-label={playing ? '暂停' : '播放'}
          >
            {playing
              ? <Pause className="h-2.5 w-2.5" />
              : <Play className="h-2.5 w-2.5 fill-current" />}
          </button>

          <span className="shrink-0 text-[10px] tabular-nums text-white/85">
            {formatMediaTime(currentTime)}
          </span>

          <div
            className="nodrag relative h-1 min-w-0 flex-1 cursor-pointer rounded-full bg-white/20"
            onPointerDown={(e) => {
              e.stopPropagation()
              onTrackPointerDown(e)
            }}
            role="slider"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-400/90"
              style={{ width: `${progress * 100}%` }}
            />
          </div>

          <span className="shrink-0 text-[10px] tabular-nums text-white/60">
            {formatMediaTime(duration)}
          </span>

          <div
            className="relative flex items-center gap-0.5"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            {showVolumeSlider && (
              <input
                type="range"
                min={0}
                max={1}
                step={0.02}
                value={muted ? 0 : volume}
                onChange={(e) => {
                  const v = Number(e.target.value)
                  setVolume(v)
                  if (v > 0) setMuted(false)
                }}
                className="nodrag h-1 w-16 cursor-pointer accent-emerald-400"
                aria-label="音量"
              />
            )}
            <button
              type="button"
              className="nodrag flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
              onClick={(e) => {
                e.stopPropagation()
                setMuted(v => !v)
              }}
              onPointerDown={e => e.stopPropagation()}
              aria-label={muted ? '取消静音' : '静音'}
            >
              {muted || volume === 0
                ? <VolumeX className="h-2.5 w-2.5" />
                : <Volume2 className="h-2.5 w-2.5" />}
            </button>
          </div>

          {showExpand && (
            <MediaPreviewExpandButton
              kind="audio"
              url={src}
              title={previewTitle}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
            />
          )}
        </div>
      </div>
    </div>
  )
}
