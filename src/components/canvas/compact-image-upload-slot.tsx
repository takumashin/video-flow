'use client'

import { useCallback, useRef, useState } from 'react'
import { ImagePlus, Loader2, Upload, X } from 'lucide-react'
import { cn } from '@/lib/cn'
import { hasAssetDrag, readAssetDragData } from '@/lib/asset-drag'
import { IMAGE_ACCEPT, processImageFile } from '@/lib/image-upload'
import MediaPreviewImage from '@/components/media-preview-image'
import { useAssetLibraryStore } from '@/store/asset-library-store'
import { toast } from '@/lib/toast-store'

type CompactImageUploadSlotProps = {
  label: string
  value?: string
  onChange: (imageUrl: string) => void
  onClear?: () => void
  disabled?: boolean
  className?: string
}

export function CompactImageUploadSlot({
  label,
  value,
  onChange,
  onClear,
  disabled,
  className,
}: CompactImageUploadSlotProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const uploadingRef = useRef(false)

  const draggingAssetKind = useAssetLibraryStore(s => s.draggingAssetKind)

  const handleFile = useCallback(async (file: File) => {
    if (disabled || uploadingRef.current)
      return
    try {
      uploadingRef.current = true
      setError(null)
      setUploading(true)
      const imageUrl = await processImageFile(file)
      onChange(imageUrl)
    }
    catch (err) {
      const message = err instanceof Error ? err.message : '上传失败'
      setError(message)
      toast.error(message)
    }
    finally {
      uploadingRef.current = false
      setUploading(false)
    }
  }, [disabled, onChange])

  const onInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file)
      void handleFile(file)
    e.target.value = ''
  }

  const canAcceptDrag = useCallback((dataTransfer: DataTransfer) => {
    if (hasAssetDrag(dataTransfer)) {
      const kind = draggingAssetKind ?? readAssetDragData(dataTransfer)?.kind
      return kind === 'image'
    }
    return dataTransfer.types.includes('Files')
  }, [draggingAssetKind])

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (disabled || uploading) {
      setDragOver(false)
      return
    }
    if (!canAcceptDrag(e.dataTransfer)) {
      e.dataTransfer.dropEffect = 'none'
      setDragOver(false)
      return
    }
    e.dataTransfer.dropEffect = 'copy'
    setDragOver(true)
  }

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)

    const asset = readAssetDragData(e.dataTransfer)
    if (asset) {
      if (asset.kind !== 'image') {
        setError('请拖入图片资产')
        return
      }
      setError(null)
      onChange(asset.url)
      useAssetLibraryStore.getState().setDraggingAssetKind(null)
      return
    }

    const file = e.dataTransfer.files?.[0]
    if (file)
      void handleFile(file)
  }

  return (
    <div className={cn('space-y-1', className)}>
      <p className="text-[10px] font-medium text-muted">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept={IMAGE_ACCEPT}
        className="hidden"
        disabled={disabled || uploading}
        onChange={onInputChange}
      />

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {value
          ? (
              <div
                className={cn(
                  'group relative aspect-[4/3] overflow-hidden rounded-lg border bg-violet-500/5 transition',
                  dragOver
                    ? 'border-primary-light ring-2 ring-primary-light/25'
                    : 'border-violet-500/30',
                )}
              >
                <MediaPreviewImage
                  src={value}
                  alt={label}
                  title={label}
                  imageClassName="h-full w-full object-cover"
                  showHint={false}
                />
                {onClear && (
                  <button
                    type="button"
                    disabled={disabled || uploading}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      onClear()
                    }}
                    className="nodrag absolute right-1 top-1 z-10 rounded-md bg-black/60 p-1 text-white opacity-0 shadow-sm transition hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
                    aria-label={`移除${label}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          : (
              <button
                type="button"
                disabled={disabled || uploading}
                onClick={() => inputRef.current?.click()}
                className={cn(
                  'nodrag flex aspect-[4/3] w-full flex-col items-center justify-center gap-1.5 rounded-lg border-2 border-dashed px-2 py-3 text-center transition',
                  dragOver
                    ? 'border-primary-light bg-primary/10'
                    : 'border-border bg-surface-muted hover:border-primary-light/40 hover:bg-surface-muted/80',
                  (disabled || uploading) && 'opacity-50',
                )}
              >
                {uploading
                  ? <Loader2 className="h-5 w-5 animate-spin text-primary-light" />
                  : dragOver
                    ? <Upload className="h-5 w-5 text-primary-light" />
                    : <ImagePlus className="h-5 w-5 text-violet-500 dark:text-violet-400" />}
                <span className="text-[10px] font-medium text-foreground/90">
                  {uploading ? '上传中…' : '点击上传'}
                </span>
                <span className="text-[9px] text-muted">或拖入图片/资产</span>
              </button>
            )}
      </div>

      {error && (
        <p className="rounded-md bg-red-500/10 px-1.5 py-0.5 text-[10px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
