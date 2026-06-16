import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { workflows } from '@/db/schema'
import { WorkflowRevisionConflictError, type WorkflowUpdateResult } from './workflow-revision'
import type { SavedWorkflow, WorkflowEdge, WorkflowNode, WorkflowSummary } from './types'

function toSavedWorkflow(row: typeof workflows.$inferSelect): SavedWorkflow {
  return {
    id: row.id,
    name: row.name,
    nodes: row.nodes,
    edges: row.edges,
    revision: row.revision,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }
}

export async function listWorkflows(workspaceId: string): Promise<WorkflowSummary[]> {
  const rows = await db
    .select({
      id: workflows.id,
      name: workflows.name,
      createdAt: workflows.createdAt,
      updatedAt: workflows.updatedAt,
    })
    .from(workflows)
    .where(eq(workflows.workspaceId, workspaceId))
    .orderBy(desc(workflows.updatedAt))

  return rows.map(row => ({
    id: row.id,
    name: row.name,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
  }))
}

export async function getWorkflow(id: string, workspaceId: string): Promise<SavedWorkflow | null> {
  const [row] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, id))
    .limit(1)

  if (!row || row.workspaceId !== workspaceId)
    return null

  return toSavedWorkflow(row)
}

export async function createWorkflow(
  workspaceId: string,
  userId: string,
  name: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<SavedWorkflow> {
  const [row] = await db
    .insert(workflows)
    .values({
      workspaceId,
      createdBy: userId,
      name: name.trim() || '未命名工作流',
      nodes,
      edges,
      revision: 1,
    })
    .returning()

  return toSavedWorkflow(row)
}

export async function updateWorkflow(
  id: string,
  workspaceId: string,
  payload: {
    name?: string
    nodes?: WorkflowNode[]
    edges?: WorkflowEdge[]
    expectedRevision?: number
    force?: boolean
  },
): Promise<WorkflowUpdateResult | null> {
  const existing = await getWorkflow(id, workspaceId)
  if (!existing)
    return null

  if (
    !payload.force
    && payload.expectedRevision !== undefined
    && existing.revision !== payload.expectedRevision
  ) {
    return { ok: false, conflict: true, workflow: existing }
  }

  const [row] = await db
    .update(workflows)
    .set({
      name: payload.name?.trim() || existing.name,
      nodes: payload.nodes ?? existing.nodes,
      edges: payload.edges ?? existing.edges,
      revision: sql`${workflows.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, id))
    .returning()

  if (!row)
    return { ok: false, conflict: true, workflow: existing }

  return { ok: true, workflow: toSavedWorkflow(row) }
}

export async function updateWorkflowOrThrow(
  id: string,
  workspaceId: string,
  payload: {
    name?: string
    nodes?: WorkflowNode[]
    edges?: WorkflowEdge[]
    expectedRevision?: number
    force?: boolean
  },
): Promise<SavedWorkflow> {
  const result = await updateWorkflow(id, workspaceId, payload)
  if (!result)
    throw new Error('工作流不存在')
  if (!result.ok)
    throw new WorkflowRevisionConflictError(result.workflow)

  return result.workflow
}

export async function deleteWorkflow(id: string, workspaceId: string): Promise<boolean> {
  const existing = await getWorkflow(id, workspaceId)
  if (!existing)
    return false

  const result = await db
    .delete(workflows)
    .where(eq(workflows.id, id))
    .returning({ id: workflows.id })

  return result.length > 0
}
