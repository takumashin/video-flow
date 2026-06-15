'use client'

import { useCallback, useRef, useState } from 'react'
import { FileAudio, FileVideo, Link2, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  AUDIO_ACCEPT,
  MAX_AUDIO_SIZE,
  MAX_VIDEO_SIZE,
  VIDEO_ACCEPT,
} from '@/lib/media-upload-shared'
import { processMediaFile } from '@/lib/media-upload'
import { NodeTextInput } from './node-fields'

type MediaKind = 'video' | 'audio'

type MediaUploadZoneProps = {
  kind: MediaKind
  value: string
  onChange: (mediaUrl: string) => void
  disabled?: boolean
}

const CONFIG: Record<MediaKind, {
  accept: string
  maxSize: number
  sizeLabel: string
  formatsLabel: string
  emptyTitle: string
  previewLabel: string
  icon: typeof FileVideo
}> = {
  video: {
    accept: VIDEO_ACCEPT,
    maxSize: MAX_VIDEO_SIZE,
    sizeLabel: '5MB',
    formatsLabel: 'MP4 / WebM / MOV',
    emptyTitle: '点击或拖拽上传视频',
    previewLabel: '参考视频预览',
    icon: FileVideo,
  },
  audio: {
    accept: AUDIO_ACCEPT,
    maxSize: MAX_AUDIO_SIZE,
    sizeLabel: '10MB',
    formatsLabel: 'MP3 / WAV / M4A',
    emptyTitle: '点击或拖拽上传音频',
    previewLabel: '参考音频预览',
    icon: FileAudio,
  },
}

function getMediaSourceLabel(value: string): string | null {
  if (value.startsWith('/api/uploads/'))
    return '已保存到本地'
  if (value.startsWith('data:'))
    return '本地缓存（刷新后可能丢失，建议重新上传）'
  if (value.startsWith('http://') || value.startsWith('https://'))
    return '外链'
  return null
}

function stopCanvasFileDrag(e: React.DragEvent) {
  e.stopPropagation()
}

export default function MediaUploadZone({ kind, value, onChange, disabled }: MediaUploadZoneProps) {
  const config = CONFIG[kind]
  const Icon = config.icon
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showUrlInput, setShowUrlInput] = useState(false)
  const uploadingRef = useRef(false)

  const handleFile = useCallback(async (file: File) => {
    if (disabled || uploadingRef.current)
      return
    try {
      uploadingRef.current = true
      setError(null)
      setUploading(true)
      const mediaUrl = await processMediaFile(file, kind)
      onChange(mediaUrl)
      setShowUrlInput(false)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    }
    finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }, [disabled, kind, onChange])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file)
      handleFile(file)
    e.target.value = ''
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    stopCanvasFileDrag(e)
    if (!disabled && !uploadingRef.current)
      setDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    stopCanvasFileDrag(e)
    setDragOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    stopCanvasFileDrag(e)
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file)
      handleFile(file)
  }

  const isInline = value.startsWith('data:')
  const isExternalUrl = value.startsWith('http://') || value.startsWith('https://')
  const sourceLabel = value ? getMediaSourceLabel(value) : null

  return (
    <div
      className="space-y-2"
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept={config.accept}
        className="hidden"
        disabled={disabled || uploading}
        onChange={onInputChange}
      />

      {value
        ? (
            <div className="space-y-2">
              <div className="overflow-hidden rounded-md border border-border bg-surface-muted">
                {kind === 'video'
                  ? (
                      <video
                        src={value}
                        controls
                        playsInline
                        className="h-28 w-full bg-black object-cover"
                      />
                    )
                  : (
                      <div className="flex flex-col items-center gap-2 px-3 py-4">
                        <FileAudio className="h-8 w-8 text-sky-500" />
                        <audio src={value} controls className="w-full" />
                      </div>
                    )}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={() => inputRef.current?.click()}
                  className="nodrag flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-secondary hover:bg-surface-muted disabled:opacity-50"
                >
                  {uploading ? '上传中...' : kind === 'video' ? '更换视频' : '更换音频'}
                </button>
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={() => onChange('')}
                  className="nodrag rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-red-500 hover:bg-red-500/10 disabled:opacity-50"
                >
                  移除
                </button>
              </div>
              {sourceLabel && (
                <p className="text-[10px] text-muted">{sourceLabel}</p>
              )}
              {!disabled && !uploading && (
                <p className="text-[10px] text-muted/80">可拖拽新文件到此处替换</p>
              )}
            </div>
          )
        : (
            <button
              type="button"
              disabled={disabled || uploading}
              onClick={() => inputRef.current?.click()}
              className={cn(
                'nodrag flex w-full flex-col items-center gap-2 rounded-md border-2 border-dashed px-3 py-5 text-center transition',
                dragOver
                  ? 'border-primary-light bg-primary/10'
                  : 'border-border bg-surface-muted hover:border-border hover:bg-surface-muted/80',
                (disabled || uploading) && 'opacity-50',
              )}
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-sm">
                {uploading
                  ? <Loader2 className="h-5 w-5 animate-spin text-primary-light" />
                  : dragOver
                    ? <Upload className="h-5 w-5 text-primary-light" />
                    : <Icon className="h-5 w-5 text-sky-500 dark:text-sky-400" />}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground/90">
                  {uploading ? '正在保存...' : config.emptyTitle}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">
                  保存到本地 · {config.formatsLabel}，最大 {config.sizeLabel}
                </p>
              </div>
            </button>
          )}

      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => setShowUrlInput(v => !v)}
        className="nodrag inline-flex items-center gap-1 text-[10px] text-muted hover:text-foreground"
      >
        <Link2 className="h-3 w-3" />
        {showUrlInput ? '收起链接输入' : '或粘贴链接'}
      </button>

      {showUrlInput && (
        <NodeTextInput
          value={isInline ? '' : isExternalUrl ? value : ''}
          onChange={url => onChange(url)}
          placeholder={kind === 'video' ? 'https://example.com/video.mp4' : 'https://example.com/audio.mp3'}
          disabled={disabled || uploading}
        />
      )}

      {error && (
        <p className="rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
