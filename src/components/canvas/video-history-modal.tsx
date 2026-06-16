'use client'

import { useEffect, useState } from 'react'
import { Clock, Film, X } from 'lucide-react'
import VideoDownloadLink from '@/components/video-download-link'
import NodeVideoPlayer from '@/components/canvas/node-video-player'
import { VideoFirstFrameThumb } from '@/components/canvas/video-first-frame-thumb'
import { cn } from '@/lib/cn'
import type { VideoHistoryItem } from '@/lib/types'
import { NodeType } from '@/lib/types'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

export default function VideoHistoryModal() {
  const activeSession = useActiveWorkflowSession()
  const nodeId = activeSession?.videoHistoryModalNodeId
  const nodes = activeSession?.nodes ?? []
  const closeVideoHistoryModal = useWorkflowStore(s => s.closeVideoHistoryModal)
  const node = nodes.find(n => n.id === nodeId)
  const history = node?.data.type === NodeType.Seedance
    ? (node.data.videoHistory ?? [])
    : node?.data.type === NodeType.Output
      ? (node.data.videoHistory ?? [])
      : []
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const selected = history.find(item => item.id === selectedId) ?? history[0]

  useEffect(() => {
    if (history.length > 0)
      setSelectedId(history[0].id)
    else
      setSelectedId(null)
  }, [nodeId, history.length, history[0]?.id])

  useEffect(() => {
    if (!nodeId)
      return
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape')
        closeVideoHistoryModal()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [nodeId, closeVideoHistoryModal])

  if (!nodeId || !node || (node.data.type !== NodeType.Seedance && node.data.type !== NodeType.Output))
    return null

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-history-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={closeVideoHistoryModal}
        aria-label="关闭"
      />
      <div className="relative flex h-[min(720px,90vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-surface shadow-2xl">
        <div className="flex items-center justify-between border-b border-border-subtle px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/15">
              <Film className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            </div>
            <div>
              <h2 id="video-history-title" className="text-base font-semibold text-foreground">
                生成历史
              </h2>
              <p className="text-xs text-muted">
                {node.data.title} · 共 {history.length} 条记录
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeVideoHistoryModal}
            className="rounded-lg p-2 text-muted hover:bg-surface-muted hover:text-foreground"
            aria-label="关闭"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {history.length === 0
          ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <Film className="h-10 w-10 text-muted" />
                <p className="text-sm text-muted">暂无生成记录</p>
                <p className="text-xs text-muted/80">运行工作流后，生成的视频会保存在这里</p>
              </div>
            )
          : (
              <div className="flex min-h-0 flex-1">
                <div className="flex min-w-0 flex-1 flex-col bg-zinc-950">
                  {selected && (
                    <>
                      <div className="flex min-h-0 flex-1 items-center justify-center p-4">
                        <NodeVideoPlayer
                          key={selected.id}
                          src={selected.videoUrl}
                          className="w-full max-w-3xl !min-h-[280px]"
                        />
                      </div>
                      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
                        <div className="min-w-0 text-xs text-zinc-400">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 shrink-0" />
                            {formatTime(selected.createdAt)}
                          </span>
                          {selected.taskId && (
                            <p className="mt-1 truncate text-[11px] text-zinc-500">
                              任务 ID: {selected.taskId}
                            </p>
                          )}
                        </div>
                        <VideoDownloadLink
                          videoUrl={selected.videoUrl}
                          taskId={selected.taskId}
                          createdAt={selected.createdAt}
                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20"
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="flex w-72 shrink-0 flex-col border-l border-border-subtle bg-surface">
                  <div className="border-b border-border-subtle px-4 py-3">
                    <p className="text-xs font-medium text-secondary">历史记录</p>
                    <p className="text-[11px] text-muted">最新生成排在最前</p>
                  </div>
                  <div className="flex-1 overflow-y-auto p-2">
                    {history.map((item, index) => (
                      <HistoryListItem
                        key={item.id}
                        item={item}
                        index={index}
                        selected={item.id === selected?.id}
                        onSelect={() => setSelectedId(item.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
      </div>
    </div>
  )
}

function HistoryListItem({
  item,
  index,
  selected,
  onSelect,
}: {
  item: VideoHistoryItem
  index: number
  selected: boolean
  onSelect: () => void
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'nodrag mb-1.5 flex w-full gap-3 rounded-lg border p-2 text-left transition',
        selected
          ? 'border-primary-light bg-primary/10 ring-1 ring-primary-light/20'
          : 'border-border hover:border-border hover:bg-surface-muted',
      )}
    >
      <VideoFirstFrameThumb
        src={item.videoUrl}
        className="aspect-square h-16 w-16 shrink-0 rounded-lg border border-border"
        showPlayIcon
        badge={(
          <span className="absolute bottom-0.5 right-0.5 rounded bg-black/70 px-1 text-[10px] text-white">
            #{index + 1}
          </span>
        )}
      />
      <div className="min-w-0 flex-1 py-0.5">
        <p className="text-xs font-medium text-foreground">
          {index === 0 ? '最新生成' : `历史 #${index + 1}`}
        </p>
        <p className="mt-0.5 text-[11px] text-muted">{formatTime(item.createdAt)}</p>
        {item.taskId && (
          <p className="mt-1 truncate text-[10px] text-muted/80">{item.taskId}</p>
        )}
      </div>
    </button>
  )
}
