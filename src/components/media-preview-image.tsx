'use client'

import { ZoomIn } from 'lucide-react'
import { cn } from '@/lib/cn'
import { openMediaPreview } from '@/store/media-preview-store'

type MediaPreviewImageProps = {
  src: string
  alt: string
  title?: string
  className?: string
  imageClassName?: string
  showHint?: boolean
}

export default function MediaPreviewImage({
  src,
  alt,
  title,
  className,
  imageClassName,
  showHint = true,
}: MediaPreviewImageProps) {
  return (
    <button
      type="button"
      className={cn(
        'nodrag group relative block w-full overflow-hidden text-left',
        className,
      )}
      onClick={e => {
        e.stopPropagation()
        openMediaPreview({ kind: 'image', url: src, title: title ?? alt })
      }}
      aria-label={`放大预览：${alt}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        className={cn('cursor-zoom-in', imageClassName)}
        draggable={false}
      />
      {showHint && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/0 opacity-0 transition group-hover:bg-black/20 group-hover:opacity-100">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/60 px-2.5 py-1 text-[11px] font-medium text-white">
            <ZoomIn className="h-3.5 w-3.5" />
            点击放大
          </span>
        </span>
      )}
    </button>
  )
}
