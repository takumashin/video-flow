import { and, count, desc, eq, inArray } from 'drizzle-orm'
import { db } from '@/db'
import { seedanceTasks } from '@/db/schema'
import { extractSeedanceTaskProgress, getSeedanceTask, cancelSeedanceTask } from '@/lib/seedance'
import { refundCreditsForReviewFailedTask } from '@/lib/credits/service'
import { getSeedanceApiTaskId, getWaitingQueuePosition, scheduleSeedanceQueueProcessing } from '@/lib/seedance-queue/service'
import type { SeedanceTaskListItem, SeedanceTaskStatus } from '@/lib/types'

import type { SeedanceTaskSubmitPayload } from '@/lib/seedance-queue/types'

export type SeedanceTaskRecordInput = {
  userId: string
  workspaceId: string
  taskId: string
  apiTaskId?: string | null
  submitPayload?: SeedanceTaskSubmitPayload | null
  prompt?: string | null
  nodeTitle?: string | null
  workflowId?: string | null
  nodeId?: string | null
  model?: string | null
  status?: SeedanceTaskStatus
  progress?: number | null
  videoUrl?: string | null
  remoteVideoUrl?: string | null
  errorMessage?: string | null
  progressStartedAt?: number | null
}

export type SeedanceTaskRecord = typeof seedanceTasks.$inferSelect

export class SeedanceTaskNotCancellableError extends Error {
  constructor(message = '正在生成中的任务无法取消，请等待完成') {
    super(message)
    this.name = 'SeedanceTaskNotCancellableError'
  }
}

export async function cancelSeedanceTaskForUser(userId: string, taskId: string) {
  const record = await getSeedanceTaskRecordForUser(userId, taskId)
  if (!record)
    return null

  if (record.status === 'cancelled' || record.status === 'succeeded' || record.status === 'failed')
    return record

  if (record.status === 'running')
    throw new SeedanceTaskNotCancellableError()

  if (record.status === 'waiting' || record.status === 'submitting') {
    const [updated] = await db
      .update(seedanceTasks)
      .set({
        status: 'cancelled',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(seedanceTasks.id, record.id))
      .returning()

    scheduleSeedanceQueueProcessing()
    return updated
  }

  const apiTaskId = getSeedanceApiTaskId(record)
  if (!apiTaskId)
    throw new Error('任务缺少远程 ID，无法取消')

  await cancelSeedanceTask(apiTaskId)

  const [updated] = await db
    .update(seedanceTasks)
    .set({
      status: 'cancelled',
      errorMessage: null,
      updatedAt: new Date(),
    })
    .where(eq(seedanceTasks.id, record.id))
    .returning()

  scheduleSeedanceQueueProcessing()
  return updated
}

export async function createWaitingSeedanceTaskRecord(input: {
  userId: string
  workspaceId: string
  taskId: string
  prompt?: string | null
  nodeTitle?: string | null
  workflowId?: string | null
  nodeId?: string | null
  model?: string | null
  submitPayload: SeedanceTaskSubmitPayload
}) {
  const now = new Date()
  const [created] = await db
    .insert(seedanceTasks)
    .values({
      userId: input.userId,
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      prompt: input.prompt ?? null,
      nodeTitle: input.nodeTitle ?? null,
      workflowId: input.workflowId ?? null,
      nodeId: input.nodeId ?? null,
      model: input.model ?? null,
      status: 'waiting',
      progress: 0,
      submitPayload: input.submitPayload,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return created
}

export async function upsertSeedanceTaskRecord(input: SeedanceTaskRecordInput) {
  const now = new Date()
  const [existing] = await db
    .select()
    .from(seedanceTasks)
    .where(and(
      eq(seedanceTasks.userId, input.userId),
      eq(seedanceTasks.taskId, input.taskId),
    ))
    .limit(1)

  const patch = {
    ...(input.apiTaskId !== undefined && { apiTaskId: input.apiTaskId }),
    ...(input.submitPayload !== undefined && { submitPayload: input.submitPayload }),
    ...(input.prompt !== undefined && { prompt: input.prompt }),
    ...(input.nodeTitle !== undefined && { nodeTitle: input.nodeTitle }),
    ...(input.workflowId !== undefined && { workflowId: input.workflowId }),
    ...(input.nodeId !== undefined && { nodeId: input.nodeId }),
    ...(input.model !== undefined && { model: input.model }),
    ...(input.status !== undefined && { status: input.status }),
    ...(input.progress !== undefined && { progress: input.progress }),
    ...(input.videoUrl !== undefined && { videoUrl: input.videoUrl }),
    ...(input.remoteVideoUrl !== undefined && { remoteVideoUrl: input.remoteVideoUrl }),
    ...(input.errorMessage !== undefined && { errorMessage: input.errorMessage }),
    ...(input.progressStartedAt !== undefined && { progressStartedAt: input.progressStartedAt }),
    updatedAt: now,
  }

  if (existing) {
    const [updated] = await db
      .update(seedanceTasks)
      .set(patch)
      .where(eq(seedanceTasks.id, existing.id))
      .returning()
    return updated
  }

  const [created] = await db
    .insert(seedanceTasks)
    .values({
      userId: input.userId,
      workspaceId: input.workspaceId,
      taskId: input.taskId,
      apiTaskId: input.apiTaskId ?? null,
      submitPayload: input.submitPayload ?? null,
      prompt: input.prompt ?? null,
      nodeTitle: input.nodeTitle ?? null,
      workflowId: input.workflowId ?? null,
      nodeId: input.nodeId ?? null,
      model: input.model ?? null,
      status: input.status ?? 'queued',
      progress: input.progress ?? null,
      videoUrl: input.videoUrl ?? null,
      remoteVideoUrl: input.remoteVideoUrl ?? null,
      errorMessage: input.errorMessage ?? null,
      progressStartedAt: input.progressStartedAt ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()

  return created
}

export async function getSeedanceTaskRecordForUser(userId: string, taskId: string) {
  const [row] = await db
    .select()
    .from(seedanceTasks)
    .where(and(
      eq(seedanceTasks.userId, userId),
      eq(seedanceTasks.taskId, taskId),
    ))
    .limit(1)

  return row ?? null
}

export async function listSeedanceTaskRecords(options: {
  userId: string
  workspaceId: string
  pageNum: number
  pageSize: number
  status?: SeedanceTaskStatus
}) {
  const conditions = [
    eq(seedanceTasks.userId, options.userId),
    eq(seedanceTasks.workspaceId, options.workspaceId),
  ]

  if (options.status)
    conditions.push(eq(seedanceTasks.status, options.status))

  const where = and(...conditions)
  const offset = (options.pageNum - 1) * options.pageSize

  const [totalRow] = await db
    .select({ count: count() })
    .from(seedanceTasks)
    .where(where)

  const rows = await db
    .select()
    .from(seedanceTasks)
    .where(where)
    .orderBy(desc(seedanceTasks.createdAt))
    .limit(options.pageSize)
    .offset(offset)

  return {
    total: totalRow?.count ?? 0,
    items: rows,
  }
}

export async function listActiveSeedanceTaskRecords(options: {
  userId: string
  workspaceId: string
}) {
  return db
    .select()
    .from(seedanceTasks)
    .where(and(
      eq(seedanceTasks.userId, options.userId),
      eq(seedanceTasks.workspaceId, options.workspaceId),
      inArray(seedanceTasks.status, ['waiting', 'submitting', 'queued', 'running']),
    ))
    .orderBy(desc(seedanceTasks.createdAt))
}

export async function syncSeedanceTaskRecordFromApi(userId: string, taskId: string) {
  const record = await getSeedanceTaskRecordForUser(userId, taskId)
  if (!record)
    return null

  if (record.status === 'waiting' || record.status === 'submitting') {
    const queuePosition = record.status === 'waiting'
      ? await getWaitingQueuePosition(record.id)
      : null

    return {
      record,
      progress: 0,
      videoUrl: undefined,
      error: undefined,
      queuePosition: queuePosition ?? undefined,
    }
  }

  const apiTaskId = getSeedanceApiTaskId(record)
  if (!apiTaskId)
    return null

  const remote = await getSeedanceTask(apiTaskId)
  const progress = extractSeedanceTaskProgress(remote)
  const remoteVideoUrl = remote.content?.video_url ?? null
  const previousStatus = record.status

  const [updated] = await db
    .update(seedanceTasks)
    .set({
      status: remote.status,
      progress,
      remoteVideoUrl,
      videoUrl: record.videoUrl ?? remoteVideoUrl,
      errorMessage: remote.error?.message ?? null,
      updatedAt: new Date(),
    })
    .where(eq(seedanceTasks.id, record.id))
    .returning()

  if (
    previousStatus !== remote.status
    && (remote.status === 'succeeded' || remote.status === 'failed' || remote.status === 'cancelled')
  ) {
    scheduleSeedanceQueueProcessing()
  }

  if (previousStatus !== 'failed' && remote.status === 'failed') {
    const submitPayload = record.submitPayload as SeedanceTaskSubmitPayload | null
    await refundCreditsForReviewFailedTask({
      userId: record.userId,
      taskId: record.taskId,
      model: record.model,
      creditCost: submitPayload?.creditCost,
      errorMessage: updated.errorMessage ?? remote.error?.message,
    })
  }

  return {
    record: updated,
    progress,
    videoUrl: updated.videoUrl ?? updated.remoteVideoUrl ?? undefined,
    error: updated.errorMessage ?? undefined,
    errorCode: remote.error?.code ?? undefined,
  }
}

export async function seedanceTaskRecordToListItem(
  record: SeedanceTaskRecord,
  options?: { errorCode?: string },
): Promise<SeedanceTaskListItem> {
  const videoUrl = record.videoUrl ?? record.remoteVideoUrl ?? undefined
  const queuePosition = record.status === 'waiting'
    ? await getWaitingQueuePosition(record.id)
    : undefined

  return {
    id: record.taskId,
    model: record.model ?? undefined,
    status: record.status as SeedanceTaskStatus,
    content: videoUrl ? { video_url: videoUrl } : undefined,
    error: record.errorMessage
      ? {
          message: record.errorMessage,
          ...(options?.errorCode ? { code: options.errorCode } : {}),
        }
      : undefined,
    created_at: record.createdAt.getTime(),
    updated_at: record.updatedAt.getTime(),
    progress: record.progress ?? undefined,
    prompt: record.prompt ?? undefined,
    nodeTitle: record.nodeTitle ?? undefined,
    workflowId: record.workflowId ?? undefined,
    nodeId: record.nodeId ?? undefined,
    progressStartedAt: record.progressStartedAt ?? undefined,
    queuePosition: queuePosition ?? undefined,
  }
}
