import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { workflows, workflowBranches, workflowVersions } from '@/db/schema'
import { WorkflowRevisionConflictError, type WorkflowUpdateResult } from './workflow-revision'
import type { SavedWorkflow, WorkflowEdge, WorkflowNode, WorkflowSummary } from './types'

function isMissingWorkflowVersionTable(error: unknown): boolean {
  if (!error || typeof error !== 'object')
    return false

  const code = 'code' in error ? String(error.code) : ''
  if (code === '42P01')
    return true

  const cause = 'cause' in error ? error.cause : null
  if (cause && typeof cause === 'object' && 'code' in cause)
    return String(cause.code) === '42P01'

  const message = error instanceof Error ? error.message : String(error)
  return message.includes('workflow_version') && message.includes('does not exist')
}

async function insertAutoVersionSnapshot(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  snapshot: {
    workflowId: string
    revision: number
    branchName?: string
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    name: string
    createdBy?: string | null
  },
): Promise<void> {
  try {
    await tx.insert(workflowVersions).values({
      workflowId: snapshot.workflowId,
      revision: snapshot.revision,
      branchName: snapshot.branchName ?? 'main',
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      name: snapshot.name,
      type: 'auto',
      createdBy: snapshot.createdBy ?? null,
    })
  }
  catch (error) {
    if (isMissingWorkflowVersionTable(error)) {
      console.warn('[workflow] workflow_version 表不存在，已跳过版本快照（请执行 npm run db:push）')
      return
    }
    throw error
  }
}

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
    await insertAutoVersionSnapshot(tx, {
      workflowId: wf.id,
      revision: 1,
      nodes,
      edges,
      name: workflowName,
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
    branchName?: string
    createdBy?: string | null
  },
): Promise<WorkflowUpdateResult | null> {
  const existing = await getWorkflow(id, workspaceId)
  if (!existing)
    return null

  const branchName = payload.branchName ?? 'main'

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
    await insertAutoVersionSnapshot(tx, {
      workflowId: existing.id,
      revision: existing.revision,
      branchName,
      nodes: existing.nodes,
      edges: existing.edges,
      name: existing.name,
      createdBy: payload.createdBy ?? null,
    })

    if (branchName !== 'main') {
      await tx
        .update(workflowBranches)
        .set({ updatedAt: new Date() })
        .where(
          and(
            eq(workflowBranches.workflowId, id),
            eq(workflowBranches.name, branchName),
          ),
        )
    }

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
