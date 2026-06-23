'use client'

import { Play } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useVideoPoster } from '@/lib/use-video-poster'

type VideoFirstFrameThumbProps = {
  src: string
  poster?: string
  className?: string
  imageClassName?: string
  showPlayIcon?: boolean
  badge?: React.ReactNode
}

export function VideoFirstFrameThumb({
  src,
  poster,
  className,
  imageClassName,
  showPlayIcon = false,
  badge,
}: VideoFirstFrameThumbProps) {
  const posterUrl = useVideoPoster(src, poster)

  return (
    <div className={cn('relative overflow-hidden bg-black', className)}>
      {posterUrl
        ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={posterUrl}
              alt=""
              className={cn('h-full w-full object-contain', imageClassName)}
              decoding="async"
            />
          )
        : (
            <div className="flex h-full w-full items-center justify-center bg-black">
              <div className="h-5 w-5 animate-pulse rounded-full bg-white/10" />
            </div>
          )}

      {showPlayIcon && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/55 text-white">
            <Play className="h-3 w-3 fill-current" />
          </span>
        </div>
      )}

      {badge}
    </div>
  )
}
