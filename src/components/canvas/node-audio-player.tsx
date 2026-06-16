'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Music, Pause, Play, Volume2, VolumeX } from 'lucide-react'
import { MediaPreviewExpandButton } from '@/components/media-preview-modal'
import { formatMediaTime } from '@/lib/format-media-time'
import { cn } from '@/lib/cn'

type NodeAudioPlayerProps = {
  src: string
  previewTitle?: string
  className?: string
  showExpand?: boolean
}

export default function NodeAudioPlayer({
  src,
  previewTitle = '音频预览',
  className,
  showExpand = true,
}: NodeAudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(0.8)
  const [muted, setMuted] = useState(false)
  const [showVolumeSlider, setShowVolumeSlider] = useState(false)

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  useEffect(() => {
    const audio = audioRef.current
    if (!audio)
      return

    const onTimeUpdate = () => setCurrentTime(audio.currentTime)
    const onLoadedMetadata = () => setDuration(audio.duration)
    const onDurationChange = () => setDuration(audio.duration)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => setPlaying(false)

    audio.addEventListener('timeupdate', onTimeUpdate)
    audio.addEventListener('loadedmetadata', onLoadedMetadata)
    audio.addEventListener('durationchange', onDurationChange)
    audio.addEventListener('play', onPlay)
    audio.addEventListener('pause', onPause)
    audio.addEventListener('ended', onEnded)

    return () => {
      audio.removeEventListener('timeupdate', onTimeUpdate)
      audio.removeEventListener('loadedmetadata', onLoadedMetadata)
      audio.removeEventListener('durationchange', onDurationChange)
      audio.removeEventListener('play', onPlay)
      audio.removeEventListener('pause', onPause)
      audio.removeEventListener('ended', onEnded)
    }
  }, [src])

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
    if (audio.paused)
      audio.play()
    else
      audio.pause()
  }, [])

  const seek = useCallback((ratio: number) => {
    const audio = audioRef.current
    if (!audio || !Number.isFinite(duration) || duration <= 0)
      return
    const next = Math.min(duration, Math.max(0, ratio * duration))
    audio.currentTime = next
    setCurrentTime(next)
  }, [duration])

  const onTrackPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    seek((e.clientX - rect.left) / rect.width)
  }

  return (
    <div
      className={cn(
        'node-inner relative min-h-[120px] overflow-hidden rounded-md bg-gradient-to-br from-emerald-950 via-zinc-900 to-zinc-950',
        className,
      )}
      onPointerDown={e => e.stopPropagation()}
      onClick={e => e.stopPropagation()}
    >
      <audio ref={audioRef} key={src} src={src} preload="metadata" className="hidden" />

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
          onClick={e => {
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
        className="nodrag absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent px-2 pb-2 pt-8"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
            onClick={togglePlay}
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
            className="nodrag relative h-1.5 min-w-0 flex-1 cursor-pointer rounded-full bg-white/25"
            onPointerDown={onTrackPointerDown}
            role="slider"
            aria-label="播放进度"
            aria-valuemin={0}
            aria-valuemax={duration}
            aria-valuenow={currentTime}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full bg-emerald-400"
              style={{ width: `${progress}%` }}
            />
          </div>

          <span className="shrink-0 text-[10px] tabular-nums text-white/60">
            {formatMediaTime(duration)}
          </span>

          <div
            className="relative flex items-center"
            onMouseEnter={() => setShowVolumeSlider(true)}
            onMouseLeave={() => setShowVolumeSlider(false)}
          >
            {showVolumeSlider && (
              <div className="nodrag absolute bottom-full right-0 mb-1 rounded-md bg-black/80 px-2 py-1.5 shadow-lg">
                <input
                  type="range"
                  min={0}
                  max={1}
                  step={0.02}
                  value={muted ? 0 : volume}
                  onChange={e => {
                    const v = Number(e.target.value)
                    setVolume(v)
                    if (v > 0)
                      setMuted(false)
                  }}
                  className="nodrag h-1 w-16 cursor-pointer accent-emerald-400"
                  aria-label="音量"
                />
              </div>
            )}
            <button
              type="button"
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-white/90 hover:bg-white/15"
              onClick={() => setMuted(v => !v)}
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
