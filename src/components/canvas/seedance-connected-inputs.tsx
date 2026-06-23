'use client'

import { FileAudio, FileVideo, Type, X } from 'lucide-react'
import MediaPreviewImage from '@/components/media-preview-image'
import { CompactImageUploadSlot } from '@/components/canvas/compact-image-upload-slot'
import OmniReferenceMediaRow from '@/components/canvas/omni-reference-media-row'
import { openMediaPreview } from '@/store/media-preview-store'
import { getSeedanceModeInputRules } from '@/lib/seedance-connection-rules'
import type { ImageRole, SeedanceGenerationMode } from '@/lib/types'
import { getImageRoleLabel, shouldShowImageRoleInPreview, type SeedanceUpstreamRefs, type UpstreamImageRef } from '@/lib/seedance-upstream'

type SeedanceConnectedInputsProps = {
  seedanceNodeId: string
  refs: SeedanceUpstreamRefs
  mode: SeedanceGenerationMode
  disabled?: boolean
  layout?: 'stack' | 'row'
  onRemoveImage: (imageNodeId: string) => void
  onRemoveVideo: (videoNodeId: string) => void
  onRemoveAudio: (audioNodeId: string) => void
  onUploadFrameImage?: (role: ImageRole, imageUrl: string) => void
}

function findFrameImage(
  images: UpstreamImageRef[],
  role: ImageRole,
): UpstreamImageRef | undefined {
  return images.find(image => image.role === role)
}

function FirstLastFrameInputs({
  refs,
  disabled,
  onRemoveImage,
  onUploadFrameImage,
}: {
  refs: SeedanceUpstreamRefs
  disabled?: boolean
  onRemoveImage: (imageNodeId: string) => void
  onUploadFrameImage: (role: ImageRole, imageUrl: string) => void
}) {
  const firstFrame = findFrameImage(refs.images, 'first_frame')
  const lastFrame = findFrameImage(refs.images, 'last_frame')

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-medium text-muted">首尾帧参考图</p>
        <span className="text-[10px] text-muted">{refs.images.length}/2</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <CompactImageUploadSlot
          label="首帧"
          value={firstFrame?.imageUrl}
          disabled={disabled}
          onChange={imageUrl => onUploadFrameImage('first_frame', imageUrl)}
          onClear={firstFrame
            ? () => onRemoveImage(firstFrame.nodeId)
            : undefined}
        />
        <CompactImageUploadSlot
          label="尾帧"
          value={lastFrame?.imageUrl}
          disabled={disabled}
          onChange={imageUrl => onUploadFrameImage('last_frame', imageUrl)}
          onClear={lastFrame
            ? () => onRemoveImage(lastFrame.nodeId)
            : undefined}
        />
      </div>
      <p className="text-[10px] leading-relaxed text-muted">
        可从资产库拖入首帧/尾帧，或在画布连接参考图片节点；上传后会自动创建并连线
      </p>
    </div>
  )
}

export default function SeedanceConnectedInputs({
  seedanceNodeId: _seedanceNodeId,
  refs,
  mode,
  disabled = false,
  layout = 'stack',
  onRemoveImage,
  onRemoveVideo,
  onRemoveAudio,
  onUploadFrameImage,
}: SeedanceConnectedInputsProps) {
  const rules = getSeedanceModeInputRules(mode)
  const hasAnyMedia = refs.images.length > 0 || refs.videos.length > 0 || refs.audios.length > 0
  const showRole = shouldShowImageRoleInPreview(mode)

  if (layout === 'row') {
    if (mode === 'omni_reference') {
      return (
        <OmniReferenceMediaRow
          seedanceNodeId={_seedanceNodeId}
          refs={refs}
          rules={rules}
          disabled={disabled}
          onRemoveImage={onRemoveImage}
          onRemoveVideo={onRemoveVideo}
          onRemoveAudio={onRemoveAudio}
        />
      )
    }

    if (mode === 'first_last_frame' && onUploadFrameImage) {
      const firstFrame = findFrameImage(refs.images, 'first_frame')
      const lastFrame = findFrameImage(refs.images, 'last_frame')

      return (
        <div className="flex flex-wrap items-center gap-1.5">
          <CompactImageUploadSlot
            label="首帧"
            badge="首"
            variant="tile"
            value={firstFrame?.imageUrl}
            disabled={disabled}
            onChange={imageUrl => onUploadFrameImage('first_frame', imageUrl)}
            onClear={firstFrame ? () => onRemoveImage(firstFrame.nodeId) : undefined}
          />
          <CompactImageUploadSlot
            label="尾帧"
            badge="尾"
            variant="tile"
            value={lastFrame?.imageUrl}
            disabled={disabled}
            onChange={imageUrl => onUploadFrameImage('last_frame', imageUrl)}
            onClear={lastFrame ? () => onRemoveImage(lastFrame.nodeId) : undefined}
          />
        </div>
      )
    }

    if (!hasAnyMedia && mode === 'text_to_video') {
      return null
    }

    if (!hasAnyMedia) {
      return (
        <p className="text-[11px] text-muted">{rules.hint}</p>
      )
    }

    return (
      <div className="flex flex-wrap items-center gap-1.5">
        {refs.images.map(image => (
          <div
            key={image.nodeId}
            className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-surface-muted"
          >
            <MediaPreviewImage
              src={image.imageUrl}
              alt={image.title}
              title={`@图片${image.index}`}
              imageClassName="h-full w-full object-cover"
              showHint={false}
            />
            <div className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-black/55 text-[9px] font-semibold text-white">
              {image.index}
            </div>
            <button
              type="button"
              disabled={disabled}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                onRemoveImage(image.nodeId)
              }}
              className="nodrag absolute right-0.5 top-0.5 z-10 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100 disabled:opacity-50"
              aria-label={`移除 ${image.title}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {refs.videos.map(video => (
          <div
            key={video.nodeId}
            className="group relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-border bg-black"
          >
            <video
              src={video.mediaUrl}
              muted
              playsInline
              preload="metadata"
              className="h-full w-full object-cover"
              draggable={false}
            />
            <div className="absolute left-1 top-1 flex h-4 w-4 items-center justify-center rounded bg-black/55 text-[9px] font-semibold text-white">
              {video.index}
            </div>
            <button
              type="button"
              disabled={disabled}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                onRemoveVideo(video.nodeId)
              }}
              className="nodrag absolute right-0.5 top-0.5 z-10 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
              aria-label={`移除 ${video.title}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
        {refs.audios.map(audio => (
          <div
            key={audio.nodeId}
            className="group relative flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-lg border border-emerald-500/30 bg-emerald-500/10"
            title={audio.title}
          >
            <FileAudio className="h-5 w-5 text-emerald-500" />
            <span className="mt-0.5 text-[9px] font-medium text-emerald-600 dark:text-emerald-400">
              音频{audio.index}
            </span>
            <button
              type="button"
              disabled={disabled}
              onPointerDown={e => e.stopPropagation()}
              onClick={e => {
                e.stopPropagation()
                onRemoveAudio(audio.nodeId)
              }}
              className="nodrag absolute right-0.5 top-0.5 rounded bg-black/60 p-0.5 text-white opacity-0 transition group-hover:opacity-100"
              aria-label={`移除 ${audio.title}`}
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    )
  }

  if (mode === 'first_last_frame' && onUploadFrameImage) {
    return (
      <div className="space-y-3">
        <FirstLastFrameInputs
          refs={refs}
          disabled={disabled}
          onRemoveImage={onRemoveImage}
          onUploadFrameImage={onUploadFrameImage}
        />
        <SeedanceConnectedTextHint refs={refs} />
      </div>
    )
  }

  if (mode === 'omni_reference') {
    return (
      <OmniReferenceMediaRow
        seedanceNodeId={_seedanceNodeId}
        refs={refs}
        rules={rules}
        disabled={disabled}
        onRemoveImage={onRemoveImage}
        onRemoveVideo={onRemoveVideo}
        onRemoveAudio={onRemoveAudio}
      />
    )
  }

  if (!hasAnyMedia) {
    return (
      <div className="rounded-md border border-dashed border-border bg-surface-muted px-3 py-2 text-center">
        <p className="text-[11px] text-muted">{rules.hint}</p>
        <p className="mt-1 text-[10px] text-muted/80">
          连接后可在描述中用 @ 引用（如 @图片1、@视频1、@音频1），也可在下方直接删除
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {rules.allowImages && refs.images.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted">已连接图片</p>
            <span className="text-[10px] text-muted">
              {refs.images.length}/{rules.maxImages}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {refs.images.map(image => (
              <div
                key={image.nodeId}
                className="group relative aspect-square overflow-hidden rounded-lg border border-violet-500/30 bg-violet-500/5"
              >
                <MediaPreviewImage
                  src={image.imageUrl}
                  alt={image.title}
                  title={`@图片${image.index} · ${image.title}`}
                  imageClassName="h-full w-full object-cover"
                  showHint={false}
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-4">
                  <p className="truncate text-[10px] font-medium text-white">
                    @图片{image.index}
                  </p>
                  {showRole && (
                    <p className="truncate text-[9px] text-white/75">
                      {getImageRoleLabel(image.role)}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    onRemoveImage(image.nodeId)
                  }}
                  className="nodrag absolute right-1 top-1 z-10 rounded-md bg-black/60 p-1 text-white opacity-0 shadow-sm transition hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
                  aria-label={`移除 ${image.title}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rules.allowVideos && refs.videos.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted">已连接视频</p>
            <span className="text-[10px] text-muted">
              {refs.videos.length}/{rules.maxVideos}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {refs.videos.map(video => (
              <div
                key={video.nodeId}
                className="group relative aspect-square overflow-hidden rounded-lg border border-sky-500/30 bg-sky-500/5"
              >
                <button
                  type="button"
                  className="nodrag relative block h-full w-full"
                  onClick={e => {
                    e.stopPropagation()
                    openMediaPreview({
                      kind: 'video',
                      url: video.mediaUrl,
                      title: `@视频${video.index} · ${video.title}`,
                    })
                  }}
                  aria-label={`预览 ${video.title}`}
                >
                  <video
                    src={video.mediaUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover bg-black"
                    draggable={false}
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/10 transition group-hover:bg-black/25">
                    <div className="rounded-full bg-black/45 p-1.5">
                      <FileVideo className="h-4 w-4 text-white" />
                    </div>
                  </div>
                </button>
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1.5 pt-4">
                  <p className="truncate text-[10px] font-medium text-white">
                    @视频{video.index}
                  </p>
                  <p className="truncate text-[9px] text-white/75">{video.title}</p>
                </div>
                <button
                  type="button"
                  disabled={disabled}
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => {
                    e.stopPropagation()
                    onRemoveVideo(video.nodeId)
                  }}
                  className="nodrag absolute right-1 top-1 z-10 rounded-md bg-black/60 p-1 text-white opacity-0 shadow-sm transition hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
                  aria-label={`移除 ${video.title}`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {rules.allowAudios && refs.audios.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-medium text-muted">已连接音频</p>
            <span className="text-[10px] text-muted">
              {refs.audios.length}/{rules.maxAudios}
            </span>
          </div>
          <div className="space-y-1.5">
            {refs.audios.map(audio => (
              <div
                key={audio.nodeId}
                className="rounded-md border border-emerald-500/25 bg-emerald-500/5 px-2 py-2"
              >
                <div className="flex items-start gap-2">
                  <FileAudio className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="truncate text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                      @音频{audio.index} · {audio.title}
                    </p>
                    <audio
                      src={audio.mediaUrl}
                      controls
                      className="w-full"
                      onPointerDown={e => e.stopPropagation()}
                    />
                  </div>
                  <button
                    type="button"
                    disabled={disabled}
                    onPointerDown={e => e.stopPropagation()}
                    onClick={e => {
                      e.stopPropagation()
                      onRemoveAudio(audio.nodeId)
                    }}
                    className="nodrag shrink-0 rounded-md p-1 text-muted transition hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                    aria-label={`移除 ${audio.title}`}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="text-[10px] text-muted/80">
        点击 × 可断开连接并从描述中移除对应 @ 引用
      </p>
    </div>
  )
}

export function SeedanceConnectedTextHint({ refs }: Pick<SeedanceConnectedInputsProps, 'refs'>) {
  if (refs.texts.length === 0)
    return null

  return (
    <div className="rounded-md border border-primary-light/25 bg-primary/5 px-2.5 py-2">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-primary-light">
        <Type className="h-3 w-3 shrink-0" />
        <span>已连接文本节点，可用 @文本:标题 引用</span>
      </div>
    </div>
  )
}
