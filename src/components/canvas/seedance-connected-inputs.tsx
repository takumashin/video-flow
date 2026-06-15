'use client'

import { FileAudio, FileVideo, Type, X } from 'lucide-react'
import { getSeedanceModeInputRules } from '@/lib/seedance-connection-rules'
import type { SeedanceGenerationMode } from '@/lib/types'
import { getImageRoleLabel, shouldShowImageRoleInPreview, type SeedanceUpstreamRefs } from '@/lib/seedance-upstream'

type SeedanceConnectedInputsProps = {
  refs: SeedanceUpstreamRefs
  mode: SeedanceGenerationMode
  disabled?: boolean
  onRemoveImage: (imageNodeId: string) => void
  onRemoveVideo: (videoNodeId: string) => void
  onRemoveAudio: (audioNodeId: string) => void
}

export default function SeedanceConnectedInputs({
  refs,
  mode,
  disabled = false,
  onRemoveImage,
  onRemoveVideo,
  onRemoveAudio,
}: SeedanceConnectedInputsProps) {
  const rules = getSeedanceModeInputRules(mode)
  const hasAnyMedia = refs.images.length > 0 || refs.videos.length > 0 || refs.audios.length > 0
  const showRole = shouldShowImageRoleInPreview(mode)

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
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={image.imageUrl}
                  alt={image.title}
                  className="h-full w-full object-cover"
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
                  className="nodrag absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 shadow-sm transition hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
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
                <video
                  src={video.mediaUrl}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover bg-black"
                  onPointerDown={e => e.stopPropagation()}
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                  <div className="rounded-full bg-black/45 p-1.5">
                    <FileVideo className="h-4 w-4 text-white" />
                  </div>
                </div>
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
                  className="nodrag absolute right-1 top-1 rounded-md bg-black/60 p-1 text-white opacity-0 shadow-sm transition hover:bg-red-600 group-hover:opacity-100 disabled:opacity-50"
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
