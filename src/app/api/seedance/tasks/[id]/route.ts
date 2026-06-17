import { NextResponse } from 'next/server'
import { resolveSeedanceDisplayProgress } from '@/lib/seedance-progress'
import { formatSeedanceUserError } from '@/lib/seedance-error-messages'
import {
  cancelSeedanceTaskForUser,
  getSeedanceTaskRecordForUser,
  SeedanceTaskNotCancellableError,
  syncSeedanceTaskRecordFromApi,
  upsertSeedanceTaskRecord,
} from '@/lib/seedance-task/service'
import { scheduleSeedanceQueueProcessing } from '@/lib/seedance-queue/service'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import type { SeedanceTaskStatus } from '@/lib/types'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { userId, workspaceId } = await requireAuth()
    const { id } = await params

    scheduleSeedanceQueueProcessing()

    const record = await getSeedanceTaskRecordForUser(userId, id)
    if (!record)
      return NextResponse.json({ error: '任务不存在或无权访问' }, { status: 404 })

    let synced
    try {
      synced = await syncSeedanceTaskRecordFromApi(userId, id)
    }
    catch (error) {
      if (record.status === 'failed' || record.status === 'cancelled') {
        synced = {
          record,
          progress: record.progress ?? 0,
          videoUrl: record.videoUrl ?? record.remoteVideoUrl ?? undefined,
          error: record.errorMessage ?? undefined,
          queuePosition: undefined,
        }
      }
      else {
        throw error
      }
    }

    const latest = synced?.record ?? record
    const progressStartedAt = latest.progressStartedAt ?? latest.createdAt.getTime()

    let displayProgress = latest.progress ?? synced?.progress
    if (latest.status === 'waiting' || latest.status === 'submitting') {
      displayProgress = 0
    }
    else {
      displayProgress = resolveSeedanceDisplayProgress({
        startedAtMs: progressStartedAt,
        status: latest.status as SeedanceTaskStatus,
        storedProgress: latest.progress ?? synced?.progress,
      })
    }

    if (displayProgress != null && displayProgress !== latest.progress) {
      await upsertSeedanceTaskRecord({
        userId,
        workspaceId,
        taskId: id,
        progress: displayProgress,
      })
    }

    return NextResponse.json({
      taskId: latest.taskId,
      status: latest.status as SeedanceTaskStatus,
      progress: displayProgress ?? latest.progress ?? undefined,
      videoUrl: latest.videoUrl ?? latest.remoteVideoUrl ?? synced?.videoUrl,
      error: formatSeedanceUserError(
        latest.errorMessage ?? synced?.error,
        synced?.errorCode,
      ) ?? latest.errorMessage ?? synced?.error,
      errorCode: synced?.errorCode,
      createdAt: latest.createdAt.getTime(),
      updatedAt: latest.updatedAt.getTime(),
      prompt: latest.prompt ?? undefined,
      nodeTitle: latest.nodeTitle ?? undefined,
      workflowId: latest.workflowId ?? undefined,
      nodeId: latest.nodeId ?? undefined,
      progressStartedAt,
      queuePosition: synced?.queuePosition,
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { userId, workspaceId } = await requireAuth()
    const { id } = await params
    const body = await request.json()

    const record = await getSeedanceTaskRecordForUser(userId, id)
    if (!record)
      return NextResponse.json({ error: '任务不存在或无权访问' }, { status: 404 })

    const updated = await upsertSeedanceTaskRecord({
      userId,
      workspaceId,
      taskId: id,
      prompt: typeof body.prompt === 'string' ? body.prompt : undefined,
      nodeTitle: typeof body.nodeTitle === 'string' ? body.nodeTitle : undefined,
      workflowId: typeof body.workflowId === 'string' ? body.workflowId : undefined,
      nodeId: typeof body.nodeId === 'string' ? body.nodeId : undefined,
      status: body.status,
      progress: typeof body.progress === 'number' ? body.progress : undefined,
      videoUrl: typeof body.videoUrl === 'string' ? body.videoUrl : undefined,
      remoteVideoUrl: typeof body.remoteVideoUrl === 'string' ? body.remoteVideoUrl : undefined,
      errorMessage: typeof body.errorMessage === 'string' ? body.errorMessage : undefined,
      progressStartedAt: typeof body.progressStartedAt === 'number' ? body.progressStartedAt : undefined,
    })

    if (body.status === 'succeeded' || body.status === 'failed' || body.status === 'cancelled')
      scheduleSeedanceQueueProcessing()

    return NextResponse.json({
      taskId: updated.taskId,
      status: updated.status,
      progress: updated.progress ?? undefined,
      videoUrl: updated.videoUrl ?? updated.remoteVideoUrl ?? undefined,
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
  try {
    const { userId } = await requireAuth()
    const { id } = await params

    const updated = await cancelSeedanceTaskForUser(userId, id)
    if (!updated)
      return NextResponse.json({ error: '任务不存在或无权访问' }, { status: 404 })

    return NextResponse.json({
      taskId: updated.taskId,
      status: updated.status as SeedanceTaskStatus,
    })
  }
  catch (error) {
    if (error instanceof SeedanceTaskNotCancellableError) {
      return NextResponse.json({ error: error.message }, { status: 409 })
    }
    return authErrorResponse(error)
  }
}
