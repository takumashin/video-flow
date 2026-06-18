'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
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
import { localizeSeedanceErrorMessage } from '@/lib/seedance-error-messages'
import { computeFakeSeedanceProgress, SEEDANCE_POLL_INTERVAL_MS } from '@/lib/seedance-progress'
import { useFakeSeedanceProgress } from '@/lib/use-fake-seedance-progress'
import { TaskProgressBar } from '@/components/canvas/node-fields'
import VideoDownloadLink from '@/components/video-download-link'
import type { LocalTaskQueueItem } from '@/store/task-queue-store'
import type { SeedanceTaskListItem, SeedanceTaskStatus } from '@/lib/types'
import { useTaskQueueStore } from '@/store/task-queue-store'
import { useWorkflowStore } from '@/store/workflow-store'
import { notifyCreditsChanged } from '@/lib/credits/client-events'

const IN_PROGRESS_TASK_STATUSES: SeedanceTaskStatus[] = [
  'waiting',
  'submitting',
  'queued',
  'running',
]

const STATUS_FILTERS: Array<{ value: SeedanceTaskStatus | 'all'; label: string }> = [
  { value: 'all', label: '全部' },
  { value: 'waiting', label: '系统排队' },
  { value: 'queued', label: 'Seedance 排队' },
  { value: 'running', label: '生成中' },
  { value: 'succeeded', label: '已完成' },
  { value: 'failed', label: '失败' },
  { value: 'cancelled', label: '已取消' },
]

const STATUS_META: Record<SeedanceTaskStatus, { label: string; className: string }> = {
  waiting: { label: '系统排队', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  submitting: { label: '提交中', className: 'bg-sky-500/15 text-sky-700 dark:text-sky-300' },
  queued: { label: 'Seedance 排队', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-300' },
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

function StatusBadge({
  status,
  progress,
  queuePosition,
}: {
  status: SeedanceTaskStatus
  progress?: number
  queuePosition?: number
}) {
  const meta = STATUS_META[status]
  const progressValue = progress != null ? Math.min(100, Math.max(0, progress)) : null

  let label = meta.label
  if (status === 'waiting' && queuePosition != null)
    label = `${meta.label} #${queuePosition}`
  else if ((status === 'queued' || status === 'running') && progressValue != null)
    label = `${meta.label} ${progressValue}%`

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

function resolveTaskStartedAtMs(task: SeedanceTaskListItem, local?: LocalTaskQueueItem) {
  if (local?.progressStartedAt)
    return local.progressStartedAt
  if (local?.createdAt)
    return local.createdAt
  if (task.progressStartedAt)
    return task.progressStartedAt
  if (task.created_at)
    return task.created_at > 1e12 ? task.created_at : task.created_at * 1000
  return undefined
}

function TaskQueueRow({
  task,
  local,
  savingId,
  actionId,
  onSaveToLocal,
  onResume,
  onCancel,
}: {
  task: SeedanceTaskListItem
  local?: LocalTaskQueueItem
  savingId: string | null
  actionId: string | null
  onSaveToLocal: (task: SeedanceTaskListItem) => void
  onResume: (task: SeedanceTaskListItem) => void
  onCancel: (task: SeedanceTaskListItem) => void
}) {
  const startedAtMs = resolveTaskStartedAtMs(task, local)
  const displayProgress = useFakeSeedanceProgress(
    startedAtMs,
    task.status,
    local?.progress ?? task.progress,
  )
  const videoUrl = task.content?.video_url ?? local?.videoUrl
  const isLocal = videoUrl?.startsWith('/api/videos/')
  const prompt = local?.prompt ?? task.prompt
  const nodeTitle = local?.nodeTitle ?? task.nodeTitle
  const canCancel = task.status === 'waiting' || task.status === 'submitting' || task.status === 'queued'

  return (
    <li className="px-4 py-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={task.status} progress={displayProgress} queuePosition={task.queuePosition} />
            {nodeTitle && (
              <span className="truncate text-[10px] text-muted">{nodeTitle}</span>
            )}
            {task.model && (
              <span className="truncate text-[10px] text-muted">{task.model}</span>
            )}
          </div>
          {prompt && (
            <p className="mt-1 line-clamp-2 text-[11px] text-secondary">{prompt}</p>
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
          <TaskProgressSection status={task.status} progress={displayProgress} />
          {task.error?.message && (
            <p className="mt-1 break-all text-[10px] text-red-600 dark:text-red-400">
              {localizeSeedanceErrorMessage(task.error.message, task.error.code)}
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
              onClick={() => onSaveToLocal(task)}
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
              已保存本地
            </span>
          )}
        </div>
      )}

      {task.status === 'failed' && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-red-600 dark:text-red-400">
          <XCircle className="h-3 w-3 shrink-0" />
          任务失败
        </div>
      )}

      {(task.status === 'queued' || task.status === 'running') && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={actionId === task.id}
            onClick={() => onResume(task)}
            className="inline-flex items-center gap-1 rounded-md border border-primary-light/30 bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary-light hover:bg-primary/15 disabled:opacity-50"
          >
            {actionId === task.id
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <RefreshCw className="h-3 w-3" />}
            恢复跟踪
          </button>
        </div>
      )}

      {canCancel && (
        <div className="mt-2 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={actionId === task.id}
            onClick={() => onCancel(task)}
            className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-[10px] font-medium text-red-600 hover:bg-red-500/15 disabled:opacity-50 dark:text-red-400"
          >
            {actionId === task.id
              ? <Loader2 className="h-3 w-3 animate-spin" />
              : <X className="h-3 w-3" />}
            取消任务
          </button>
        </div>
      )}

      {(task.status === 'queued' || task.status === 'running') && displayProgress == null && (
        <div className="mt-2 flex items-center gap-1.5 text-[10px] text-primary-light">
          <Loader2 className="h-3 w-3 animate-spin" />
          生成进行中，正在同步进度…
        </div>
      )}
    </li>
  )
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
  const resumeTaskFromQueue = useWorkflowStore(s => s.resumeTaskFromQueue)
  const cancelSeedanceTask = useWorkflowStore(s => s.cancelSeedanceTask)
  const syncSeedanceTaskStatusToWorkflow = useWorkflowStore(s => s.syncSeedanceTaskStatusToWorkflow)

  const [items, setItems] = useState<SeedanceTaskListItem[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionId, setActionId] = useState<string | null>(null)
  const itemsRef = useRef(items)
  itemsRef.current = items

  const activeTaskIds = items
    .filter(item => IN_PROGRESS_TASK_STATUSES.includes(item.status))
    .map(item => item.id)
    .join(',')

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
          prompt: item.prompt,
          nodeTitle: item.nodeTitle,
          workflowId: item.workflowId,
          nodeId: item.nodeId,
          status: item.status,
          progress: item.progress,
          videoUrl: item.content?.video_url,
          createdAt: item.created_at ? (item.created_at > 1e12 ? item.created_at : item.created_at * 1000) : Date.now(),
          progressStartedAt: item.progressStartedAt,
        })

        if (item.status === 'failed' || item.status === 'cancelled' || item.status === 'succeeded') {
          syncSeedanceTaskStatusToWorkflow({
            taskId: item.id,
            status: item.status,
            nodeId: item.nodeId,
            workflowId: item.workflowId,
            error: item.error?.message,
            errorCode: item.error?.code,
            progress: item.progress,
            videoUrl: item.content?.video_url,
            queuePosition: item.queuePosition,
            progressStartedAt: item.progressStartedAt,
          })
        }
      }
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '加载失败')
    }
    finally {
      setLoading(false)
    }
  }, [pageNum, pageSize, statusFilter, upsertLocalTask, syncSeedanceTaskStatusToWorkflow])

  useEffect(() => {
    if (!open)
      return
    fetchTasks()
  }, [open, fetchTasks])

  useEffect(() => {
    if (!open || !activeTaskIds)
      return

    let cancelled = false

    const pollActiveProgress = async () => {
      const active = itemsRef.current.filter(item => IN_PROGRESS_TASK_STATUSES.includes(item.status))
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

          const local = useTaskQueueStore.getState().localTasks.find(t => t.taskId === task.id)
          const startedAtMs = resolveTaskStartedAtMs(task, local) ?? Date.now()
          const fakeProgress = computeFakeSeedanceProgress(startedAtMs, data.status)

          upsertLocalTask({
            id: task.id,
            taskId: task.id,
            prompt: task.prompt ?? local?.prompt,
            nodeTitle: task.nodeTitle ?? local?.nodeTitle,
            workflowId: task.workflowId ?? local?.workflowId,
            nodeId: task.nodeId ?? local?.nodeId,
            status: data.status,
            progress: fakeProgress,
            videoUrl: data.videoUrl,
            createdAt: startedAtMs,
            progressStartedAt: startedAtMs,
          })

          setItems(prev => prev.map(item =>
            item.id === task.id
              ? {
                  ...item,
                  status: data.status,
                  content: data.videoUrl
                    ? { ...item.content, video_url: data.videoUrl }
                    : item.content,
                  error: data.error
                    ? { message: data.error, code: data.errorCode }
                    : item.error,
                  updated_at: data.updatedAt ?? item.updated_at,
                }
              : item,
          ))

          syncSeedanceTaskStatusToWorkflow({
            taskId: task.id,
            status: data.status,
            nodeId: task.nodeId ?? local?.nodeId,
            workflowId: task.workflowId ?? local?.workflowId,
            error: data.error,
            errorCode: data.errorCode,
            progress: fakeProgress,
            videoUrl: data.videoUrl,
            queuePosition: data.queuePosition,
            progressStartedAt: startedAtMs,
          })

          if (data.status === 'failed')
            notifyCreditsChanged()
        }
        catch {
          // 单次轮询失败不影响其他任务
        }
      }
    }

    pollActiveProgress()
    const timer = window.setInterval(pollActiveProgress, SEEDANCE_POLL_INTERVAL_MS)
    return () => {
      cancelled = true
      window.clearInterval(timer)
    }
  }, [open, activeTaskIds, upsertLocalTask, syncSeedanceTaskStatusToWorkflow])

  const resumeTask = async (task: SeedanceTaskListItem) => {
    setActionId(task.id)
    setError(null)
    try {
      await resumeTaskFromQueue(task)
      closePanel()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '恢复任务失败')
    }
    finally {
      setActionId(null)
    }
  }

  const cancelTask = async (task: SeedanceTaskListItem) => {
    setActionId(task.id)
    setError(null)
    try {
      await cancelSeedanceTask(task.id)
      await fetchTasks()
    }
    catch (err) {
      setError(err instanceof Error ? err.message : '取消任务失败')
    }
    finally {
      setActionId(null)
    }
  }

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
              已执行 {localTasks.length} 个任务
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
                    {items.map(task => (
                      <TaskQueueRow
                        key={task.id}
                        task={task}
                        local={localTasks.find(t => t.taskId === task.id)}
                        savingId={savingId}
                        actionId={actionId}
                        onSaveToLocal={saveToLocal}
                        onResume={resumeTask}
                        onCancel={cancelTask}
                      />
                    ))}
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
