'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Position } from 'reactflow'
import {
  GripHorizontal,
  Image as ImageIcon,
  Loader2,
  Music,
  PencilLine,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { hasAssetDrag, readAssetDragData } from '@/lib/asset-drag'
import { processImageFile, IMAGE_ACCEPT } from '@/lib/image-upload'
import { AUDIO_ACCEPT, processMediaFile, VIDEO_ACCEPT } from '@/lib/media-upload'
import { useAssetLibraryStore } from '@/store/asset-library-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { toast } from '@/lib/toast-store'
import { openMediaPreview } from '@/store/media-preview-store'
import { NodeType } from '@/lib/types'
import type { ImageInputNodeData, AudioInputNodeData, VideoInputNodeData, WorkflowNodeData } from '@/lib/types'
import WorkflowNodeHandle from './workflow-node-handle'
import NodeVideoPlayer from './node-video-player'
import NodeAudioPlayer from './node-audio-player'

const NODE_W = 356
const VIDEO_NODE_H = 200
const AUDIO_NODE_H = 160

const IMAGE_NODE_CONSTRAINTS = {
  maxWidth: 420,
  maxHeight: 360,
  minWidth: 120,
  minHeight: 90,
  emptyWidth: 200,
  emptyHeight: 150,
} as const

export function fitImageNodeSize(
  naturalWidth: number,
  naturalHeight: number,
): { width: number; height: number } {
  if (naturalWidth <= 0 || naturalHeight <= 0) {
    return {
      width: IMAGE_NODE_CONSTRAINTS.emptyWidth,
      height: IMAGE_NODE_CONSTRAINTS.emptyHeight,
    }
  }

  const ratio = naturalWidth / naturalHeight
  let width: number = IMAGE_NODE_CONSTRAINTS.maxWidth
  let height: number = width / ratio

  if (height > IMAGE_NODE_CONSTRAINTS.maxHeight) {
    height = IMAGE_NODE_CONSTRAINTS.maxHeight
    width = height * ratio
  }

  width = Math.max(IMAGE_NODE_CONSTRAINTS.minWidth, Math.round(width))
  height = Math.max(IMAGE_NODE_CONSTRAINTS.minHeight, Math.round(height))

  return { width, height }
}

function useImageNodeSize(mediaUrl: string, kind: MediaNodeKind) {
  const [size, setSize] = useState<{ width: number; height: number }>({
    width: IMAGE_NODE_CONSTRAINTS.emptyWidth,
    height: IMAGE_NODE_CONSTRAINTS.emptyHeight,
  })

  useEffect(() => {
    if (kind !== 'image') return

    if (!mediaUrl.trim()) {
      setSize({
        width: IMAGE_NODE_CONSTRAINTS.emptyWidth,
        height: IMAGE_NODE_CONSTRAINTS.emptyHeight,
      })
      return
    }

    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (!cancelled)
        setSize(fitImageNodeSize(img.naturalWidth, img.naturalHeight))
    }
    img.onerror = () => {
      if (!cancelled) {
        setSize({
          width: IMAGE_NODE_CONSTRAINTS.emptyWidth,
          height: IMAGE_NODE_CONSTRAINTS.emptyHeight,
        })
      }
    }
    img.src = mediaUrl

    return () => {
      cancelled = true
    }
  }, [kind, mediaUrl])

  return size
}

type MediaNodeKind = 'image' | 'video' | 'audio'

type CanvasMediaNodeProps = {
  kind: MediaNodeKind
  title: string
  mediaUrl: string
  disabled?: boolean
  selected?: boolean
  onMediaChange: (url: string) => void
  onTitleChange: (title: string) => void
}

function VideoTypeIcon({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className={className} aria-hidden>
      <path
        d="M15.5 2.58301C17.0187 2.58301 18.2498 3.81437 18.25 5.33301V14.666C18.25 16.1848 17.0188 17.416 15.5 17.416H4.5C2.98122 17.416 1.75 16.1848 1.75 14.666V5.33301C1.75018 3.81437 2.98133 2.58301 4.5 2.58301H15.5ZM4.5 4.08301C3.80975 4.08301 3.25018 4.6428 3.25 5.33301V14.666C3.25 15.3564 3.80964 15.916 4.5 15.916H15.5C16.1904 15.916 16.75 15.3564 16.75 14.666V5.33301C16.7498 4.6428 16.1902 4.08301 15.5 4.08301H4.5ZM7.96387 6.84766C8.19879 6.71472 8.48719 6.71777 8.71875 6.85645L12.8857 9.35645C13.1116 9.49199 13.25 9.73655 13.25 10C13.25 10.2634 13.1116 10.508 12.8857 10.6436L8.71875 13.1436C8.48719 13.2822 8.19879 13.2853 7.96387 13.1523C7.72888 13.0192 7.58301 12.7701 7.58301 12.5V7.5C7.58301 7.22989 7.72888 6.98082 7.96387 6.84766ZM9.08301 11.1748L11.041 10L9.08301 8.82422V11.1748Z"
        fill="currentColor"
      />
    </svg>
  )
}

function shortLabel(kind: MediaNodeKind, title: string): string {
  const num = title.match(/(\d+)\s*$/)?.[1]
  const suffix = num ? ` ${num}` : ''
  if (kind === 'video') return `视频${suffix}`
  if (kind === 'audio') {
    const trimmed = title.trim()
    if (trimmed)
      return trimmed.length > 18 ? `${trimmed.slice(0, 16)}…` : trimmed
    return `音频${suffix}`
  }
  return `图片${suffix}`
}

function kindIcon(kind: MediaNodeKind, className?: string) {
  if (kind === 'video') return <VideoTypeIcon className={cn('shrink-0 text-foreground/80', className)} />
  if (kind === 'audio') return <Music className={cn('h-3 w-3 shrink-0 text-foreground/80', className)} strokeWidth={2} />
  return <ImageIcon className={cn('h-3 w-3 shrink-0 text-foreground/80', className)} strokeWidth={2} />
}

function acceptFor(kind: MediaNodeKind): string {
  if (kind === 'video') return VIDEO_ACCEPT
  if (kind === 'audio') return AUDIO_ACCEPT
  return IMAGE_ACCEPT
}

export default function CanvasMediaNode({
  kind,
  title,
  mediaUrl,
  disabled,
  selected,
  onMediaChange,
  onTitleChange,
}: CanvasMediaNodeProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState(title)
  const uploadingRef = useRef(false)
  const draggingAssetKind = useAssetLibraryStore(s => s.draggingAssetKind)
  const imageSize = useImageNodeSize(mediaUrl, kind)

  const nodeWidth = kind === 'image' ? imageSize.width : NODE_W
  const nodeHeight = kind === 'image'
    ? imageSize.height
    : kind === 'audio'
      ? AUDIO_NODE_H
      : VIDEO_NODE_H
  const handleY = nodeHeight / 2
  const isImageNode = kind === 'image'

  const uploadFile = useCallback(async (file: File) => {
    if (disabled || uploadingRef.current) return
    try {
      uploadingRef.current = true
      setUploading(true)
      const url = kind === 'image'
        ? await processImageFile(file)
        : await processMediaFile(file, kind)
      onMediaChange(url)
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    }
    finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }, [disabled, kind, onMediaChange])

  const onPickFile = () => {
    if (!disabled && !uploading)
      inputRef.current?.click()
  }

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) void uploadFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    if (disabled || uploading) return

    const asset = readAssetDragData(e.dataTransfer)
    if (asset) {
      const ok = kind === 'image'
        ? asset.kind === 'image'
        : asset.kind === kind
      if (!ok) {
        toast.error(kind === 'image' ? '请拖入图片' : `请拖入${kind === 'video' ? '视频' : '音频'}`)
        return
      }
      onMediaChange(asset.url)
      useAssetLibraryStore.getState().setDraggingAssetKind(null)
      return
    }

    const file = e.dataTransfer.files?.[0]
    if (file) void uploadFile(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || uploading) return
    if (hasAssetDrag(e.dataTransfer) || e.dataTransfer.types.includes('Files'))
      setDragOver(true)
  }

  const commitTitle = () => {
    const next = titleDraft.trim()
    if (next && next !== title)
      onTitleChange(next)
    setEditingTitle(false)
  }

  return (
    <div
      className={cn(
        'canvas-node group/canvas-node relative overflow-visible transition-shadow',
        `canvas-node-${kind}`,
      )}
      style={{ width: nodeWidth, height: nodeHeight }}
    >
      <WorkflowNodeHandle type="target" position={Position.Left} centerY={handleY} />
      <WorkflowNodeHandle type="source" position={Position.Right} centerY={handleY} />

      <div
        className={cn(
          'absolute inset-0 overflow-hidden rounded-xl border shadow-sm',
          isImageNode ? 'bg-black' : 'bg-surface',
          selected ? 'border-primary-light ring-2 ring-primary-light/25' : 'border-border',
        )}
      >
        <div className={cn(
          'canvas-node-type-label absolute left-2 top-1.5 z-20 flex max-w-[calc(100%-3rem)] items-center gap-1 rounded-md px-1.5 py-0.5 text-xs font-medium',
          kind === 'audio'
            ? 'border border-border bg-surface/95 text-foreground shadow-sm backdrop-blur-sm'
            : 'nodrag bg-black/45 text-white backdrop-blur-sm',
        )}
        >
          {kindIcon(kind, kind === 'audio' ? 'text-foreground/80' : 'text-white/90')}
          {editingTitle
            ? (
                <input
                  value={titleDraft}
                  onChange={e => setTitleDraft(e.target.value)}
                  onBlur={commitTitle}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitTitle()
                    if (e.key === 'Escape') setEditingTitle(false)
                  }}
                  className={cn(
                    'nodrag min-w-0 max-w-[120px] rounded border px-1 py-0 text-xs outline-none',
                    kind === 'audio'
                      ? 'border-border bg-input text-foreground focus:border-primary-light'
                      : 'border-white/20 bg-black/50 text-white focus:border-white/50',
                  )}
                  autoFocus
                />
              )
            : (
                <span className="truncate">{shortLabel(kind, title)}</span>
              )}
          <button
            type="button"
            className={cn(
              'nodrag shrink-0 rounded p-0.5',
              kind === 'audio' ? 'text-muted hover:text-foreground' : 'text-white/70 hover:text-white',
            )}
            onClick={() => { setTitleDraft(title); setEditingTitle(true) }}
            aria-label="重命名"
          >
            <PencilLine className="h-2.5 w-2.5" />
          </button>
        </div>

        <div
          className="canvas-node-drag-pill node-drag-header absolute left-1/2 top-1 z-20 -translate-x-1/2"
          aria-hidden
        >
          <GripHorizontal className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={acceptFor(kind)}
          className="hidden"
          disabled={disabled || uploading}
          onChange={onInputChange}
        />

        <div
          className={cn(
            'canvas-node-inner absolute inset-0 overflow-hidden',
            kind === 'audio' ? 'bg-surface' : 'bg-black',
            mediaUrl && (kind === 'video' || kind === 'audio') && 'cursor-grab active:cursor-grabbing',
          )}
          onDragOver={onDragOver}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
        >
          {mediaUrl
            ? (
                kind === 'video'
                  ? (
                      <NodeVideoPlayer
                        src={mediaUrl}
                        previewTitle={title}
                        variant="node"
                        showExpand={false}
                        showScreenshot
                        className="!min-h-0 h-full !rounded-none"
                      />
                    )
                  : kind === 'audio'
                    ? (
                        <NodeAudioPlayer
                          src={mediaUrl}
                          previewTitle={title}
                          variant="node"
                          showExpand={false}
                          className="!min-h-0 h-full !rounded-none"
                        />
                      )
                    : (
                        <div
                          className="flex h-full w-full cursor-grab items-center justify-center active:cursor-grabbing"
                          title="拖动移动 · 双击放大"
                          onDoubleClick={(e) => {
                            e.stopPropagation()
                            openMediaPreview({ kind: 'image', url: mediaUrl, title })
                          }}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={mediaUrl}
                            alt=""
                            draggable={false}
                            className="pointer-events-none max-h-full max-w-full select-none object-contain"
                          />
                        </div>
                      )
              )
            : (
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={onPickFile}
                  className={cn(
                    'nodrag flex h-full w-full flex-col items-center justify-center transition',
                    dragOver ? 'bg-primary/15' : 'bg-surface-muted hover:bg-surface-muted/80',
                    (disabled || uploading) && 'opacity-50',
                  )}
                >
                  {uploading
                    ? <Loader2 className="h-6 w-6 animate-spin text-primary-light" />
                    : dragOver
                      ? <Upload className="h-6 w-6 text-primary-light" />
                      : kindIcon(kind)}
                </button>
              )}
        </div>
      </div>
    </div>
  )
}

export function isCanvasMediaNodeType(type: NodeType): type is
  | NodeType.ImageInput
  | NodeType.VideoInput
  | NodeType.AudioInput {
  return type === NodeType.ImageInput
    || type === NodeType.VideoInput
    || type === NodeType.AudioInput
}

export function isCanvasMediaNodeData(
  data: WorkflowNodeData,
): data is ImageInputNodeData | VideoInputNodeData | AudioInputNodeData {
  return isCanvasMediaNodeType(data.type)
}

export function mediaKindFromNodeType(type: NodeType.ImageInput | NodeType.VideoInput | NodeType.AudioInput): MediaNodeKind {
  if (type === NodeType.VideoInput) return 'video'
  if (type === NodeType.AudioInput) return 'audio'
  return 'image'
}

export function getMediaUrlFromNode(data: ImageInputNodeData | VideoInputNodeData | AudioInputNodeData): string {
  if (data.type === NodeType.ImageInput)
    return data.imageUrl
  return data.mediaUrl
}
