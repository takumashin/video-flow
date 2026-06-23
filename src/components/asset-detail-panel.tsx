'use client'

import { ArrowLeft, Music, Plus } from 'lucide-react'
import MediaPreviewImage from '@/components/media-preview-image'
import { MediaPreviewExpandButton } from '@/components/media-preview-modal'
import MenuSelect from '@/components/menu-select'
import { openMediaPreview } from '@/store/media-preview-store'
import { cn } from '@/lib/cn'
import type { UploadAssetKind } from '@/lib/uploads'

export type AssetDetailItem = {
  id: string
  url: string
  kind: UploadAssetKind
  filename: string
  size: number
  createdAt: number
  folderId: string | null
}

type AssetFolderOption = {
  id: string
  name: string
}

type AssetDetailPanelProps = {
  item: AssetDetailItem
  kindLabel: string
  formattedSize: string
  formattedTime: string
  folders: AssetFolderOption[]
  movingFolder: boolean
  disabled: boolean
  onBack: () => void
  onAddToWorkflow: () => void
  onMoveToFolder: (folderId: string | null) => void
}

export default function AssetDetailPanel({
  item,
  kindLabel,
  formattedSize,
  formattedTime,
  folders,
  movingFolder,
  disabled,
  onBack,
  onAddToWorkflow,
  onMoveToFolder,
}: AssetDetailPanelProps) {
  const folderOptions = [
    { value: '', label: '未分类' },
    ...folders.map(folder => ({ value: folder.id, label: folder.name })),
  ]

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border-subtle px-2 py-2">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
          aria-label="返回列表"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium text-foreground">{item.filename}</p>
          <p className="text-[10px] text-muted">{kindLabel}</p>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        <div className="group/preview relative overflow-hidden rounded-lg border border-border bg-surface-muted">
          {item.kind === 'image'
            ? (
                <MediaPreviewImage
                  src={item.url}
                  alt={item.filename}
                  title={item.filename}
                  imageClassName="max-h-64 w-full object-contain"
                />
              )
            : item.kind === 'video'
              ? (
                  <>
                    <video
                      src={item.url}
                      controls
                      playsInline
                      preload="metadata"
                      className="max-h-64 w-full bg-black object-contain"
                      draggable={false}
                      onDoubleClick={() => {
                        openMediaPreview({ kind: 'video', url: item.url, title: item.filename })
                      }}
                    />
                    <MediaPreviewExpandButton
                      kind="video"
                      url={item.url}
                      title={item.filename}
                      className="absolute right-2 top-2 z-10 rounded-md bg-black/60 p-1.5 text-white opacity-80 shadow-sm transition hover:bg-black/80 hover:opacity-100"
                    />
                  </>
                )
              : (
                  <div className="flex flex-col items-center gap-3 px-4 py-8">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-surface">
                      <Music className="h-7 w-7 text-muted" />
                    </div>
                    <audio src={item.url} controls className="w-full" draggable={false} />
                  </div>
                )}
        </div>

        <dl className="mt-4 space-y-2.5 text-xs">
          <div>
            <dt className="text-[10px] text-muted">文件名</dt>
            <dd className="mt-0.5 break-all text-foreground">{item.filename}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted">类型</dt>
            <dd className="mt-0.5 text-foreground">{kindLabel}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted">大小</dt>
            <dd className="mt-0.5 text-foreground">{formattedSize}</dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted">文件夹</dt>
            <dd className="mt-0.5">
              <MenuSelect
                value={item.folderId ?? ''}
                options={folderOptions}
                disabled={disabled}
                loading={movingFolder}
                aria-label="选择文件夹"
                menuPlacement="above"
                onChange={value => onMoveToFolder(value || null)}
              />
            </dd>
          </div>
          <div>
            <dt className="text-[10px] text-muted">上传时间</dt>
            <dd className="mt-0.5 text-foreground">{formattedTime}</dd>
          </div>
        </dl>
      </div>

      <div className="border-t border-border-subtle p-3">
        <button
          type="button"
          disabled={disabled}
          onClick={onAddToWorkflow}
          className={cn(
            'inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#104BD4] disabled:opacity-50',
          )}
        >
          <Plus className="h-4 w-4" />
          加入工作流
        </button>
        <p className="mt-2 text-center text-[10px] text-muted">也可拖拽资产到画布添加</p>
      </div>
    </div>
  )
}
