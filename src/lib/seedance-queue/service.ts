import { and, asc, count, eq, inArray, lt, or } from 'drizzle-orm'
import { db } from '@/db'
import { seedanceTasks } from '@/db/schema'
import { createSeedanceTask } from '@/lib/seedance'
import { refundCreditsForTask } from '@/lib/credits/service'
import { getModelOption } from '@/lib/seedance-models'
import type { SeedanceTaskRecord } from '@/lib/seedance-task/service'
import { getSeedanceMaxConcurrency } from '@/lib/seedance-queue/config'
import type { SeedanceTaskSubmitPayload } from '@/lib/seedance-queue/types'

const API_ACTIVE_STATUSES = ['submitting', 'queued', 'running'] as const

let processing = false
let processScheduled = false

export function getSeedanceApiTaskId(record: Pick<typeof seedanceTasks.$inferSelect, 'taskId' | 'apiTaskId' | 'status'>): string | null {
  if (record.apiTaskId)
    return record.apiTaskId

  if (record.status === 'waiting')
    return null

  return record.taskId
}

export async function countActiveSeedanceApiTasks(): Promise<number> {
  const [row] = await db
    .select({ count: count() })
    .from(seedanceTasks)
    .where(inArray(seedanceTasks.status, [...API_ACTIVE_STATUSES]))

  return row?.count ?? 0
}

export async function getWaitingQueuePosition(recordId: string): Promise<number | null> {
  const [target] = await db
    .select({ createdAt: seedanceTasks.createdAt })
    .from(seedanceTasks)
    .where(and(
      eq(seedanceTasks.id, recordId),
      eq(seedanceTasks.status, 'waiting'),
    ))
    .limit(1)

  if (!target)
    return null

  const [row] = await db
    .select({ count: count() })
    .from(seedanceTasks)
    .where(and(
      eq(seedanceTasks.status, 'waiting'),
      or(
        lt(seedanceTasks.createdAt, target.createdAt),
        and(
          eq(seedanceTasks.createdAt, target.createdAt),
          lt(seedanceTasks.id, recordId),
        ),
      ),
    ))

  return (row?.count ?? 0) + 1
}

async function claimNextWaitingTask(): Promise<SeedanceTaskRecord | null> {
  return db.transaction(async (tx) => {
    const active = await tx
      .select({ count: count() })
      .from(seedanceTasks)
      .where(inArray(seedanceTasks.status, [...API_ACTIVE_STATUSES]))

    if ((active[0]?.count ?? 0) >= getSeedanceMaxConcurrency())
      return null

    const rows = await tx
      .select()
      .from(seedanceTasks)
      .where(eq(seedanceTasks.status, 'waiting'))
      .orderBy(asc(seedanceTasks.createdAt), asc(seedanceTasks.id))
      .limit(1)
      .for('update', { skipLocked: true })

    const next = rows[0]
    if (!next)
      return null

    const [claimed] = await tx
      .update(seedanceTasks)
      .set({
        status: 'submitting',
        updatedAt: new Date(),
      })
      .where(eq(seedanceTasks.id, next.id))
      .returning()

    return claimed ?? null
  })
}

async function submitWaitingTask(record: SeedanceTaskRecord): Promise<void> {
  const [fresh] = await db
    .select()
    .from(seedanceTasks)
    .where(eq(seedanceTasks.id, record.id))
    .limit(1)

  if (!fresh || fresh.status !== 'submitting')
    return

  const payload = fresh.submitPayload as SeedanceTaskSubmitPayload | null
  if (!payload?.request) {
    await db
      .update(seedanceTasks)
      .set({
        status: 'failed',
        errorMessage: '排队任务缺少提交参数',
        updatedAt: new Date(),
      })
      .where(eq(seedanceTasks.id, fresh.id))
    return
  }

  try {
    const created = await createSeedanceTask(payload.request)

    const [stillSubmitting] = await db
      .select({ status: seedanceTasks.status })
      .from(seedanceTasks)
      .where(eq(seedanceTasks.id, fresh.id))
      .limit(1)

    if (stillSubmitting?.status !== 'submitting')
      return

    await db
      .update(seedanceTasks)
      .set({
        apiTaskId: created.id,
        status: 'queued',
        progress: 0,
        progressStartedAt: Date.now(),
        submitPayload: null,
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(seedanceTasks.id, fresh.id))
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '提交 Seedance 任务失败'

    await db
      .update(seedanceTasks)
      .set({
        status: 'failed',
        errorMessage: message,
        submitPayload: null,
        updatedAt: new Date(),
      })
      .where(eq(seedanceTasks.id, fresh.id))

    if (payload.creditCost > 0) {
      await refundCreditsForTask({
        userId: fresh.userId,
        amount: payload.creditCost,
        taskId: fresh.taskId,
        model: fresh.model ?? undefined,
        description: `排队提交失败退还 · ${getModelOption(fresh.model ?? '')?.label ?? fresh.model ?? 'Seedance'}`,
      }).catch(refundError => {
        console.error('[seedance-queue] 提交失败后退还点数失败:', refundError)
      })
    }
  }
}

export async function processSeedanceQueue(): Promise<void> {
  if (processing) {
    processScheduled = true
    return
  }

  processing = true

  try {
    while (true) {
      const claimed = await claimNextWaitingTask()
      if (!claimed)
        break

      await submitWaitingTask(claimed)
    }
  }
  finally {
    processing = false
    if (processScheduled) {
      processScheduled = false
      void processSeedanceQueue()
    }
  }
}

export function scheduleSeedanceQueueProcessing(): void {
  void processSeedanceQueue()
}

export async function getSeedanceQueueStats() {
  const maxConcurrency = getSeedanceMaxConcurrency()
  const activeCount = await countActiveSeedanceApiTasks()

  const [waitingRow] = await db
    .select({ count: count() })
    .from(seedanceTasks)
    .where(eq(seedanceTasks.status, 'waiting'))

  return {
    maxConcurrency,
    activeCount,
    waitingCount: waitingRow?.count ?? 0,
    availableSlots: Math.max(0, maxConcurrency - activeCount),
  }
}

export async function markTaskFinishedAndDrainQueue(taskId: string): Promise<void> {
  await db
    .update(seedanceTasks)
    .set({ updatedAt: new Date() })
    .where(eq(seedanceTasks.taskId, taskId))

  scheduleSeedanceQueueProcessing()
}
