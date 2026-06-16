'use client'

import { useEffect } from 'react'
import { ImageIcon, Maximize2, Music, Video, X } from 'lucide-react'
import NodeAudioPlayer from '@/components/canvas/node-audio-player'
import NodeVideoPlayer from '@/components/canvas/node-video-player'
import { useMediaPreviewStore } from '@/store/media-preview-store'

export default function MediaPreviewModal() {
  const item = useMediaPreviewStore(s => s.item)
  const close = useMediaPreviewStore(s => s.close)

  useEffect(() => {
    if (!item)
      return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [item, close])

  if (!item)
    return null

  const Icon = item.kind === 'image'
    ? ImageIcon
    : item.kind === 'video'
      ? Video
      : Music

  const defaultTitle = item.kind === 'image'
    ? '图片预览'
    : item.kind === 'video'
      ? '视频预览'
      : '音频预览'

  const closeHint = item.kind === 'image'
    ? '点击图片外区域或按 Esc 关闭'
    : '点击预览外区域或按 Esc 关闭'

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="media-preview-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={close}
        aria-label="关闭预览"
      />
      <div className="relative flex max-h-[min(900px,92vh)] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between gap-3 border-b border-border-subtle px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-surface-muted">
              <Icon className="h-4 w-4 text-primary-light" />
            </div>
            <div className="min-w-0">
              <h2 id="media-preview-title" className="truncate text-sm font-semibold text-foreground">
                {item.title ?? defaultTitle}
              </h2>
              <p className="text-[11px] text-muted">{closeHint}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            className="shrink-0 rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center bg-zinc-950 p-4">
          {item.kind === 'image'
            ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.url}
                  alt={item.title ?? '图片预览'}
                  className="max-h-[min(760px,calc(92vh-5rem))] max-w-full object-contain"
                  draggable={false}
                />
              )
            : item.kind === 'video'
              ? (
                  <NodeVideoPlayer
                    key={item.url}
                    src={item.url}
                    previewTitle={item.title}
                    showExpand={false}
                    className="w-full max-w-4xl !min-h-[min(480px,calc(92vh-8rem))]"
                  />
                )
              : (
                  <NodeAudioPlayer
                    key={item.url}
                    src={item.url}
                    previewTitle={item.title}
                    showExpand={false}
                    className="w-full max-w-2xl !min-h-[180px]"
                  />
                )}
        </div>
      </div>
    </div>
  )
}

type MediaPreviewExpandButtonProps = {
  kind: 'video' | 'audio'
  url: string
  title?: string
  className?: string
}

export function MediaPreviewExpandButton({
  kind,
  url,
  title,
  className,
}: MediaPreviewExpandButtonProps) {
  const open = useMediaPreviewStore(s => s.open)

  return (
    <button
      type="button"
      className={className}
      onClick={e => {
        e.stopPropagation()
        open({ kind, url, title })
      }}
      aria-label="放大预览"
      title="放大预览"
    >
      <Maximize2 className="h-3.5 w-3.5" />
    </button>
  )
}
