'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useReactFlow } from 'reactflow'
import {
  ImageIcon,
  Loader2,
  Music,
  PanelLeftClose,
  Plus,
  RefreshCw,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { setAssetDragData } from '@/lib/asset-drag'
import type { UploadAssetKind } from '@/lib/uploads'
import {
  AUDIO_ACCEPT,
  IMAGE_ACCEPT,
  VIDEO_ACCEPT,
} from '@/lib/media-upload-shared'
import { processImageFiles } from '@/lib/image-upload'
import { processAudioFiles, processVideoFiles } from '@/lib/media-upload'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useAssetLibraryStore } from '@/store/asset-library-store'
import { useWorkflowStore } from '@/store/workflow-store'

type UploadListItem = {
  id: string
  url: string
  kind: UploadAssetKind
  filename: string
  size: number
  createdAt: number
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

export default function AssetLibrarySidebar() {
  const [activeTab, setActiveTab] = useState<UploadAssetKind>('image')
  const [uploads, setUploads] = useState<UploadListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const refreshKey = useAssetLibraryStore(s => s.refreshKey)
  const bumpRefresh = useAssetLibraryStore(s => s.bumpRefresh)
  const setAssetLibraryOpen = useAssetLibraryStore(s => s.setOpen)
  const setDraggingAssetKind = useAssetLibraryStore(s => s.setDraggingAssetKind)
  const isRunning = useActiveWorkflowSession()?.isRunning ?? false
  const addImageNode = useWorkflowStore(s => s.addImageNode)
  const addVideoNode = useWorkflowStore(s => s.addVideoNode)
  const addAudioNode = useWorkflowStore(s => s.addAudioNode)
  const addLog = useWorkflowStore(s => s.addLog)
  const { getViewport } = useReactFlow()

  const fetchUploads = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/uploads')
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '加载失败')
      setUploads(data.uploads ?? [])
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
    finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUploads()
  }, [fetchUploads, refreshKey])

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
    if (isRunning)
      return

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
      message: `已从资产库添加${TAB_OPTIONS.find(t => t.kind === item.kind)?.label ?? '素材'}`,
      level: 'success',
    })
  }

  const handleUpload = async (files: FileList | null) => {
    if (!files?.length || isRunning)
      return

    setUploading(true)
    setError(null)
    try {
      if (activeTab === 'image') {
        const urls = await processImageFiles(Array.from(files))
        urls.forEach(url => addImageNode(url, getCanvasCenterPosition()))
      }
      else if (activeTab === 'video') {
        const urls = await processVideoFiles(Array.from(files))
        urls.forEach(url => addVideoNode(url, getCanvasCenterPosition()))
      }
      else {
        const urls = await processAudioFiles(Array.from(files))
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

  const filtered = uploads.filter(item => item.kind === activeTab)

  return (
    <aside className="flex h-full w-72 shrink-0 flex-col border-r border-border bg-surface">
      <div className="border-b border-border-subtle px-3 py-3">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-foreground">资产库</h2>
            <p className="text-[10px] text-muted">拖拽或点击添加到画布</p>
          </div>
          <div className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => fetchUploads()}
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

        <div className="mt-2 flex gap-1">
          {TAB_OPTIONS.map(tab => {
            const Icon = tab.icon
            const count = uploads.filter(u => u.kind === tab.kind).length
            return (
              <button
                key={tab.kind}
                type="button"
                onClick={() => setActiveTab(tab.kind)}
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
        <span className="text-xs text-muted">{filtered.length} 项</span>
        <button
          type="button"
          disabled={isRunning || uploading}
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

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
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
                    暂无{TAB_OPTIONS.find(t => t.kind === activeTab)?.label}，点击上传添加
                  </p>
                )
              : (
                  <ul className="space-y-1.5">
                    {filtered.map(item => (
                      <li key={item.id}>
                        <div
                          draggable={!isRunning}
                          onDragStart={e => {
                            setAssetDragData(e.dataTransfer, {
                              kind: item.kind,
                              url: item.url,
                              filename: item.filename,
                            })
                            setDraggingAssetKind(item.kind)
                          }}
                          onDragEnd={() => setDraggingAssetKind(null)}
                          className={cn(
                            'group flex w-full gap-2 rounded-lg border border-transparent p-2 transition',
                            !isRunning && 'cursor-grab active:cursor-grabbing hover:border-border hover:bg-surface-muted',
                            isRunning && 'opacity-50',
                          )}
                        >
                          <button
                            type="button"
                            disabled={isRunning}
                            onClick={() => addAssetToCanvas(item)}
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
                              <p className="mt-0.5 text-[10px] text-muted/80">拖拽或点击添加</p>
                            </div>
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
      </div>
    </aside>
  )
}
