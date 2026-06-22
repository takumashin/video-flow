import { desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { workflows, workflowVersions } from '@/db/schema'
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
  const workflowName = name.trim() || '未命名工作流'

  const row = await db.transaction(async (tx) => {
    const [wf] = await tx
      .insert(workflows)
      .values({
        workspaceId,
        createdBy: userId,
        name: workflowName,
        nodes,
        edges,
        revision: 1,
      })
      .returning()

    // Create initial version entry
    await tx.insert(workflowVersions).values({
      workflowId: wf.id,
      revision: 1,
      branchName: 'main',
      nodes,
      edges,
      name: workflowName,
      type: 'auto',
      createdBy: userId,
    })

    return wf
  })

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

  const newName = payload.name?.trim() || existing.name
  const newNodes = payload.nodes ?? existing.nodes
  const newEdges = payload.edges ?? existing.edges

  const row = await db.transaction(async (tx) => {
    // Save the pre-update state as a version snapshot
    await tx.insert(workflowVersions).values({
      workflowId: existing.id,
      revision: existing.revision,
      branchName: 'main',
      nodes: existing.nodes,
      edges: existing.edges,
      name: existing.name,
      type: 'auto',
      createdBy: null, // auto-save, no specific user
    })

    // Update the workflow
    const [updated] = await tx
      .update(workflows)
      .set({
        name: newName,
        nodes: newNodes,
        edges: newEdges,
        revision: sql`${workflows.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, id))
      .returning()

    return updated ?? null
  })

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
