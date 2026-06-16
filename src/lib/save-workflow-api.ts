import { sanitizeNodesForSave } from '@/lib/sanitize-workflow'
import type { SavedWorkflow, WorkflowEdge, WorkflowNode } from '@/lib/types'

export type WorkflowSavePayload = {
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  expectedRevision?: number | null
  force?: boolean
}

export type WorkflowSaveResult = SavedWorkflow

export class WorkflowSaveConflictError extends Error {
  readonly serverWorkflow: SavedWorkflow

  constructor(serverWorkflow: SavedWorkflow) {
    super('工作流已被其他协作者更新，请处理冲突后再保存')
    this.name = 'WorkflowSaveConflictError'
    this.serverWorkflow = serverWorkflow
  }
}

export async function saveWorkflowToServer(
  workflowId: string | null,
  payload: WorkflowSavePayload,
): Promise<WorkflowSaveResult> {
  const body = {
    name: payload.name.trim() || '未命名工作流',
    nodes: sanitizeNodesForSave(payload.nodes),
    edges: payload.edges,
    expectedRevision: payload.expectedRevision ?? undefined,
    force: payload.force ?? false,
  }

  const response = workflowId
    ? await fetch(`/api/workflows/${workflowId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    : await fetch('/api/workflows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

  const data = await response.json()
  if (response.status === 409 && data.workflow) {
    throw new WorkflowSaveConflictError(data.workflow as SavedWorkflow)
  }

  if (!response.ok)
    throw new Error(typeof data.error === 'string' ? data.error : '保存失败')

  return data as WorkflowSaveResult
}

export async function broadcastWorkflowSaved(workflowId: string, revision: number) {
  if (typeof window === 'undefined')
    return
  window.dispatchEvent(new CustomEvent('seedance:workflow-saved', {
    detail: { workflowId, revision, updatedAt: Date.now() },
  }))
}
