import { and, desc, eq, inArray, sql } from 'drizzle-orm'
import { db } from '@/db'
import { users, workflowBranches, workflows, workflowVersions } from '@/db/schema'
import { getLatestVersionForBranch, getWorkflowVersion } from './workflow-versions-storage'
import type {
  WorkflowBranch,
  WorkflowBranchStatus,
  WorkflowEdge,
  WorkflowNode,
} from './types'

const MAIN_BRANCH = 'main'

async function getNextBranchRevision(workflowId: string, branchName: string): Promise<number> {
  const latest = await getLatestVersionForBranch(workflowId, branchName)
  return latest ? latest.revision + 1 : 1
}

async function insertBranchSnapshot(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  params: {
    workflowId: string
    branchName: string
    revision: number
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    name: string
    type?: 'auto' | 'manual' | 'restore' | 'merge'
    label?: string | null
    createdBy?: string | null
  },
): Promise<void> {
  await tx.insert(workflowVersions).values({
    workflowId: params.workflowId,
    revision: params.revision,
    branchName: params.branchName,
    nodes: params.nodes,
    edges: params.edges,
    name: params.name,
    label: params.label ?? null,
    type: params.type ?? 'auto',
    createdBy: params.createdBy ?? null,
  })
}

async function touchBranchMetadata(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  workflowId: string,
  branchName: string,
): Promise<void> {
  if (branchName === MAIN_BRANCH)
    return

  await tx
    .update(workflowBranches)
    .set({ updatedAt: new Date() })
    .where(
      and(
        eq(workflowBranches.workflowId, workflowId),
        eq(workflowBranches.name, branchName),
      ),
    )
}

export async function persistWorkingCopyToBranch(
  workflowId: string,
  branchName: string,
  state: {
    name: string
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    revision: number
  },
  userId?: string | null,
): Promise<void> {
  await db.transaction(async (tx) => {
    const revision = branchName === MAIN_BRANCH
      ? state.revision
      : await getNextBranchRevision(workflowId, branchName)

    await insertBranchSnapshot(tx, {
      workflowId,
      branchName,
      revision,
      nodes: state.nodes,
      edges: state.edges,
      name: state.name,
      createdBy: userId ?? null,
    })
    await touchBranchMetadata(tx, workflowId, branchName)
  })
}

export async function listBranches(
  workflowId: string,
  options?: { userId?: string; status?: WorkflowBranchStatus | 'all' },
): Promise<WorkflowBranch[]> {
  const [workflow] = await db
    .select({ updatedAt: workflows.updatedAt, createdBy: workflows.createdBy })
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)

  if (!workflow)
    return []

  const mainLatest = await getLatestVersionForBranch(workflowId, MAIN_BRANCH)

  const mainBranch: WorkflowBranch = {
    name: MAIN_BRANCH,
    status: 'active',
    isMain: true,
    latestRevision: mainLatest?.revision ?? 0,
    latestVersionId: mainLatest?.id ?? '',
    createdAt: mainLatest?.createdAt ?? workflow.updatedAt.getTime(),
    updatedAt: workflow.updatedAt.getTime(),
    createdBy: mainLatest?.createdBy ?? workflow.createdBy,
    createdByName: mainLatest?.createdByName ?? null,
    description: null,
  }

  const conditions = [eq(workflowBranches.workflowId, workflowId)]
  if (options?.status === 'active') {
    conditions.push(eq(workflowBranches.status, 'active'))
  }
  else if (options?.status === 'archived') {
    conditions.push(inArray(workflowBranches.status, ['archived', 'merged']))
  }
  else if (options?.status === 'merged') {
    conditions.push(eq(workflowBranches.status, 'merged'))
  }

  const rows = await db
    .select({
      name: workflowBranches.name,
      status: workflowBranches.status,
      description: workflowBranches.description,
      createdBy: workflowBranches.createdBy,
      createdByName: users.name,
      createdAt: workflowBranches.createdAt,
      updatedAt: workflowBranches.updatedAt,
    })
    .from(workflowBranches)
    .leftJoin(users, eq(workflowBranches.createdBy, users.id))
    .where(and(...conditions))
    .orderBy(desc(workflowBranches.updatedAt))

  const branches: WorkflowBranch[] = [mainBranch]

  for (const row of rows) {
    const latest = await getLatestVersionForBranch(workflowId, row.name)
    branches.push({
      name: row.name,
      status: row.status,
      isMain: false,
      latestRevision: latest?.revision ?? 0,
      latestVersionId: latest?.id ?? '',
      createdAt: row.createdAt.getTime(),
      updatedAt: row.updatedAt.getTime(),
      createdBy: row.createdBy,
      createdByName: row.createdByName,
      description: row.description,
    })
  }

  if (options?.status === 'active') {
    return branches.filter(b => b.isMain || b.status === 'active')
  }
  if (options?.status === 'archived') {
    return branches.filter(b => !b.isMain && (b.status === 'archived' || b.status === 'merged'))
  }
  if (options?.status === 'merged') {
    return branches.filter(b => b.status === 'merged')
  }

  if (options?.userId) {
    return branches.filter(b => b.isMain || b.createdBy === options.userId)
  }

  return branches
}

export async function createBranchFromCurrent(
  workflowId: string,
  branchName: string,
  userId: string,
  options?: { description?: string; sourceVersionId?: string },
): Promise<WorkflowBranch> {
  const normalized = branchName.trim()
  if (!normalized || normalized === MAIN_BRANCH)
    throw new Error('分支名称无效')

  const [existingMeta] = await db
    .select({ name: workflowBranches.name })
    .from(workflowBranches)
    .where(
      and(
        eq(workflowBranches.workflowId, workflowId),
        eq(workflowBranches.name, normalized),
      ),
    )
    .limit(1)

  if (existingMeta)
    throw new Error(`分支 "${normalized}" 已存在`)

  let sourceNodes: WorkflowNode[]
  let sourceEdges: WorkflowEdge[]
  let sourceName: string

  if (options?.sourceVersionId) {
    const sourceVersion = await getWorkflowVersion(options.sourceVersionId)
    if (!sourceVersion || sourceVersion.workflowId !== workflowId)
      throw new Error('源版本不存在')
    sourceNodes = sourceVersion.nodes
    sourceEdges = sourceVersion.edges
    sourceName = sourceVersion.name
  }
  else {
    const [workflow] = await db
      .select()
      .from(workflows)
      .where(eq(workflows.id, workflowId))
      .limit(1)
    if (!workflow)
      throw new Error('工作流不存在')
    sourceNodes = workflow.nodes as WorkflowNode[]
    sourceEdges = workflow.edges as WorkflowEdge[]
    sourceName = workflow.name
  }

  const now = new Date()

  await db.transaction(async (tx) => {
    await tx.insert(workflowBranches).values({
      workflowId,
      name: normalized,
      status: 'active',
      description: options?.description ?? null,
      sourceVersionId: options?.sourceVersionId ?? null,
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
    })

    await insertBranchSnapshot(tx, {
      workflowId,
      branchName: normalized,
      revision: 1,
      nodes: sourceNodes,
      edges: sourceEdges,
      name: sourceName,
      type: 'manual',
      label: `Branch created from ${options?.sourceVersionId ? 'version' : 'current file'}`,
      createdBy: userId,
    })
  })

  const latest = await getLatestVersionForBranch(workflowId, normalized)
  return {
    name: normalized,
    status: 'active',
    isMain: false,
    latestRevision: latest?.revision ?? 1,
    latestVersionId: latest?.id ?? '',
    createdAt: now.getTime(),
    updatedAt: now.getTime(),
    createdBy: userId,
    createdByName: null,
    description: options?.description ?? null,
  }
}

export async function checkoutWorkflowBranch(
  workflowId: string,
  workspaceId: string,
  targetBranch: string,
  fromBranch: string,
  currentState: {
    name: string
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    revision: number
  },
  userId: string,
): Promise<{
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  revision: number
  branchName: string
  branchRevision: number
}> {
  const workflow = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)

  if (!workflow[0] || workflow[0].workspaceId !== workspaceId)
    throw new Error('工作流不存在')

  if (targetBranch !== MAIN_BRANCH) {
    const [meta] = await db
      .select({ status: workflowBranches.status })
      .from(workflowBranches)
      .where(
        and(
          eq(workflowBranches.workflowId, workflowId),
          eq(workflowBranches.name, targetBranch),
        ),
      )
      .limit(1)

    if (!meta)
      throw new Error('分支不存在')
    if (meta.status === 'merged')
      throw new Error('已合并的分支无法打开')
  }

  const targetLatest = targetBranch === MAIN_BRANCH
    ? await getLatestVersionForBranch(workflowId, MAIN_BRANCH)
    : await getLatestVersionForBranch(workflowId, targetBranch)

  if (targetBranch !== MAIN_BRANCH && !targetLatest)
    throw new Error('分支暂无内容')

  const result = await db.transaction(async (tx) => {
    if (fromBranch !== targetBranch) {
      const fromRevision = fromBranch === MAIN_BRANCH
        ? currentState.revision
        : await getNextBranchRevision(workflowId, fromBranch)

      await insertBranchSnapshot(tx, {
        workflowId,
        branchName: fromBranch,
        revision: fromRevision,
        nodes: currentState.nodes,
        edges: currentState.edges,
        name: currentState.name,
        label: fromBranch === targetBranch ? null : `Checkpoint before switching to ${targetBranch}`,
        createdBy: userId,
      })
      await touchBranchMetadata(tx, workflowId, fromBranch)
    }

    const loadName = targetLatest?.name ?? workflow[0].name
    const loadNodes = (targetLatest?.nodes ?? workflow[0].nodes) as WorkflowNode[]
    const loadEdges = (targetLatest?.edges ?? workflow[0].edges) as WorkflowEdge[]

    const [updated] = await tx
      .update(workflows)
      .set({
        name: loadName,
        nodes: loadNodes,
        edges: loadEdges,
        revision: sql`${workflows.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId))
      .returning()

    if (!updated)
      throw new Error('切换分支失败')

    return updated
  })

  const branchRevision = targetBranch === MAIN_BRANCH
    ? result.revision
    : (targetLatest?.revision ?? 1)

  return {
    id: result.id,
    name: result.name,
    nodes: result.nodes as WorkflowNode[],
    edges: result.edges as WorkflowEdge[],
    revision: result.revision,
    branchName: targetBranch,
    branchRevision,
  }
}

export async function mergeBranchIntoMain(
  workflowId: string,
  workspaceId: string,
  branchName: string,
  userId: string,
): Promise<{ workflow: { id: string; name: string; nodes: WorkflowNode[]; edges: WorkflowEdge[]; revision: number } }> {
  if (branchName === MAIN_BRANCH)
    throw new Error('无法合并主分支')

  const [meta] = await db
    .select()
    .from(workflowBranches)
    .where(
      and(
        eq(workflowBranches.workflowId, workflowId),
        eq(workflowBranches.name, branchName),
      ),
    )
    .limit(1)

  if (!meta)
    throw new Error('分支不存在')
  if (meta.status !== 'active')
    throw new Error('只能合并活跃分支')

  const branchLatest = await getLatestVersionForBranch(workflowId, branchName)
  if (!branchLatest)
    throw new Error('分支无内容')

  const [workflow] = await db
    .select()
    .from(workflows)
    .where(eq(workflows.id, workflowId))
    .limit(1)

  if (!workflow || workflow.workspaceId !== workspaceId)
    throw new Error('工作流不存在')

  const merged = await db.transaction(async (tx) => {
    await insertBranchSnapshot(tx, {
      workflowId,
      branchName: MAIN_BRANCH,
      revision: workflow.revision,
      nodes: workflow.nodes as WorkflowNode[],
      edges: workflow.edges as WorkflowEdge[],
      name: workflow.name,
      label: `Before merge from ${branchName}`,
      createdBy: userId,
    })

    const [updated] = await tx
      .update(workflows)
      .set({
        name: branchLatest.name.replace(new RegExp(` \\(${branchName}\\)$`), '') || branchLatest.name,
        nodes: branchLatest.nodes,
        edges: branchLatest.edges,
        revision: sql`${workflows.revision} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(workflows.id, workflowId))
      .returning()

    if (!updated)
      throw new Error('合并失败')

    await insertBranchSnapshot(tx, {
      workflowId,
      branchName: MAIN_BRANCH,
      revision: updated.revision,
      nodes: updated.nodes as WorkflowNode[],
      edges: updated.edges as WorkflowEdge[],
      name: updated.name,
      type: 'merge',
      label: `Merged branch "${branchName}"`,
      createdBy: userId,
    })

    const now = new Date()
    await tx
      .update(workflowBranches)
      .set({
        status: 'merged',
        mergedAt: now,
        updatedAt: now,
      })
      .where(
        and(
          eq(workflowBranches.workflowId, workflowId),
          eq(workflowBranches.name, branchName),
        ),
      )

    return updated
  })

  return {
    workflow: {
      id: merged.id,
      name: merged.name,
      nodes: merged.nodes as WorkflowNode[],
      edges: merged.edges as WorkflowEdge[],
      revision: merged.revision,
    },
  }
}

export async function archiveBranch(
  workflowId: string,
  branchName: string,
): Promise<void> {
  if (branchName === MAIN_BRANCH)
    throw new Error('无法归档主分支')

  const now = new Date()
  const result = await db
    .update(workflowBranches)
    .set({
      status: 'archived',
      archivedAt: now,
      updatedAt: now,
    })
    .where(
      and(
        eq(workflowBranches.workflowId, workflowId),
        eq(workflowBranches.name, branchName),
        eq(workflowBranches.status, 'active'),
      ),
    )
    .returning({ id: workflowBranches.id })

  if (result.length === 0)
    throw new Error('分支不存在或无法归档')
}

export async function restoreArchivedBranch(
  workflowId: string,
  branchName: string,
): Promise<void> {
  if (branchName === MAIN_BRANCH)
    throw new Error('无法恢复主分支')

  const now = new Date()
  const result = await db
    .update(workflowBranches)
    .set({
      status: 'active',
      archivedAt: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(workflowBranches.workflowId, workflowId),
        eq(workflowBranches.name, branchName),
        eq(workflowBranches.status, 'archived'),
      ),
    )
    .returning({ id: workflowBranches.id })

  if (result.length === 0)
    throw new Error('分支不存在或无法恢复')
}

export async function renameBranch(
  workflowId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const normalized = newName.trim()
  if (!normalized || normalized === MAIN_BRANCH)
    throw new Error('分支名称无效')

  await db.transaction(async (tx) => {
    const [meta] = await tx
      .select()
      .from(workflowBranches)
      .where(
        and(
          eq(workflowBranches.workflowId, workflowId),
          eq(workflowBranches.name, oldName),
        ),
      )
      .limit(1)

    if (!meta)
      throw new Error('分支不存在')

    await tx
      .update(workflowBranches)
      .set({ name: normalized, updatedAt: new Date() })
      .where(eq(workflowBranches.id, meta.id))

    await tx
      .update(workflowVersions)
      .set({ branchName: normalized })
      .where(
        and(
          eq(workflowVersions.workflowId, workflowId),
          eq(workflowVersions.branchName, oldName),
        ),
      )
  })
}
