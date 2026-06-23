'use client'

import { Download } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  buildVideoDownloadFilename,
  getVideoDownloadHref,
} from '@/lib/video-download'

type VideoDownloadLinkProps = {
  videoUrl: string
  taskId?: string
  createdAt?: number
  className?: string
  iconClassName?: string
  showIcon?: boolean
  label?: string
}

export default function VideoDownloadLink({
  videoUrl,
  taskId,
  createdAt,
  className,
  iconClassName = 'h-3.5 w-3.5',
  showIcon = true,
  label = '下载',
}: VideoDownloadLinkProps) {
  const href = getVideoDownloadHref(videoUrl, { taskId, createdAt })
  const filename = buildVideoDownloadFilename({ taskId, createdAt })

  return (
    <a
      href={href}
      download={filename}
      className={cn(showIcon && 'inline-flex items-center gap-1.5', className)}
    >
      {showIcon && <Download className={iconClassName} />}
      {label}
    </a>
  )
}
