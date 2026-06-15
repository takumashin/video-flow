'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  Loader2,
  RefreshCw,
  X,
  XCircle,
  ListOrdered,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { TaskProgressBar } from '@/components/canvas/node-fields'
import VideoDownloadLink from '@/components/video-download-link'
import type { SeedanceTaskListItem, SeedanceTaskStatus } from '@/lib/types'
import { useTaskQueueStore } from '@/store/task-queue-store'

const STATUS_FILTERS: Array<{ value: SeedanceTaskStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'queued', label: '排队中' },
  { value: 'running', label: '生成中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

const STATUS_META: Record<SeedanceTaskStatus, { label: string; className: string }> = {
  queued: { label: '排队中', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
  running: { label: '生成中', className: 'bg-primary/15 text-primary-light' },
  succeeded: { label: '已完成', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' },
  failed: { label: '失败', className: 'bg-red-500/15 text-red-600 dark:text-red-400' },
  cancelled: { label: '已取消', className: 'bg-surface-muted text-muted' },
}

function formatTaskTime(ts?: number) {
  if (!ts)
    return '—'
  const ms = ts > 1e12 ? ts : ts * 1000
  return new Date(ms).toLocaleString()
}

function StatusBadge({ status, progress }: { status: SeedanceTaskStatus; progress?: number }) {
  const meta = STATUS_META[status]
  const progressValue = progress != null ? Math.min(100, Math.max(0, progress)) : null

  const label = (status === 'queued' || status === 'running') && progressValue != null
    ? `${meta.label} ${progressValue}%`
    : meta.label

  return (
    <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium', meta.className)}>
      {label}
    </span>
  )
}

function TaskProgressSection({ status, progress }: { status: SeedanceTaskStatus; progress?: number }) {
  const progressValue = progress != null ? Math.min(100, Math.max(0, progress)) : null
  if (progressValue == null)
    return null

  if (status === 'queued' || status === 'running')
    return <TaskProgressBar progress={progressValue} className="mt-2" />

  if (status === 'succeeded' && progressValue === 100)
    return <TaskProgressBar progress={100} className="mt-2" />

  return null
}

export default function TaskQueuePanel() {
  const open = useTaskQueueStore(s => s.open)
  const closePanel = useTaskQueueStore(s => s.closePanel)
  const statusFilter = useTaskQueueStore(s => s.statusFilter)
  const setStatusFilter = useTaskQueueStore(s => s.setStatusFilter)
  const pageNum = useTaskQueueStore(s => s.pageNum)
  const setPageNum = useTaskQueueStore(s => s.setPageNum)
  const pageSize = useTaskQueueStore(s => s.pageSize)
  const localTasks = useTaskQueueStore(s => s.localTasks)
  const upsertLocalTask = useTaskQueueStore(s => s.upsertLocalTask)

  const [items, setItems] = useState<SeedanceTaskListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const fetchTasks = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page_num: String(pageNum),
        page_size: String(pageSize),
      })
      if (statusFilter !== 'all')
        params.set('filter.status', statusFilter)

      const response = await fetch(`/api/seedance/tasks?${params.toString()}`)
      const data = await response.json()

      if (!response.ok)
        throw new Error(data.error || '加载任务列表失败')

      setItems(data.items ?? [])
      setTotal(data.total ?? 0)

      for (const item of data.items ?? []) {
        upsertLocalTask({
          id: item.id,
          taskId: item.id,
          status: item.status,
          videoUrl: item.content?.video_url,
          createdAt: item.created_at ? (item.created_at > 1e12 ? item.created_at : item.created_at * 1000) : Date.now(),
        })
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
    finally {
      setLoading(false)
    }
  }, [pageNum, pageSize, statusFilter, upsertLocalTask])

  useEffect(() => {
    if (!open)
      return
    fetchTasks()
  }, [open, fetchTasks])

  useEffect(() => {
    if (!open)
      return

    const hasActive = items.some(item => item.status === 'queued' || item.status === 'running')
    if (!hasActive)
      return

    const timer = window.setInterval(fetchTasks, 10000)
    return () => window.clearInterval(timer)
  }, [open, items, fetchTasks])

  useEffect(() => {
    if (!open)
      return

    let cancelled = false

    const pollActiveProgress = async () => {
      const active = items.filter(item => item.status === 'queued' || item.status === 'running')
      if (!active.length)
        return

      for (const task of active) {
        if (cancelled)
          break

        try {
          const response = await fetch(`/api/seedance/tasks/${task.id}`, { cache: 'no-store' })
          const data = await response.json()
          if (!response.ok)
            continue

          upsertLocalTask({
            id: task.id,
            taskId: task.id,
            status: data.status,
            progress: typeof data.progress === 'number' ? data.progress : undefined,
            videoUrl: data.videoUrl,
            createdAt: task.created_at
              ? (task.created_at > 1e12 ? task.created_at : task.created_at * 1000)
              : Date.now(),
          })

          setItems(prev => prev.map(item =>
            item.id === task.id
              ? {
                  ...item,
                  status: data.status,
                  progress: typeof data.progress === 'number' ? data.progress : item.progress,
                  content: data.videoUrl
                    ? { ...item.content, video_url: data.videoUrl }
                    : item.content,
                  updated_at: data.updatedAt ?? item.updated_at,
                }
              : item,
          ))
        }
        catch {
          // 单次轮询失败不影响其他任务
        }
      }
    }

    pollActiveProgress()
    const timer = window.setInterval(pollActiveProgress, 5000)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [open, items, upsertLocalTask])

  const saveToLocal = async (task: SeedanceTaskListItem) => {
    const sourceUrl = task.content?.video_url
    if (!sourceUrl)
      return

    setSavingId(task.id)
    try {
      const response = await fetch('/api/videos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl }),
      })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '保存失败')

      upsertLocalTask({
        id: task.id,
        taskId: task.id,
        status: task.status,
        videoUrl: data.videoUrl,
        createdAt: task.created_at ? (task.created_at > 1e12 ? task.created_at : task.created_at * 1000) : Date.now(),
      })
      await fetchTasks()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '保存失败')
    }
    finally {
      setSavingId(null)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  if (!open)
    return null

  return (
    <div className="fixed inset-0 z-[110] flex justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-overlay"
        aria-label="关闭任务队列"
        onClick={closePanel}
      />

      <aside
        className="relative flex h-full w-full max-w-md flex-col border-l border-border bg-surface shadow-2xl"
        onPointerDown={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <ListOrdered className="h-4 w-4 text-primary-light" />
            <div>
              <h2 className="text-sm font-semibold text-foreground">视频生成任务队列</h2>
              <p className="text-[10px] text-muted">火山方舟 · 查询任务列表 API</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={fetchTasks}
              disabled={loading}
              className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground disabled:opacity-50"
              aria-label="刷新"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
            <button
              type="button"
              onClick={closePanel}
              className="rounded-md p-1.5 text-muted hover:bg-surface-muted hover:text-foreground"
              aria-label="关闭"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-border-subtle px-4 py-2">
          {STATUS_FILTERS.map(filter => (
            <button
              key={filter.value}
              type="button"
              onClick={() => setStatusFilter(filter.value)}
              className={cn(
                'rounded-md px-2 py-1 text-[11px] font-medium transition',
                statusFilter === filter.value
                  ? 'bg-primary/10 text-primary-light ring-1 ring-primary-light/25'
                  : 'text-muted hover:bg-surface-muted hover:text-foreground',
              )}
            >
              {filter.label}
            </button>
          ))}
        </div>

        {localTasks.length > 0 && (
          <div className="border-b border-border-subtle bg-surface-muted/50 px-4 py-2">
            <p className="text-[10px] text-muted">
              本机已记录 {localTasks.length} 个任务（运行工作流时自动加入）
            </p>
          </div>
        )}

        {error && (
          <div className="border-b border-red-500/20 bg-red-500/10 px-4 py-2 text-xs text-red-600 dark:text-red-400">
            {error}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto">
          {loading && items.length === 0
            ? (
                <div className="flex items-center justify-center gap-2 py-12 text-sm text-muted">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  加载中...
                </div>
              )
            : items.length === 0
              ? (
                  <div className="flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
                    <Clock3 className="h-8 w-8 opacity-40" />
                    <p>暂无任务</p>
                  </div>
                )
              : (
                  <ul className="divide-y divide-border-subtle">
                    {items.map(task => {
                      const local = localTasks.find(t => t.taskId === task.id)
                      const mergedProgress = local?.progress ?? task.progress
                      const videoUrl = task.content?.video_url ?? local?.videoUrl
                      const isLocal = videoUrl?.startsWith('/api/videos/')
                      return (
                        <li key={task.id} className="px-4 py-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <StatusBadge status={task.status} progress={mergedProgress} />
                                {local?.nodeTitle && (
                                  <span className="truncate text-[10px] text-muted">{local.nodeTitle}</span>
                                )}
                                {task.model && (
                                  <span className="truncate text-[10px] text-muted">{task.model}</span>
                                )}
                              </div>
                              {local?.prompt && (
                                <p className="mt-1 line-clamp-2 text-[11px] text-secondary">{local.prompt}</p>
                              )}
                              <p className="mt-1 break-all font-mono text-[10px] text-secondary">
                                {task.id}
                              </p>
                              <p className="mt-1 text-[10px] text-muted">
                                创建 {formatTaskTime(task.created_at)}
                                {task.updated_at && task.updated_at !== task.created_at
                                  ? ` · 更新 ${formatTaskTime(task.updated_at)}`
                                  : ''}
                              </p>
                              <TaskProgressSection status={task.status} progress={mergedProgress} />
                              {task.error?.message && (
                                <p className="mt-1 text-[10px] text-red-600 dark:text-red-400">
                                  {task.error.message}
                                </p>
                              )}
                            </div>
                          </div>

                          {task.status === 'succeeded' && videoUrl && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              <a
                                href={videoUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-secondary hover:bg-surface-muted"
                              >
                                <ExternalLink className="h-3 w-3" />
                                {isLocal ? '本地预览' : '打开视频'}
                              </a>
                              <VideoDownloadLink
                                videoUrl={videoUrl}
                                taskId={task.id}
                                className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[10px] font-medium text-secondary hover:bg-surface-muted"
                                iconClassName="h-3 w-3"
                                label="下载 MP4"
                              />
                              {!isLocal && (
                                <button
                                  type="button"
                                  disabled={savingId === task.id}
                                  onClick={() => saveToLocal(task)}
                                  className="inline-flex items-center gap-1 rounded-md border border-primary-light/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary-light hover:bg-primary/15 disabled:opacity-50"
                                >
                                  {savingId === task.id
                                    ? <Loader2 className="h-3 w-3 animate-spin" />
                                    : <Download className="h-3 w-3" />}
                                  保存到本地
                                </button>
                              )}
                              {isLocal && (
                                <span className="inline-flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400">
                                  <CheckCircle2 className="h-3 w-3" />
                                  已存本地
                                </span>
                              )}
                            </div>
                          )}

                          {(task.status === 'queued' || task.status === 'running') && mergedProgress == null && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary-light">
                              <Loader2 className="h-3 w-3 animate-spin" />
                              生成进行中，正在同步进度…
                            </div>
                          )}

                          {task.status === 'failed' && (
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400">
                              <XCircle className="h-3 w-3" />
                              任务失败
                            </div>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                )}
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-border px-4 py-3">
          <p className="text-[11px] text-muted">
            共 {total} 条 · 第 {pageNum}/{totalPages} 页
          </p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={pageNum <= 1 || loading}
              onClick={() => setPageNum(pageNum - 1)}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:bg-surface-muted disabled:opacity-50"
            >
              上一页
            </button>
            <button
              type="button"
              disabled={pageNum >= totalPages || loading}
              onClick={() => setPageNum(pageNum + 1)}
              className="rounded-md border border-border px-2 py-1 text-[11px] text-secondary hover:bg-surface-muted disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </aside>
    </div>
  )
}
