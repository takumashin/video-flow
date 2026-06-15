'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Link2, Loader2, Upload } from 'lucide-react'
import { cn } from '@/lib/cn'
import { IMAGE_ACCEPT, processImageFile } from '@/lib/image-upload'
import { NodeTextInput } from './node-fields'

type ImageUploadZoneProps = {
  value: string
  onChange: (imageUrl: string) => void
  disabled?: boolean
}

function getImageSourceLabel(value: string): string | null {
  if (value.startsWith('/api/uploads/'))
    return '已保存到本地'
  if (value.startsWith('data:'))
    return '本地缓存（刷新后可能丢失，建议重新上传）'
  if (value.startsWith('http://') || value.startsWith('https://'))
    return '外链图片'
  return null
}

export default function ImageUploadZone({ value, onChange, disabled }: ImageUploadZoneProps) {
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
      const imageUrl = await processImageFile(file)
      onChange(imageUrl)
      setShowUrlInput(false)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '上传失败')
    }
    finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }, [disabled, onChange])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file)
      handleFile(file)
    e.target.value = ''
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    if (file)
      handleFile(file)
  }

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!disabled && !uploadingRef.current)
      setDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const isInlineImage = value.startsWith('data:')
  const isExternalUrl = value.startsWith('http://') || value.startsWith('https://')
  const sourceLabel = value ? getImageSourceLabel(value) : null

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
        accept={IMAGE_ACCEPT}
        className="hidden"
        disabled={disabled || uploading}
        onChange={onInputChange}
      />

      {value
        ? (
            <div className="space-y-2">
              <div className="rounded-md border border-border bg-surface-muted p-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={value}
                  alt="参考图预览"
                  className="mx-auto block max-h-72 w-full object-contain"
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={disabled || uploading}
                  onClick={() => inputRef.current?.click()}
                  className="nodrag flex-1 rounded-md border border-border bg-surface px-2 py-1.5 text-[11px] font-medium text-secondary hover:bg-surface-muted disabled:opacity-50"
                >
                  {uploading ? '上传中...' : '更换图片'}
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
                    : <ImagePlus className="h-5 w-5 text-violet-500 dark:text-violet-400" />}
              </div>
              <div>
                <p className="text-xs font-medium text-foreground/90">
                  {uploading ? '正在保存图片...' : '点击或拖拽上传图片'}
                </p>
                <p className="mt-0.5 text-[10px] text-muted">保存到本地 · JPG / PNG / WebP，最大 10MB</p>
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
        {showUrlInput ? '收起链接输入' : '或粘贴图片链接'}
      </button>

      {showUrlInput && (
        <NodeTextInput
          value={isInlineImage ? '' : isExternalUrl ? value : ''}
          onChange={url => onChange(url)}
          placeholder="https://example.com/image.jpg"
          disabled={disabled || uploading}
        />
      )}

      {error && (
        <p className="rounded-md bg-red-500/10 px-2 py-1 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
