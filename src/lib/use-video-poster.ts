'use client'

import { useEffect, useState } from 'react'

function captureVideoFrame(video: HTMLVideoElement): string | null {
  if (video.videoWidth === 0 || video.videoHeight === 0)
    return null

  try {
    const canvas = document.createElement('canvas')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext('2d')
    if (!ctx)
      return null
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.85)
  }
  catch {
    return null
  }
}

/** 从视频 URL 提取首帧，用作 poster / 缩略图 */
export function useVideoPoster(src: string | undefined, externalPoster?: string) {
  const [posterUrl, setPosterUrl] = useState<string | undefined>(externalPoster)

  useEffect(() => {
    setPosterUrl(externalPoster)

    if (!src || externalPoster)
      return

    let cancelled = false
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true
    video.playsInline = true
    video.preload = 'auto'
    video.src = src

    const finalize = () => {
      if (cancelled)
        return
      const dataUrl = captureVideoFrame(video)
      if (dataUrl)
        setPosterUrl(dataUrl)
    }

    const onLoadedData = () => {
      const onSeeked = () => {
        finalize()
        video.removeEventListener('seeked', onSeeked)
      }
      video.addEventListener('seeked', onSeeked)
      video.currentTime = Math.min(0.05, Number.isFinite(video.duration) ? video.duration * 0.01 : 0.05)
    }

    video.addEventListener('loadeddata', onLoadedData, { once: true })
    video.addEventListener('error', () => {
      if (!cancelled)
        setPosterUrl(undefined)
    }, { once: true })

    return () => {
      cancelled = true
      video.pause()
      video.removeAttribute('src')
      video.load()
    }
  }, [src, externalPoster])

  return posterUrl
}
