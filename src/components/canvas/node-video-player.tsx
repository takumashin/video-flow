'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Camera, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { MediaPreviewExpandButton } from '@/components/media-preview-modal'
import { formatMediaTime } from '@/lib/format-media-time'
import { useVideoPoster } from '@/lib/use-video-poster'
import { cn } from '@/lib/cn'

type NodeVideoPlayerProps = {
  src: string
  poster?: string
  className?: string
  previewTitle?: string
  showScreenshot?: boolean
  showExpand?: boolean
  /** 画布节点内嵌：精简底栏、无时间文字 */
  variant?: 'default' | 'node'
}

export default function NodeVideoPlayer({
  src,
  poster,
  className,
  previewTitle = '视频预览',
  showScreenshot = true,
  showExpand = true,
  variant = 'default',
}: NodeVideoPlayerProps) {
  const isNode = variant === 'node'
  const videoRef = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)
  const framePoster = useVideoPoster(src, poster)
  const showFramePoster = !!framePoster && !playing

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    const video = videoRef.current
    if (!video)
      return

    const onTimeUpdate = () => setCurrentTime(video.currentTime)
    const onLoadedMetadata = () => setDuration(video.duration)
    const onDurationChange = () => setDuration(video.duration)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)

    video.addEventListener('timeupdate', onTimeUpdate)
    video.addEventListener('loadedmetadata', onLoadedMetadata)
    video.addEventListener('durationchange', onDurationChange)
    video.addEventListener('play', onPlay)
    video.addEventListener('pause', onPause)
    video.addEventListener('ended', onEnded)

    return () => {
      video.removeEventListener('timeupdate', onTimeUpdate)
      video.removeEventListener('loadedmetadata', onLoadedMetadata)
      video.removeEventListener('durationchange', onDurationChange)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('pause', onPause)
      video.removeEventListener('ended', onEnded)
    }
  }, [src])

  useEffect(() => {
    const video = videoRef.current
    if (!video)
      return
    video.volume = volume
    video.muted = muted
  }, [volume, muted])

  useEffect(() => {
    const video = videoRef.current
    if (!video || framePoster)
      return

    const seekToFirstFrame = () => {
      if (video.currentTime < 0.01)
        video.currentTime = 0.001
    }

    video.addEventListener('loadeddata', seekToFirstFrame, { once: true })
    return () => video.removeEventListener('loadeddata', seekToFirstFrame)
  }, [src, framePoster])

  const togglePlay = useCallback(() => {
    const video = videoRef.current
    if (!video)
      return
    if (video.paused)
      video.play()
    else
      video.pause()
  }, [])

  const seek = useCallback((ratio: number) => {
    const video = videoRef.current
    if (!video || !Number.isFinite(duration) || duration <= 0)
      return
    const next = Math.min(duration, Math.max(0, ratio * duration))
    video.currentTime = next
    setCurrentTime(next)
  }, [duration])

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    seek((e.clientX - rect.left) / rect.width)
  }

  const toggleMute = () => {
    setMuted(v => !v)
  }

  const captureScreenshot = () => {
    const video = videoRef.current
    if (!video || video.videoWidth === 0)
      return

    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/png')
    const anchor = document.createElement('a')
    anchor.href = dataUrl
    anchor.download = `screenshot-${Date.now()}.png`
    anchor.click()
  }

  return (
    <div
      className={cn(
        'node-inner relative overflow-hidden bg-black',
        isNode ? 'h-full min-h-0' : 'aspect-video min-h-[180px] rounded-md',
        className,
      )}
      onPointerDown={isNode ? undefined : e => e.stopPropagation()}
      onClick={isNode ? undefined : e => e.stopPropagation()}
    >
      <video
        ref={videoRef}
        key={src}
        src={src}
        poster={framePoster}
        playsInline
        preload="metadata"
        className={cn(
          'node-media absolute inset-0 h-full w-full bg-black object-contain',
          showFramePoster && 'opacity-0',
          isNode && 'pointer-events-none',
        )}
        onClick={isNode ? undefined : togglePlay}
      />

      {showFramePoster && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={framePoster}
          alt=""
          className="pointer-events-none absolute inset-0 h-full w-full object-contain"
          decoding="async"
        />
      )}

      {!playing && (
        isNode
          ? (
              <button
                type="button"
                className="nodrag pointer-events-auto absolute left-1/2 top-1/2 z-10 flex -translate-x-1/2 -translate-y-1/2 items-center justify-center"
                onClick={(e) => {
                  e.stopPropagation()
                  togglePlay()
                }}
                onPointerDown={e => e.stopPropagation()}
                aria-label="播放"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-1 ring-white/20 backdrop-blur-sm transition hover:bg-black/70">
                  <Play className="h-3.5 w-3.5 fill-current" />
                </span>
              </button>
            )
          : (
              <button
                type="button"
                className="nodrag absolute inset-0 flex items-center justify-center bg-black/20 transition hover:bg-black/30"
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
            )
      )}

      <div
        className={cn(
          'absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/50 to-transparent',
          isNode ? 'pointer-events-none px-1.5 pb-1.5 pt-6' : 'nodrag px-2 pb-2 pt-8',
        )}
        onPointerDown={isNode ? undefined : e => e.stopPropagation()}
      >
        <div className={cn('flex items-center gap-1', isNode && 'pointer-events-auto')}>
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

          {!isNode && (
            <span className="shrink-0 text-[10px] tabular-nums text-white/85">
              {formatMediaTime(currentTime)}
            </span>
          )}

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
              className="absolute inset-y-0 left-0 rounded-full bg-white/70"
              style={{ width: `${progress}%` }}
            />
          </div>

          <div
            className={cn('relative flex items-center gap-0.5', isNode && 'nodrag')}
            onMouseEnter={() => !isNode && setShowVolumeSlider(true)}
            onMouseLeave={() => !isNode && setShowVolumeSlider(false)}
          >
            {(isNode || showVolumeSlider) && (
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
                className={cn(
                  'nodrag cursor-pointer accent-white',
                  isNode ? 'h-1 w-10' : 'h-1 w-16',
                )}
                aria-label="音量"
              />
            )}
            <button
              type="button"
              className="nodrag flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
              onClick={(e) => {
                e.stopPropagation()
                toggleMute()
              }}
              onPointerDown={e => e.stopPropagation()}
              aria-label={muted ? '取消静音' : '静音'}
            >
              {muted || volume === 0
                ? <VolumeX className="h-2.5 w-2.5" />
                : <Volume2 className="h-2.5 w-2.5" />}
            </button>
          </div>

          {showExpand && !isNode && (
            <MediaPreviewExpandButton
              kind="video"
              url={src}
              title={previewTitle}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
            />
          )}

          {showScreenshot && (
            <button
              type="button"
              className="nodrag flex h-5 w-5 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
              onClick={(e) => {
                e.stopPropagation()
                captureScreenshot()
              }}
              onPointerDown={e => e.stopPropagation()}
              title="截图"
              aria-label="截图"
            >
              <Camera className="h-2.5 w-2.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
