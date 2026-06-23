'use client'

import { useCallback, useRef, useState } from 'react'
import {
  FileAudio,
  Image as ImageIcon,
  Loader2,
  Music,
  ShieldCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { hasAssetDrag, readAssetDragData } from '@/lib/asset-drag'
import { processImageFiles } from '@/lib/image-upload'
import { AUDIO_ACCEPT, IMAGE_ACCEPT, processMediaFile, VIDEO_ACCEPT } from '@/lib/media-upload'
import MediaPreviewImage from '@/components/media-preview-image'
import { openMediaPreview } from '@/store/media-preview-store'
import { useAssetLibraryStore } from '@/store/asset-library-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { toast } from '@/lib/toast-store'
import type { SeedanceModeInputRules } from '@/lib/seedance-connection-rules'
import type { SeedanceUpstreamRefs } from '@/lib/seedance-upstream'

type OmniReferenceMediaRowProps = {
  seedanceNodeId: string
  refs: SeedanceUpstreamRefs
  rules: SeedanceModeInputRules
  disabled?: boolean
  onRemoveImage: (imageNodeId: string) => void
  onRemoveVideo: (videoNodeId: string) => void
  onRemoveAudio: (audioNodeId: string) => void
}

function VideoAddIcon({ className }: { className?: string }) {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 20 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <path
        d="M15.5 2.58301C17.0187 2.58301 18.2498 3.81437 18.25 5.33301V14.666C18.25 16.1848 17.0188 17.416 15.5 17.416H4.5C2.98122 17.416 1.75 16.1848 1.75 14.666V5.33301C1.75018 3.81437 2.98133 2.58301 4.5 2.58301H15.5ZM4.5 4.08301C3.80975 4.08301 3.25018 4.6428 3.25 5.33301V14.666C3.25 15.3564 3.80964 15.916 4.5 15.916H15.5C16.1904 15.916 16.75 15.3564 16.75 14.666V5.33301C16.7498 4.6428 16.1902 4.08301 15.5 4.08301H4.5ZM7.96387 6.84766C8.19879 6.71472 8.48719 6.71777 8.71875 6.85645L12.8857 9.35645C13.1116 9.49199 13.25 9.73655 13.25 10C13.25 10.2634 13.1116 10.508 12.8857 10.6436L8.71875 13.1436C8.48719 13.2822 8.19879 13.2853 7.96387 13.1523C7.72888 13.0192 7.58301 12.7701 7.58301 12.5V7.5C7.58301 7.22989 7.72888 6.98082 7.96387 6.84766ZM9.08301 11.1748L11.041 10L9.08301 8.82422V11.1748Z"
        fill="currentColor"
      />
    </svg>
  )
}

function MediaSeparator() {
  return <div className="mx-0.5 h-10 w-px shrink-0 bg-border" />
}

function RemoveButton({
  disabled,
  onClick,
  label,
}: {
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onPointerDown={e => e.stopPropagation()}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
      className="nodrag absolute right-0.5 top-0.5 z-10 flex h-4 w-4 items-center justify-center rounded-sm bg-black/70 text-white opacity-0 transition hover:bg-red-600 group-hover:opacity-100 disabled:opacity-40"
      aria-label={label}
    >
      <X className="h-2.5 w-2.5" strokeWidth={3.5} />
    </button>
  )
}

function IndexBadge({ index }: { index: number }) {
  return (
    <div className="absolute left-1 top-1 flex h-4 min-w-4 items-center justify-center rounded bg-black/60 px-0.5 text-[10px] font-semibold leading-none text-white">
      {index}
    </div>
  )
}

function ReadyBadge() {
  return (
    <div className="absolute bottom-0.5 right-0.5">
      <ShieldCheck className="h-3 w-3 text-teal-500" strokeWidth={2} />
    </div>
  )
}

function AddMediaButton({
  disabled,
  uploading,
  onClick,
  children,
  title,
}: {
  disabled?: boolean
  uploading?: boolean
  onClick: () => void
  children: React.ReactNode
  title: string
}) {
  return (
    <button
      type="button"
      disabled={disabled || uploading}
      onClick={onClick}
      title={title}
      className={cn(
        'nodrag flex h-14 w-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted text-muted transition',
        'hover:border-primary-light/50 hover:bg-surface hover:text-foreground',
        (disabled || uploading) && 'cursor-not-allowed opacity-40',
      )}
    >
      {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : children}
    </button>
  )
}

export default function OmniReferenceMediaRow({
  seedanceNodeId,
  refs,
  rules,
  disabled = false,
  onRemoveImage,
  onRemoveVideo,
  onRemoveAudio,
}: OmniReferenceMediaRowProps) {
  const imageInputRef = useRef<HTMLInputElement>(null)
  const videoInputRef = useRef<HTMLInputElement>(null)
  const audioInputRef = useRef<HTMLInputElement>(null)
  const [uploadingKind, setUploadingKind] = useState<'image' | 'video' | 'audio' | null>(null)
  const uploadingRef = useRef(false)

  const addSeedanceOmniMedia = useWorkflowStore(s => s.addSeedanceOmniMedia)

  const canAddImage = rules.allowImages && refs.images.length < rules.maxImages
  const canAddVideo = rules.allowVideos && refs.videos.length < rules.maxVideos
  const canAddAudio = rules.allowAudios && refs.audios.length < rules.maxAudios

  const addMedia = useCallback((kind: 'image' | 'video' | 'audio', url: string) => {
    addSeedanceOmniMedia(seedanceNodeId, kind, url)
  }, [addSeedanceOmniMedia, seedanceNodeId])

  const uploadFiles = useCallback(async (kind: 'image' | 'video' | 'audio', files: File[]) => {
    if (disabled || uploadingRef.current || files.length === 0)
      return

    uploadingRef.current = true
    setUploadingKind(kind)
    try {
      if (kind === 'image') {
        const urls = await processImageFiles(files)
        for (const url of urls)
          addMedia('image', url)
      }
      else {
        for (const file of files) {
          const url = await processMediaFile(file, kind)
          addMedia(kind, url)
        }
      }
    }
    catch (err) {
      toast.error(err instanceof Error ? err.message : '上传失败')
    }
    finally {
      uploadingRef.current = false
      setUploadingKind(null)
    }
  }, [addMedia, disabled])

  const onFileInput = (kind: 'image' | 'video' | 'audio') => async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    await uploadFiles(kind, files)
  }

  const onRowDrop = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()

    const asset = readAssetDragData(e.dataTransfer)
    if (asset) {
      if (asset.kind === 'image' && canAddImage)
        addMedia('image', asset.url)
      else if (asset.kind === 'video' && canAddVideo)
        addMedia('video', asset.url)
      else if (asset.kind === 'audio' && canAddAudio)
        addMedia('audio', asset.url)
      else
        toast.error('当前类型素材已满或不受支持')
      useAssetLibraryStore.getState().setDraggingAssetKind(null)
      return
    }

    const files = Array.from(e.dataTransfer.files ?? [])
    if (files.length === 0)
      return

    const first = files[0]
    if (first.type.startsWith('image/') && canAddImage)
      void uploadFiles('image', files.filter(f => f.type.startsWith('image/')))
    else if (first.type.startsWith('video/') && canAddVideo)
      void uploadFiles('video', files.filter(f => f.type.startsWith('video/')))
    else if (first.type.startsWith('audio/') && canAddAudio)
      void uploadFiles('audio', files.filter(f => f.type.startsWith('audio/')))
    else
      toast.error('请拖入图片、视频或音频文件')
  }

  const onRowDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (hasAssetDrag(e.dataTransfer) || e.dataTransfer.types.includes('Files'))
      e.dataTransfer.dropEffect = 'copy'
  }

  return (
    <div
      className="mt-2.5 flex flex-wrap items-center gap-2 p-2"
      onDragOver={onRowDragOver}
      onDrop={onRowDrop}
    >
      {refs.images.map(image => (
        <div
          key={image.nodeId}
          className="group relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted"
        >
          <MediaPreviewImage
            src={image.imageUrl}
            alt=""
            title={`@图片${image.index}`}
            imageClassName="h-full w-full object-cover"
            showHint={false}
          />
          <IndexBadge index={image.index} />
          <RemoveButton
            disabled={disabled}
            label={`移除图片 ${image.index}`}
            onClick={() => onRemoveImage(image.nodeId)}
          />
          <ReadyBadge />
        </div>
      ))}

      {refs.videos.map(video => (
        <div
          key={video.nodeId}
          className="group relative h-14 w-[4.5rem] shrink-0 overflow-hidden rounded-lg border border-border bg-black"
        >
          <button
            type="button"
            className="nodrag relative block h-full w-full"
            onClick={e => {
              e.stopPropagation()
              openMediaPreview({
                kind: 'video',
                url: video.mediaUrl,
                title: `@视频${video.index}`,
              })
            }}
          >
            <video
              src={video.mediaUrl}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
              draggable={false}
            />
          </button>
          <IndexBadge index={video.index} />
          <RemoveButton
            disabled={disabled}
            label={`移除视频 ${video.index}`}
            onClick={() => onRemoveVideo(video.nodeId)}
          />
          <ReadyBadge />
        </div>
      ))}

      {refs.audios.map(audio => (
        <div
          key={audio.nodeId}
          className="group relative flex h-14 w-[4.5rem] shrink-0 flex-col items-center justify-center overflow-hidden rounded-lg border border-emerald-500/30 bg-emerald-500/10"
          title={`@音频${audio.index}`}
        >
          <FileAudio className="h-5 w-5 text-emerald-500" />
          <IndexBadge index={audio.index} />
          <RemoveButton
            disabled={disabled}
            label={`移除音频 ${audio.index}`}
            onClick={() => onRemoveAudio(audio.nodeId)}
          />
          <ReadyBadge />
        </div>
      ))}

      {canAddImage && (
        <>
          <input
            ref={imageInputRef}
            type="file"
            accept={IMAGE_ACCEPT}
            multiple
            className="hidden"
            disabled={disabled || uploadingKind === 'image'}
            onChange={onFileInput('image')}
          />
          <AddMediaButton
            disabled={disabled}
            uploading={uploadingKind === 'image'}
            onClick={() => imageInputRef.current?.click()}
            title={`添加图片 (${refs.images.length}/${rules.maxImages})`}
          >
            <ImageIcon className="h-3.5 w-3.5" strokeWidth={2} />
          </AddMediaButton>
        </>
      )}

      {canAddVideo && (
        <>
          {canAddImage && <MediaSeparator />}
          <input
            ref={videoInputRef}
            type="file"
            accept={VIDEO_ACCEPT}
            multiple
            className="hidden"
            disabled={disabled || uploadingKind === 'video'}
            onChange={onFileInput('video')}
          />
          <AddMediaButton
            disabled={disabled}
            uploading={uploadingKind === 'video'}
            onClick={() => videoInputRef.current?.click()}
            title={`添加视频 (${refs.videos.length}/${rules.maxVideos})`}
          >
            <VideoAddIcon />
          </AddMediaButton>
        </>
      )}

      {canAddAudio && (
        <>
          {(canAddImage || canAddVideo) && <MediaSeparator />}
          <input
            ref={audioInputRef}
            type="file"
            accept={AUDIO_ACCEPT}
            multiple
            className="hidden"
            disabled={disabled || uploadingKind === 'audio'}
            onChange={onFileInput('audio')}
          />
          <AddMediaButton
            disabled={disabled}
            uploading={uploadingKind === 'audio'}
            onClick={() => audioInputRef.current?.click()}
            title={`添加音频 (${refs.audios.length}/${rules.maxAudios})`}
          >
            <Music className="h-3.5 w-3.5" strokeWidth={2} />
          </AddMediaButton>
        </>
      )}
    </div>
  )
}
