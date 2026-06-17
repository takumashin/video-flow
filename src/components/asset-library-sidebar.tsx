'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from 'reactflow'
import {
  Folder,
  FolderOpen,
  ImageIcon,
  Loader2,
  Music,
  PanelLeftClose,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAssetDragData, hasAssetDrag, readAssetDragData } from '@/lib/asset-drag'
import type { UploadAssetKind } from '@/lib/uploads'
import {
  AUDIO_ACCEPT,
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
} from '@/lib/media-upload-shared'
import { processImageFiles } from '@/lib/image-upload'
import { processAudioFiles, processVideoFiles } from '@/lib/media-upload'
import AssetDetailPanel from '@/components/asset-detail-panel'
import CreateAssetFolderDialog from '@/components/create-asset-folder-dialog'
import { useAssetLibraryStore, type AssetFolderFilter } from '@/store/asset-library-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { toast } from '@/lib/toast-store'

type UploadListItem = {
  id: string
  url: string
  kind: UploadAssetKind
  filename: string
  size: number
  createdAt: number
  folderId: string | null
}

type AssetFolderSummary = {
  id: string
  name: string
  assetCount: number
}

const TAB_OPTIONS: Array<{ kind: UploadAssetKind; label: string; icon: typeof ImageIcon }> = [
  { kind: 'image', label: '图片', icon: ImageIcon },
  { kind: 'video', label: '视频', icon: Video },
  { kind: 'audio', label: '音频', icon: Music },
]

const ACCEPT_BY_KIND: Record<UploadAssetKind, string> = {
  image: IMAGE_ACCEPT,
  video: VIDEO_ACCEPT,
  audio: AUDIO_ACCEPT,
}

function formatBytes(bytes: number) {
  if (bytes < 1024)
    return `${bytes} B`
  if (bytes < 1024 * 1024)
    return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function matchesFolderFilter(item: UploadListItem, folderFilter: AssetFolderFilter) {
  if (folderFilter === 'all')
    return true
  if (folderFilter === 'uncategorized')
    return item.folderId === null
  return item.folderId === folderFilter
}

function getUploadFolderId(folderFilter: AssetFolderFilter): string | null | undefined {
  if (folderFilter === 'all' || folderFilter === 'uncategorized')
    return undefined
  return folderFilter
}

function getMoveFolderId(folderFilter: AssetFolderFilter): string | null | undefined {
  if (folderFilter === 'all')
    return undefined
  if (folderFilter === 'uncategorized')
    return null
  return folderFilter
}

export default function AssetLibrarySidebar() {
  const [activeTab, setActiveTab] = useState<UploadAssetKind>('image')
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [folders, setFolders] = useState<AssetFolderSummary[]>([])
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [createFolderOpen, setCreateFolderOpen] = useState(false)
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [createFolderError, setCreateFolderError] = useState<string | null>(null)
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null)
  const [editingFolderName, setEditingFolderName] = useState('')
  const [deletingFolderId, setDeletingFolderId] = useState<string | null>(null)
  const [dropTargetFolderId, setDropTargetFolderId] = useState<AssetFolderFilter | null>(null)
  const [movingAssetId, setMovingAssetId] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const refreshKey = useAssetLibraryStore(s => s.refreshKey)
  const bumpRefresh = useAssetLibraryStore(s => s.bumpRefresh)
  const setAssetLibraryOpen = useAssetLibraryStore(s => s.setOpen)
  const setDraggingAssetKind = useAssetLibraryStore(s => s.setDraggingAssetKind)
  const selectedFolderId = useAssetLibraryStore(s => s.selectedFolderId)
  const setSelectedFolderId = useAssetLibraryStore(s => s.setSelectedFolderId)
  const addImageNode = useWorkflowStore(s => s.addImageNode)
  const addVideoNode = useWorkflowStore(s => s.addVideoNode)
  const addAudioNode = useWorkflowStore(s => s.addAudioNode)
  const addLog = useWorkflowStore(s => s.addLog)
  const { getViewport } = useReactFlow()

  const fetchLibrary = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [uploadsResponse, foldersResponse] = await Promise.all([
        fetch('/api/uploads'),
        fetch('/api/asset-folders'),
      ])
      const uploadsData = await uploadsResponse.json()
      const foldersData = await foldersResponse.json()

      if (!uploadsResponse.ok)
        throw new Error(uploadsData.error || '加载资产失败')
      if (!foldersResponse.ok)
        throw new Error(foldersData.error || '加载文件夹失败')

      setUploads(uploadsData.uploads ?? [])
      setFolders(foldersData.folders ?? [])
      setUncategorizedCount(foldersData.uncategorizedCount ?? 0)
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLibrary()
  }, [fetchLibrary, refreshKey])

  const getCanvasCenterPosition = () => {
    const viewport = getViewport()
    const container = document.getElementById('workflow-container')
    const width = container?.clientWidth ?? 800
    const height = container?.clientHeight ?? 600
    return {
      x: (-viewport.x + width / 2) / viewport.zoom - 150,
      y: (-viewport.y + height / 2) / viewport.zoom - 80,
    }
  }

  const addAssetToCanvas = (item: UploadListItem) => {
    const position = getCanvasCenterPosition()
    if (item.kind === 'image')
      addImageNode(item.url, position)
    else if (item.kind === 'video')
      addVideoNode(item.url, position)
    else
      addAudioNode(item.url, position)

    addLog({
      nodeId: 'system',
      nodeTitle: '系统',
      message: `已将${TAB_OPTIONS.find(t => t.kind === item.kind)?.label ?? '素材'}加入工作流`,
      level: 'success',
    })
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length)
      return

    setUploading(true)
    setError(null)
    const uploadFolderId = getUploadFolderId(selectedFolderId)
    try {
      if (activeTab === 'image') {
        const urls = await processImageFiles(Array.from(files), uploadFolderId)
        urls.forEach(url => addImageNode(url, getCanvasCenterPosition()))
      }
      else if (activeTab === 'video') {
        const urls = await processVideoFiles(Array.from(files), uploadFolderId)
        urls.forEach(url => addVideoNode(url, getCanvasCenterPosition()))
      }
      else {
        const urls = await processAudioFiles(Array.from(files), uploadFolderId)
        urls.forEach(url => addAudioNode(url, getCanvasCenterPosition()))
      }
      bumpRefresh()
      addLog({
        nodeId: 'system',
        nodeTitle: '系统',
        message: '资产已上传并添加到画布',
        level: 'success',
      })
    }
    catch (err) {
      const message = err instanceof Error ? err.message : '上传失败'
      setError(message)
      toast.error(message)
      addLog({
        nodeId: 'system',
        nodeTitle: '系统',
        message,
        level: 'error',
      })
    }
    finally {
      setUploading(false)
    }
  }

  const handleCreateFolder = async (name: string) => {
    setCreatingFolder(true)
    setCreateFolderError(null)
    try {
      const response = await fetch('/api/asset-folders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '创建失败')

      setCreateFolderOpen(false)
      setSelectedFolderId(data.folder.id)
      bumpRefresh()
    }
    catch (err) {
      setCreateFolderError(err instanceof Error ? err.message : '创建失败')
    }
    finally {
      setCreatingFolder(false)
    }
  }

  const handleRenameFolder = async (folderId: string) => {
    const trimmed = editingFolderName.trim()
    if (!trimmed) {
      setEditingFolderId(null)
      return
    }

    const current = folders.find(folder => folder.id === folderId)
    if (current?.name === trimmed) {
      setEditingFolderId(null)
      return
    }

    try {
      const response = await fetch(`/api/asset-folders/${folderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '重命名失败')

      setEditingFolderId(null)
      bumpRefresh()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '重命名失败')
    }
  }

  const handleDeleteFolder = async (folderId: string) => {
    setDeletingFolderId(folderId)
    try {
      const response = await fetch(`/api/asset-folders/${folderId}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '删除失败')

      if (selectedFolderId === folderId)
        setSelectedFolderId('all')
      bumpRefresh()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '删除失败')
    }
    finally {
      setDeletingFolderId(null)
    }
  }

  const moveAssetToFolder = async (assetId: string, folderId: string | null) => {
    const asset = uploads.find(item => item.id === assetId)
    if (asset?.folderId === folderId)
      return

    setMovingAssetId(assetId)
    setError(null)
    try {
      const response = await fetch(`/api/uploads/${assetId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderId }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '移动失败')

      bumpRefresh()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '移动失败')
    }
    finally {
      setMovingAssetId(null)
      setDropTargetFolderId(null)
    }
  }

  const handleFolderDragOver = (event: React.DragEvent, folderFilter: AssetFolderFilter) => {
    if (getMoveFolderId(folderFilter) === undefined)
      return
    if (!hasAssetDrag(event.dataTransfer))
      return

    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetFolderId(folderFilter)
  }

  const handleFolderDrop = (event: React.DragEvent, folderFilter: AssetFolderFilter) => {
    event.preventDefault()
    setDropTargetFolderId(null)

    const targetFolderId = getMoveFolderId(folderFilter)
    if (targetFolderId === undefined)
      return

    const payload = readAssetDragData(event.dataTransfer)
    if (!payload?.id)
      return

    void moveAssetToFolder(payload.id, targetFolderId)
  }

  const folderFiltered = uploads.filter(item => matchesFolderFilter(item, selectedFolderId))
  const filtered = folderFiltered.filter(item => item.kind === activeTab)
  const selectedAsset = selectedAssetId
    ? uploads.find(item => item.id === selectedAssetId) ?? null
    : null

  const folderOptions: Array<{ id: AssetFolderFilter; label: string; count: number }> = [
    { id: 'all', label: '全部', count: uploads.length },
    { id: 'uncategorized', label: '未分类', count: uncategorizedCount },
    ...folders.map(folder => ({
      id: folder.id,
      label: folder.name,
      count: folder.assetCount,
    })),
  ]

  const currentFolderLabel = folderOptions.find(option => option.id === selectedFolderId)?.label ?? '全部'

  return (
    <>
      <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
        <div className="border-b border-border-subtle px-3 py-3">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-foreground">资产库</h2>
              <p className="text-[10px] text-muted">拖拽资产到文件夹 · 点击查看详情</p>
            </div>
            <div className="flex items-center gap-0.5">
              <button
                type="button"
                onClick={() => fetchLibrary()}
                disabled={loading}
                className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
                aria-label="刷新"
              >
                <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
              </button>
              <button
                type="button"
                onClick={() => setAssetLibraryOpen(false)}
                className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
                aria-label="收起资产库"
              >
                <PanelLeftClose className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="mt-3 space-y-1">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[10px] font-medium uppercase tracking-wide text-muted">文件夹</span>
              <button
                type="button"
                onClick={() => {
                  setCreateFolderError(null)
                  setCreateFolderOpen(true)
                }}
                className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium text-primary-light hover:bg-primary/10"
              >
                <Plus className="h-3 w-3" />
                新建
              </button>
            </div>

            <div className="max-h-28 space-y-0.5 overflow-y-auto pr-0.5">
              {folderOptions.map(option => {
                const isActive = selectedFolderId === option.id
                const isCustomFolder = option.id !== 'all' && option.id !== 'uncategorized'
                const isEditing = isCustomFolder && editingFolderId === option.id

                return (
                  <div
                    key={option.id}
                    onDragOver={event => handleFolderDragOver(event, option.id)}
                    onDragLeave={() => {
                      if (dropTargetFolderId === option.id)
                        setDropTargetFolderId(null)
                    }}
                    onDrop={event => handleFolderDrop(event, option.id)}
                    className={cn(
                      'group flex items-center gap-1 rounded-md border px-1.5 py-1 transition',
                      isActive
                        ? 'border-primary-light bg-primary/10'
                        : 'border-transparent hover:border-border hover:bg-surface-muted',
                      dropTargetFolderId === option.id && getMoveFolderId(option.id) !== undefined
                        && 'border-primary-light bg-primary/15 ring-1 ring-primary-light/40',
                      option.id === 'all' && 'cursor-default',
                    )}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedFolderId(option.id)
                        setSelectedAssetId(null)
                      }}
                      className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    >
                      {isActive
                        ? <FolderOpen className="h-3.5 w-3.5 shrink-0 text-primary-light" />
                        : <Folder className="h-3.5 w-3.5 shrink-0 text-muted" />}
                      {isEditing
                        ? (
                            <input
                              value={editingFolderName}
                              onChange={event => setEditingFolderName(event.target.value)}
                              onBlur={() => handleRenameFolder(option.id)}
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  void handleRenameFolder(option.id)
                                }
                                if (event.key === 'Escape')
                                  setEditingFolderId(null)
                              }}
                              className="min-w-0 flex-1 rounded border border-border bg-input px-1 py-0.5 text-[11px] text-foreground outline-none focus:border-primary-light"
                              autoFocus
                              onClick={event => event.stopPropagation()}
                            />
                          )
                        : (
                            <span className={cn(
                              'min-w-0 flex-1 truncate text-[11px]',
                              isActive ? 'font-medium text-primary-light' : 'text-foreground',
                            )}
                            >
                              {option.label}
                            </span>
                          )}
                    </button>

                    {isCustomFolder && !isEditing && (
                      <div className="flex shrink-0 items-center opacity-0 transition group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingFolderId(option.id)
                            setEditingFolderName(option.label)
                          }}
                          className="rounded p-0.5 text-muted hover:bg-surface hover:text-foreground"
                          aria-label={`重命名 ${option.label}`}
                        >
                          <Pencil className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          disabled={deletingFolderId === option.id}
                          onClick={() => void handleDeleteFolder(option.id)}
                          className="rounded p-0.5 text-muted hover:bg-surface hover:text-red-500 disabled:opacity-50"
                          aria-label={`删除 ${option.label}`}
                        >
                          {deletingFolderId === option.id
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Trash2 className="h-3 w-3" />}
                        </button>
                      </div>
                    )}

                    {!isEditing && (
                      <span className="shrink-0 tabular-nums text-[10px] text-muted">{option.count}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="mt-2 flex gap-1">
            {TAB_OPTIONS.map(tab => {
              const Icon = tab.icon
              const count = folderFiltered.filter(u => u.kind === tab.kind).length
              return (
                <button
                  key={tab.kind}
                  type="button"
                  onClick={() => {
                    setActiveTab(tab.kind)
                    setSelectedAssetId(null)
                  }}
                  className={cn(
                    'inline-flex flex-1 items-center justify-center gap-1 rounded-md border px-2 py-1.5 text-[11px] font-medium transition',
                    activeTab === tab.kind
                      ? 'border-primary-light bg-primary/10 text-primary-light'
                      : 'border-border bg-input text-secondary hover:bg-surface-muted',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                  <span className="text-[10px] text-muted">{count}</span>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 border-b border-border-subtle px-3 py-2">
          <span className="truncate text-xs text-muted">
            {currentFolderLabel} · {filtered.length} 项
          </span>
          <button
            type="button"
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
          >
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            上传
          </button>
          <input
            ref={fileRef}
            type="file"
            multiple
            accept={ACCEPT_BY_KIND[activeTab]}
            className="hidden"
            onChange={e => {
              handleUpload(e.target.files)
              e.target.value = ''
            }}
          />
        </div>

        <div className="min-h-0 flex-1 overflow-hidden">
          {selectedAsset && selectedAsset.kind === activeTab
            ? (
                <AssetDetailPanel
                  item={selectedAsset}
                  kindLabel={TAB_OPTIONS.find(t => t.kind === selectedAsset.kind)?.label ?? '素材'}
                  formattedSize={formatBytes(selectedAsset.size)}
                  formattedTime={formatTime(selectedAsset.createdAt)}
                  folders={folders}
                  movingFolder={movingAssetId === selectedAsset.id}
                  disabled={false}
                  onBack={() => setSelectedAssetId(null)}
                  onAddToWorkflow={() => addAssetToCanvas(selectedAsset)}
                  onMoveToFolder={folderId => void moveAssetToFolder(selectedAsset.id, folderId)}
                />
              )
            : (
                <div className="h-full overflow-y-auto p-2">
                  {loading
                    ? (
                        <div className="flex items-center justify-center py-12 text-sm text-muted">
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          加载中…
                        </div>
                      )
                    : error
                      ? (
                          <p className="px-2 py-8 text-center text-xs text-red-500">{error}</p>
                        )
                      : filtered.length === 0
                        ? (
                            <p className="px-2 py-8 text-center text-xs text-muted">
                              {selectedFolderId === 'uncategorized'
                                ? `暂无未分类${TAB_OPTIONS.find(t => t.kind === activeTab)?.label}`
                                : `暂无${TAB_OPTIONS.find(t => t.kind === activeTab)?.label}，点击上传添加`}
                            </p>
                          )
                        : (
                            <ul className="space-y-1.5">
                              {filtered.map(item => (
                                <li key={item.id}>
                                  <div
                                    draggable
                                    onDragStart={e => {
                                      setAssetDragData(e.dataTransfer, {
                                        id: item.id,
                                        kind: item.kind,
                                        url: item.url,
                                        filename: item.filename,
                                      })
                                      setDraggingAssetKind(item.kind)
                                    }}
                                    onDragEnd={() => {
                                      setDraggingAssetKind(null)
                                      setDropTargetFolderId(null)
                                    }}
                                    className={cn(
                                      'group flex w-full cursor-grab gap-2 rounded-lg border border-transparent p-2 transition active:cursor-grabbing hover:border-border hover:bg-surface-muted',
                                    )}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => setSelectedAssetId(item.id)}
                                      className="flex min-w-0 flex-1 gap-2 text-left"
                                    >
                                      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-md border border-border bg-surface-muted">
                                        {item.kind === 'image'
                                          ? (
                                              <img
                                                src={item.url}
                                                alt=""
                                                className="h-full w-full object-cover"
                                                draggable={false}
                                              />
                                            )
                                          : item.kind === 'video'
                                            ? (
                                                <video
                                                  src={item.url}
                                                  muted
                                                  playsInline
                                                  preload="metadata"
                                                  className="h-full w-full object-cover"
                                                  draggable={false}
                                                />
                                              )
                                            : (
                                                <div className="flex h-full w-full items-center justify-center">
                                                  <Music className="h-5 w-5 text-muted" />
                                                </div>
                                              )}
                                      </div>
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-xs font-medium text-foreground group-hover:text-primary-light">
                                          {item.filename}
                                        </p>
                                        <p className="text-[10px] text-muted">
                                          {formatBytes(item.size)} · {formatTime(item.createdAt)}
                                        </p>
                                        <p className="mt-0.5 text-[10px] text-muted/80">点击查看详情</p>
                                      </div>
                                    </button>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                </div>
              )}
        </div>
      </aside>

      <CreateAssetFolderDialog
        open={createFolderOpen}
        creating={creatingFolder}
        error={createFolderError}
        onClose={() => {
          if (!creatingFolder)
            setCreateFolderOpen(false)
        }}
        onSubmit={name => void handleCreateFolder(name)}
      />
    </>
  )
}
