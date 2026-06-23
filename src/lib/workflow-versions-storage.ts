import { and, desc, eq, sql } from 'drizzle-orm'
import { db } from '@/db'
import { workflowVersions, workflows, users } from '@/db/schema'
import { computeWorkflowDiff } from './workflow-diff'
import type {
  WorkflowDiffResult,
  WorkflowEdge,
  WorkflowNode,
  WorkflowVersionDetail,
  WorkflowVersionSummary,
  WorkflowVersionType,
} from './types'

// ---- Helpers ----

function toVersionSummary(row: Record<string, unknown>): WorkflowVersionSummary {
  return {
    id: row.id as string,
    workflowId: row.workflowId as string,
    revision: row.revision as number,
    branchName: row.branchName as string,
    name: row.name as string,
    label: row.label as string | null,
    description: row.description as string | null,
    type: row.type as WorkflowVersionType,
    createdBy: row.createdBy as string | null,
    createdByName: row.createdByName as string | null,
    createdByImage: row.createdByImage as string | null,
    createdAt: (row.createdAt as Date).getTime(),
  }
}

// ---- Create ----

export async function createWorkflowVersion(params: {
  workflowId: string
  revision: number
  branchName?: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  name: string
  label?: string | null
  description?: string | null
  type?: WorkflowVersionType
  createdBy?: string | null
}): Promise<WorkflowVersionSummary> {
  const [row] = await db
    .insert(workflowVersions)
    .values({
      workflowId: params.workflowId,
      revision: params.revision,
      branchName: params.branchName ?? 'main',
      nodes: params.nodes,
      edges: params.edges,
      name: params.name,
      label: params.label ?? null,
      description: params.description ?? null,
      type: params.type ?? 'auto',
      createdBy: params.createdBy ?? null,
    })
    .returning()

  return {
    id: row.id,
    workflowId: row.workflowId,
    revision: row.revision,
    branchName: row.branchName,
    name: row.name,
    label: row.label,
    description: row.description,
    type: row.type,
    createdBy: row.createdBy,
    createdByName: null,
    createdByImage: null,
    createdAt: row.createdAt.getTime(),
  }
}

// ---- Read ----

export async function listWorkflowVersions(
  workflowId: string,
  options?: {
    branchName?: string
    type?: WorkflowVersionType
    limit?: number
    offset?: number
  },
): Promise<WorkflowVersionSummary[]> {
  const branch = options?.branchName ?? 'main'
  const limit = options?.limit ?? 20
  const offset = options?.offset ?? 0

  const conditions = [
    eq(workflowVersions.workflowId, workflowId),
    eq(workflowVersions.branchName, branch),
  ]

  if (options?.type) {
    conditions.push(eq(workflowVersions.type, options.type))
  }

  const rows = await db
    .select({
      id: workflowVersions.id,
      workflowId: workflowVersions.workflowId,
      revision: workflowVersions.revision,
      branchName: workflowVersions.branchName,
      name: workflowVersions.name,
      label: workflowVersions.label,
      description: workflowVersions.description,
      type: workflowVersions.type,
      createdBy: workflowVersions.createdBy,
      createdByName: users.name,
      createdByImage: users.image,
      createdAt: workflowVersions.createdAt,
    })
    .from(workflowVersions)
    .leftJoin(users, eq(workflowVersions.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(workflowVersions.revision))
    .limit(limit)
    .offset(offset)

  return rows.map(toVersionSummary)
}

export async function getWorkflowVersion(
  versionId: string,
): Promise<WorkflowVersionDetail | null> {
  const [row] = await db
    .select({
      id: workflowVersions.id,
      workflowId: workflowVersions.workflowId,
      revision: workflowVersions.revision,
      branchName: workflowVersions.branchName,
      nodes: workflowVersions.nodes,
      edges: workflowVersions.edges,
      name: workflowVersions.name,
      label: workflowVersions.label,
      description: workflowVersions.description,
      type: workflowVersions.type,
      createdBy: workflowVersions.createdBy,
      createdByName: users.name,
      createdByImage: users.image,
      createdAt: workflowVersions.createdAt,
    })
    .from(workflowVersions)
    .leftJoin(users, eq(workflowVersions.createdBy, users.id))
    .where(eq(workflowVersions.id, versionId))
    .limit(1)

  if (!row) return null

  return {
    ...toVersionSummary(row),
    nodes: row.nodes as WorkflowNode[],
    edges: row.edges as WorkflowEdge[],
  }
}

export async function getLatestVersionForBranch(
  workflowId: string,
  branchName: string,
): Promise<WorkflowVersionDetail | null> {
  const [row] = await db
    .select({
      id: workflowVersions.id,
      workflowId: workflowVersions.workflowId,
      revision: workflowVersions.revision,
      branchName: workflowVersions.branchName,
      nodes: workflowVersions.nodes,
      edges: workflowVersions.edges,
      name: workflowVersions.name,
      label: workflowVersions.label,
      description: workflowVersions.description,
      type: workflowVersions.type,
      createdBy: workflowVersions.createdBy,
      createdByName: users.name,
      createdByImage: users.image,
      createdAt: workflowVersions.createdAt,
    })
    .from(workflowVersions)
    .leftJoin(users, eq(workflowVersions.createdBy, users.id))
    .where(
      and(
        eq(workflowVersions.workflowId, workflowId),
        eq(workflowVersions.branchName, branchName),
      ),
    )
    .orderBy(desc(workflowVersions.revision))
    .limit(1)

  if (!row) return null

  return {
    ...toVersionSummary(row),
    nodes: row.nodes as WorkflowNode[],
    edges: row.edges as WorkflowEdge[],
  }
}

// ---- Named versions ----

export async function createNamedVersion(
  workflowId: string,
  userId: string,
  label: string,
  description?: string,
  branchName: string = 'main',
): Promise<WorkflowVersionSummary> {
  // Read current workflow state
  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)

  if (!workflow) throw new Error('工作流不存在')

  return createWorkflowVersion({
    workflowId,
    revision: workflow.revision,
    branchName,
    nodes: workflow.nodes as WorkflowNode[],
    edges: workflow.edges as WorkflowEdge[],
    name: workflow.name,
    label,
    description: description ?? null,
    type: 'manual',
    createdBy: userId,
  })
}

// ---- Restore ----

export async function restoreVersion(
  workflowId: string,
  versionId: string,
  userId: string,
): Promise<{ id: string; name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; revision: number; updatedAt: number }> {
  const version = await getWorkflowVersion(versionId)
  if (!version || version.workflowId !== workflowId) {
    throw new Error('版本不存在')
  }

  // Update the workflow row with the restored state
  const [updated] = await db
    .update(workflows)
    .set({
      name: version.name,
      nodes: version.nodes,
      edges: version.edges,
      revision: sql`${workflows.revision} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(workflows.id, workflowId))
    .returning()

  if (!updated) throw new Error('工作流不存在')

  // Create a restore version entry
  const restoreLabel = version.label
    ? `Restored from "${version.label}" (r${version.revision})`
    : `Restored from r${version.revision}${version.branchName !== 'main' ? ` (${version.branchName})` : ''}`

  await createWorkflowVersion({
    workflowId,
    revision: updated.revision,
    branchName: 'main',
    nodes: version.nodes,
    edges: version.edges,
    name: version.name,
    label: restoreLabel,
    type: 'restore',
    createdBy: userId,
  })

  return {
    id: updated.id,
    name: updated.name,
    nodes: updated.nodes as WorkflowNode[],
    edges: updated.edges as WorkflowEdge[],
    revision: updated.revision,
    updatedAt: updated.updatedAt.getTime(),
  }
}

// ---- Diff ----

export async function getVersionDiff(
  workflowId: string,
  versionIdA: string,
  versionIdB: string,
): Promise<WorkflowDiffResult | null> {
  const [verA, verB] = await Promise.all([
    getWorkflowVersion(versionIdA),
    getWorkflowVersion(versionIdB),
  ])

  if (!verA || !verB || verA.workflowId !== workflowId || verB.workflowId !== workflowId) {
    return null
  }

  const { nodeChanges, edgeChanges } = computeWorkflowDiff(
    verA.nodes,
    verA.edges,
    verB.nodes,
    verB.edges,
  )

  return {
    versionA: { id: verA.id, revision: verA.revision, createdAt: verA.createdAt, label: verA.label },
    versionB: { id: verB.id, revision: verB.revision, createdAt: verB.createdAt, label: verB.label },
    nodeChanges,
    edgeChanges,
  }
}

// ---- Transaction helper for save integration ----

/**
 * Insert a version record using a transaction-scoped DB instance.
 * Called from workflow-storage.ts inside its save transaction.
 */
export async function insertVersionInSave(params: {
  workflowId: string
  revision: number
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  name: string
  createdBy?: string | null
}): Promise<void> {
  await db.insert(workflowVersions).values({
    workflowId: params.workflowId,
    revision: params.revision,
    branchName: 'main',
    nodes: params.nodes,
    edges: params.edges,
    name: params.name,
    type: 'auto',
    createdBy: params.createdBy ?? null,
  })
}
