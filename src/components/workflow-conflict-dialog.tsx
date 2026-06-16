'use client'

import type { ReactNode } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { saveWorkflowToServer, broadcastWorkflowSaved } from '@/lib/save-workflow-api'
import { useWorkflowCollaborationStore } from '@/store/workflow-collaboration-store'
import { useWorkflowStore } from '@/store/workflow-store'

export default function WorkflowConflictDialog() {
  const conflict = useWorkflowCollaborationStore(s => s.conflict)
  const setConflict = useWorkflowCollaborationStore(s => s.setConflict)
  const setApplyingRemote = useWorkflowCollaborationStore(s => s.setApplyingRemote)
  const markLocalEdits = useWorkflowCollaborationStore(s => s.markLocalEdits)

  if (!conflict)
    return null

  const remote = conflict.serverWorkflow ?? conflict.remote
  const senderName = remote.sender.name || '协作者'

  const acceptRemote = () => {
    setApplyingRemote(true)
    useWorkflowStore.getState().applyRemoteWorkflowUpdate(conflict.workflowId, {
      name: remote.name,
      nodes: remote.nodes,
      edges: remote.edges,
      revision: remote.revision,
    })
    markLocalEdits(conflict.workflowId, false)
    setConflict(null)
    window.setTimeout(() => setApplyingRemote(false), 0)
  }

  const keepMine = async () => {
    const session = useWorkflowStore.getState().sessions.find(item => item.id === conflict.sessionId)
    if (!session?.workflowId) {
      setConflict(null)
      return
    }

    try {
      const result = await saveWorkflowToServer(session.workflowId, {
        name: session.name,
        nodes: session.nodes,
        edges: session.edges,
        force: true,
      })
      useWorkflowStore.getState().setSessionWorkflowMeta(
        session.id,
        result.id,
        result.name,
        result.revision,
      )
      markLocalEdits(conflict.workflowId, false)
      broadcastWorkflowSaved(result.id, result.revision)
      setConflict(null)
    }
    catch (error) {
      alert(error instanceof Error ? error.message : '覆盖保存失败')
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/45 p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        <div className="mb-3 flex items-center gap-2 text-amber-600 dark:text-amber-400">
          <AlertTriangle className="h-5 w-5" />
          <h2 className="text-base font-semibold text-foreground">检测到协作冲突</h2>
        </div>

        <p className="text-sm leading-relaxed text-muted">
          {conflict.reason === 'save_conflict'
            ? '服务器上的工作流版本已更新，你的本地修改未能自动保存。'
            : `${senderName} 也在编辑此工作流，并且你们同时做了修改。为避免互相覆盖，请先选择如何处理。`}
        </p>

        <div className="mt-4 rounded-lg border border-border bg-input/40 p-3 text-xs text-muted">
          <p>
            对方版本：revision
            {' '}
            {remote.revision}
          </p>
          <p className="mt-1">
            更新时间：
            {new Date(remote.updatedAt).toLocaleString('zh-CN')}
          </p>
        </div>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={() => setConflict(null)}
            className="rounded-lg border border-border px-4 py-2 text-sm text-muted hover:bg-surface-muted hover:text-foreground"
          >
            稍后处理
          </button>
          <button
            type="button"
            onClick={acceptRemote}
            className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground hover:bg-surface-muted"
          >
            使用对方版本
          </button>
          <button
            type="button"
            onClick={() => void keepMine()}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/90"
          >
            保留我的版本
          </button>
        </div>
      </div>
    </div>
  )
}

export function WorkflowCollaborationBanner() {
  const conflict = useWorkflowCollaborationStore(s => s.conflict)
  const wsError = useWorkflowCollaborationStore(s => s.wsError)
  const wsConnected = useWorkflowCollaborationStore(s => s.wsConnected)
  const hasConnectedOnce = useWorkflowCollaborationStore(s => s.hasConnectedOnce)

  let content: ReactNode = null

  if (conflict) {
    content = (
      <>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>协作冲突待处理，请尽快选择保留哪一版修改。</span>
      </>
    )
  }
  else if (wsError) {
    content = (
      <>
        <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
        <span>
          实时协作连接异常：
          {wsError}
        </span>
      </>
    )
  }
  else if (!wsConnected && !hasConnectedOnce) {
    content = (
      <>
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span>正在连接实时协作服务…</span>
      </>
    )
  }

  return (
    <div
      className={
        content
          ? conflict
            ? 'flex items-center gap-2 border-b border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200'
            : wsError
              ? 'flex items-center gap-2 border-b border-red-500/30 bg-red-500/10 px-3 py-1.5 text-xs text-red-700 dark:text-red-300'
              : 'flex items-center gap-2 border-b border-border bg-surface-muted/60 px-3 py-1.5 text-xs text-muted'
          : 'h-0 overflow-hidden border-b border-transparent'
      }
      aria-live="polite"
    >
      {content}
    </div>
  )
}
