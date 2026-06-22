'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Bookmark,
  Check,
  Cloud,
  Download,
  FolderOpen,
  History,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import { saveWorkflowToServer } from '@/lib/save-workflow-api'
import { rememberLastWorkflow } from '@/lib/workflow-last'
import { btnCompactClass, btnSecondaryClass, dropdownAnchorClass, dropdownClass } from '@/lib/ui-classes'
import { sanitizeNodesForSave } from '@/lib/sanitize-workflow'
import type { SavedWorkflow, WorkflowSummary } from '@/lib/types'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowAutoSaveStore } from '@/store/workflow-auto-save-store'
import { useWorkflowVersionStore } from '@/store/workflow-version-store'
import { useWorkflowStore } from '@/store/workflow-store'

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function AutoSaveIndicator({ compact = false }: { compact?: boolean }) {
  const status = useWorkflowAutoSaveStore(s => s.status)
  const message = useWorkflowAutoSaveStore(s => s.message)
  const lastSavedAt = useWorkflowAutoSaveStore(s => s.lastSavedAt)

  const label = (() => {
    switch (status) {
      case 'pending':
        return '待保存…'
      case 'saving':
        return '保存中…'
      case 'saved':
        return lastSavedAt ? `已保存 ${formatTime(lastSavedAt)}` : '已保存'
      case 'error':
        return message ?? '保存失败'
      default:
        return '自动保存'
    }
  })()

  const icon = (() => {
    switch (status) {
      case 'pending':
      case 'saving':
        return <Loader2 className="h-3.5 w-3.5 animate-spin" />
      case 'saved':
        return <Check className="h-3.5 w-3.5" />
      case 'error':
        return <Cloud className="h-3.5 w-3.5" />
      default:
        return <Cloud className="h-3.5 w-3.5" />
    }
  })()

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-lg border font-medium',
        compact ? 'px-2 py-1 text-[11px]' : 'px-2.5 py-1.5 text-xs',
        status === 'error'
          ? 'border-red-500/30 bg-red-500/10 text-red-500'
          : 'border-border bg-input text-muted',
      )}
      title={message ?? undefined}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </span>
  )
}

export default function WorkflowManager({
  compact = false,
  menuPlacement = 'below',
}: {
  compact?: boolean
  menuPlacement?: 'above' | 'below'
}) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [listLoading, setListLoading] = useState(false)
  const [workflows, setWorkflows] = useState<WorkflowSummary[]>([])
  const [message, setMessage] = useState<string | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  const activeSession = useActiveWorkflowSession()
  const sessions = useWorkflowStore(s => s.sessions)
  const isRunning = activeSession?.isRunning ?? false
  const workflowId = activeSession?.workflowId ?? null
  const workflowName = activeSession?.name ?? ''
  const nodes = activeSession?.nodes ?? []
  const edges = activeSession?.edges ?? []
  const setWorkflowName = useWorkflowStore(s => s.setWorkflowName)
  const applyWorkflow = useWorkflowStore(s => s.applyWorkflow)
  const newWorkflow = useWorkflowStore(s => s.newWorkflow)
  const addLog = useWorkflowStore(s => s.addLog)
  const openVersionPanel = useWorkflowVersionStore(s => s.openVersionPanel)
  const openSaveDialog = useWorkflowVersionStore(s => s.openSaveDialog)

  const fetchWorkflows = useCallback(async () => {
    setListLoading(true)
    try {
      const response = await fetch('/api/workflows')
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '加载列表失败')
      setWorkflows(data.workflows ?? [])
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : '加载列表失败')
    }
    finally {
      setListLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open)
      fetchWorkflows()
  }, [open, fetchWorkflows])

  useEffect(() => {
    if (!open)
      return

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node))
        setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  const saveWorkflowAsNew = async () => {
    setLoading(true)
    setMessage(null)

    try {
      const result = await saveWorkflowToServer(null, {
        name: workflowName.trim() || '未命名工作流',
        nodes,
        edges,
      })

      applyWorkflow({
        id: result.id,
        name: result.name,
        nodes: result.nodes,
        edges: result.edges,
        revision: result.revision,
      }, { newTab: false })
      addLog({
        nodeId: 'system',
        nodeTitle: '系统',
        message: `工作流「${result.name}」已另存为新副本`,
        level: 'success',
      })
      fetchWorkflows()
    }
    catch (error) {
      const text = error instanceof Error ? error.message : '保存失败'
      setMessage(text)
      addLog({
        nodeId: 'system',
        nodeTitle: '系统',
        message: text,
        level: 'error',
      })
    }
    finally {
      setLoading(false)
    }
  }

  const loadWorkflow = async (id: string) => {
    setLoading(true)
    setMessage(null)

    try {
      const response = await fetch(`/api/workflows/${id}`)
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '加载失败')

      applyWorkflow({
        id: data.id,
        name: data.name,
        nodes: data.nodes,
        edges: data.edges,
        revision: data.revision,
      })

      void rememberLastWorkflow(data.id)

      setMessage(`已打开「${data.name}」`)
      setOpen(false)
      addLog({
        nodeId: 'system',
        nodeTitle: '系统',
        message: `已加载工作流「${data.name}」`,
        level: 'success',
      })
    }
    catch (error) {
      const text = error instanceof Error ? error.message : '加载失败'
      setMessage(text)
    }
    finally {
      setLoading(false)
    }
  }

  const deleteWorkflowItem = async (id: string, name: string) => {
    if (!window.confirm(`确定删除工作流「${name}」？此操作不可恢复。`))
      return

    setLoading(true)
    try {
      const response = await fetch(`/api/workflows/${id}`, { method: 'DELETE' })
      const data = await response.json()
      if (!response.ok)
        throw new Error(data.error || '删除失败')

      if (workflowId === id)
        useWorkflowStore.getState().clearWorkflowSavedId()

      setMessage(`已删除「${name}」`)
      fetchWorkflows()
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : '删除失败')
    }
    finally {
      setLoading(false)
    }
  }

  const exportWorkflow = () => {
    const blob = new Blob(
      [JSON.stringify({
        name: workflowName,
        nodes: sanitizeNodesForSave(nodes),
        edges,
        exportedAt: Date.now(),
      }, null, 2)],
      { type: 'application/json' },
    )
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${workflowName || 'workflow'}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setMessage('已导出到本地文件')
  }

  const importWorkflow = async (file: File) => {
    setLoading(true)
    setMessage(null)
    try {
      const text = await file.text()
      const data = JSON.parse(text) as Partial<SavedWorkflow>
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges))
        throw new Error('文件格式无效')

      applyWorkflow({
        id: null,
        name: data.name || file.name.replace(/\.json$/i, '') || '导入的工作流',
        nodes: data.nodes,
        edges: data.edges,
      })

      setMessage('已从文件导入，将自动保存到服务器')
      setOpen(false)
    }
    catch (error) {
      setMessage(error instanceof Error ? error.message : '导入失败')
    }
    finally {
      setLoading(false)
    }
  }

  return (
    <div ref={panelRef} className="relative flex items-center gap-2">
      <input
        value={workflowName}
        onChange={e => setWorkflowName(e.target.value)}
        disabled={isRunning}
        className="hidden max-w-[180px] rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary-light focus:ring-2 focus:ring-primary-light/20 disabled:opacity-50 md:block"
        placeholder="工作流名称"
      />

      <AutoSaveIndicator compact={compact} />

      <button
        type="button"
        disabled={isRunning}
        onClick={() => setOpen(v => !v)}
        className={cn(
          compact ? btnCompactClass : btnSecondaryClass,
          open && 'border-primary-light bg-primary/10 text-primary-light',
        )}
      >
        <FolderOpen className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        工作流
      </button>

      {open && (
        <div className={cn(dropdownAnchorClass(menuPlacement, 'right'), `w-[360px] ${dropdownClass}`)}>
            <div className="border-b border-border-subtle px-4 py-3">
              <p className="text-sm font-semibold text-foreground">我的工作流</p>
              <p className="text-xs text-muted">修改会自动保存；可打开、导出或另存为副本</p>
            </div>

            <div className="flex flex-wrap gap-2 border-b border-border-subtle px-3 py-2">
              <button
                type="button"
                disabled={isRunning || loading}
                onClick={() => {
                  newWorkflow()
                  setMessage('已创建新工作流')
                }}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                <Plus className="h-3.5 w-3.5" />
                新建
              </button>
              <button
                type="button"
                disabled={isRunning || loading}
                onClick={() => saveWorkflowAsNew()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                <Save className="h-3.5 w-3.5" />
                另存为
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={exportWorkflow}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                <Download className="h-3.5 w-3.5" />
                导出
              </button>
              <button
                type="button"
                disabled={isRunning || loading}
                onClick={() => importRef.current?.click()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                <Upload className="h-3.5 w-3.5" />
                导入
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={e => {
                  const file = e.target.files?.[0]
                  if (file)
                    importWorkflow(file)
                  e.target.value = ''
                }}
              />
              <button
                type="button"
                disabled={isRunning || loading}
                onClick={() => openSaveDialog()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                <Bookmark className="h-3.5 w-3.5" />
                保存版本
              </button>
              <button
                type="button"
                disabled={loading}
                onClick={() => openVersionPanel()}
                className="inline-flex items-center gap-1 rounded-md border border-border px-2.5 py-1.5 text-xs font-medium text-foreground hover:bg-surface-muted disabled:opacity-50"
              >
                <History className="h-3.5 w-3.5" />
                版本历史
              </button>
            </div>

            <div className="max-h-72 overflow-y-auto p-2">
              {listLoading
                ? (
                    <div className="flex items-center justify-center py-8 text-sm text-muted">
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      加载中...
                    </div>
                  )
                : workflows.length === 0
                  ? (
                      <p className="py-8 text-center text-xs text-muted">暂无已保存的工作流</p>
                    )
                  : (
                      workflows.map(item => (
                        <div
                          key={item.id}
                          className={cn(
                            'mb-1 flex items-center gap-2 rounded-lg border px-2 py-2',
                            sessions.some(session => session.workflowId === item.id)
                              ? 'border-primary-light bg-primary/10'
                              : 'border-transparent hover:bg-surface-muted',
                          )}
                        >
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => loadWorkflow(item.id)}
                            className="min-w-0 flex-1 text-left"
                          >
                            <p className="truncate text-sm font-medium text-foreground">{item.name}</p>
                            <p className="text-[10px] text-muted">
                              更新于 {formatTime(item.updatedAt)}
                            </p>
                          </button>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => deleteWorkflowItem(item.id, item.name)}
                            className="rounded p-1.5 text-muted hover:bg-red-500/10 hover:text-red-500 disabled:opacity-50"
                            aria-label="删除"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))
                    )}
            </div>

            {message && (
              <div className="border-t border-border-subtle px-4 py-2 text-xs text-muted">
                {message}
              </div>
            )}
          </div>
      )}
    </div>
  )
}
