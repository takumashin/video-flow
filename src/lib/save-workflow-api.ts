import { sanitizeNodesForSave } from '@/lib/sanitize-workflow'
import type { WorkflowEdge, WorkflowNode } from '@/lib/types'

export type WorkflowSavePayload = {
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowSaveResult = {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export async function saveWorkflowToServer(
  workflowId: string | null,
  payload: WorkflowSavePayload,
): Promise<WorkflowSaveResult> {
  const body = {
    name: payload.name.trim() || '未命名工作流',
    nodes: sanitizeNodesForSave(payload.nodes),
    edges: payload.edges,
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
  if (!response.ok)
    throw new Error(typeof data.error === 'string' ? data.error : '保存失败')

  return {
    id: data.id,
    name: data.name,
    nodes: data.nodes,
    edges: data.edges,
  }
}
