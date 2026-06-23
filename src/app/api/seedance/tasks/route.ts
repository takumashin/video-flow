import { NextResponse } from 'next/server'
import { randomUUID } from 'node:crypto'
import { buildSeedanceTaskPayload, getSeedanceConfig, pollSeedanceTask } from '@/lib/seedance'
import { prepareAudiosForMode, prepareImagesForMode, prepareVideosForMode, validateSeedanceTaskRequest } from '@/lib/seedance-modes'
import { buildSeedanceApiVideoParamsFromRequest } from '@/lib/seedance-params'
import { getSeedanceGenerationCreditCost, resolveSeedanceModel } from '@/lib/seedance-models'
import {
  InsufficientCreditsError,
  refundCreditsForReviewFailedTask,
  spendCreditsForVideoGeneration,
} from '@/lib/credits/service'
import {
  createWaitingSeedanceTaskRecord,
  getSeedanceTaskRecordForUser,
  listActiveSeedanceTaskRecords,
  listSeedanceTaskRecords,
  seedanceTaskRecordToListItem,
  syncSeedanceTaskRecordFromApi,
  upsertSeedanceTaskRecord,
} from '@/lib/seedance-task/service'
import {
  getSeedanceApiTaskId,
  getWaitingQueuePosition,
  scheduleSeedanceQueueProcessing,
} from '@/lib/seedance-queue/service'
import type { SeedanceTaskSubmitPayload } from '@/lib/seedance-queue/types'
import { resolveImageUrlForApi, resolveMediaUrlForApi, resolveVideoUrlForApi } from '@/lib/uploads'
import { saveVideoFromUrl } from '@/lib/video-storage'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import type {
  AudioContentItem,
  ImageContentItem,
  SeedanceCreateTaskRequest,
  SeedanceGenerationMode,
  SeedanceTaskStatus,
  VideoContentItem,
} from '@/lib/types'

const VALID_STATUSES: SeedanceTaskStatus[] = [
  'waiting',
  'submitting',
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]

async function waitForTaskSubmission(userId: string, taskId: string, timeoutMs = 120_000) {
  const startedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    const record = await getSeedanceTaskRecordForUser(userId, taskId)
    if (!record)
      throw new Error('任务不存在')

    if (record.status === 'failed')
      throw new Error(record.errorMessage || '任务提交失败')

    if (record.status !== 'waiting' && record.status !== 'submitting')
      return record

    await new Promise(resolve => setTimeout(resolve, 500))
    scheduleSeedanceQueueProcessing()
  }

  throw new Error('排队超时，请稍后在任务队列中查看')
}

export async function POST(request: Request) {
  try {
    const { workspaceId, userId } = await requireAuth()
    const body = await request.json()
    const {
      prompt,
      images,
      videos,
      audios,
      generationMode = 'text_to_video',
      model,
      nodeTitle,
      workflowId,
      nodeId,
      waitForResult = true,
    } = body

    if (!prompt?.trim()) {
      return NextResponse.json({
        error: validateSeedanceTaskRequest({
          mode: generationMode as SeedanceGenerationMode,
          prompt,
        }) ?? '请填写文本描述',
      }, { status: 400 })
    }

    const { defaultModel } = getSeedanceConfig()
    const resolvedModel = resolveSeedanceModel(
      model,
      generationMode as SeedanceGenerationMode,
      defaultModel,
    )

    const content: SeedanceCreateTaskRequest['content'] = [
      {
        type: 'text',
        text: prompt.trim(),
      },
    ]

    const imageItems: ImageContentItem[] = prepareImagesForMode(
      generationMode as SeedanceGenerationMode,
      Array.isArray(images) ? images : [],
    )
    for (const item of imageItems) {
      if (!item?.imageUrl?.trim())
        continue

      const resolvedUrl = await resolveImageUrlForApi(item.imageUrl)

      content.push({
        type: 'image_url',
        image_url: { url: resolvedUrl },
        role: item.imageRole || 'first_frame',
      })
    }

    const videoItems: VideoContentItem[] = prepareVideosForMode(
      generationMode as SeedanceGenerationMode,
      Array.isArray(videos) ? videos : [],
    )
    for (const item of videoItems) {
      if (!item?.videoUrl?.trim())
        continue

      const resolvedUrl = await resolveVideoUrlForApi(item.videoUrl)

      content.push({
        type: 'video_url',
        video_url: { url: resolvedUrl },
        role: 'reference_video',
      })
    }

    const audioItems: AudioContentItem[] = prepareAudiosForMode(
      generationMode as SeedanceGenerationMode,
      Array.isArray(audios) ? audios : [],
    )
    for (const item of audioItems) {
      if (!item?.audioUrl?.trim())
        continue

      const resolvedUrl = await resolveMediaUrlForApi(item.audioUrl, '音频')

      content.push({
        type: 'audio_url',
        audio_url: { url: resolvedUrl },
        role: 'reference_audio',
      })
    }

    const videoParams = buildSeedanceApiVideoParamsFromRequest(body)
    const preparedImages = prepareImagesForMode(
      generationMode as SeedanceGenerationMode,
      imageItems,
    )
    const preparedVideos = prepareVideosForMode(
      generationMode as SeedanceGenerationMode,
      videoItems,
    )
    const preparedAudios = prepareAudiosForMode(
      generationMode as SeedanceGenerationMode,
      audioItems,
    )
    const requestValidationError = validateSeedanceTaskRequest({
      mode: generationMode as SeedanceGenerationMode,
      prompt: prompt.trim(),
      images: preparedImages,
      videos: preparedVideos,
      audios: preparedAudios,
    })
    if (requestValidationError) {
      return NextResponse.json({ error: requestValidationError }, { status: 400 })
    }

    const payload = buildSeedanceTaskPayload(resolvedModel, prompt, content, videoParams)
    const creditCost = getSeedanceGenerationCreditCost(resolvedModel, videoParams.resolution)
    const clientTaskId = randomUUID()

    try {
      await spendCreditsForVideoGeneration({
        userId,
        model: resolvedModel,
        taskId: clientTaskId,
        resolution: videoParams.resolution,
      })
    }
    catch (error) {
      if (error instanceof InsufficientCreditsError) {
        return NextResponse.json({
          error: error.message,
          code: 'INSUFFICIENT_CREDITS',
          balance: error.balance,
          required: error.required,
        }, { status: 402 })
      }
      throw error
    }

    const submitPayload: SeedanceTaskSubmitPayload = {
      request: payload,
      creditCost,
    }

    const record = await createWaitingSeedanceTaskRecord({
      userId,
      workspaceId,
      taskId: clientTaskId,
      prompt: prompt.trim(),
      nodeTitle: typeof nodeTitle === 'string' ? nodeTitle.trim() || null : null,
      workflowId: typeof workflowId === 'string' ? workflowId.trim() || null : null,
      nodeId: typeof nodeId === 'string' ? nodeId.trim() || null : null,
      model: resolvedModel,
      submitPayload,
    })

    scheduleSeedanceQueueProcessing()

    const queuePosition = await getWaitingQueuePosition(record.id)

    if (!waitForResult) {
      return NextResponse.json({
        taskId: clientTaskId,
        status: 'waiting',
        queuePosition,
        creditCost,
      })
    }

    const submitted = await waitForTaskSubmission(userId, clientTaskId)
    const apiTaskId = getSeedanceApiTaskId(submitted)
    if (!apiTaskId)
      throw new Error('任务提交异常，未获得 Seedance 任务 ID')

    const result = await pollSeedanceTask(apiTaskId)

    if (result.status !== 'succeeded') {
      const errorMessage = result.error?.message || '视频生成失败'
      await upsertSeedanceTaskRecord({
        userId,
        workspaceId,
        taskId: clientTaskId,
        status: result.status,
        errorMessage,
      })
      await refundCreditsForReviewFailedTask({
        userId,
        taskId: clientTaskId,
        model: resolvedModel,
        creditCost,
        errorMessage,
      })
      scheduleSeedanceQueueProcessing()

      return NextResponse.json({
        taskId: clientTaskId,
        status: result.status,
        error: errorMessage,
      }, { status: 500 })
    }

    const remoteVideoUrl = result.content?.video_url
    if (!remoteVideoUrl) {
      await upsertSeedanceTaskRecord({
        userId,
        workspaceId,
        taskId: clientTaskId,
        status: result.status,
        errorMessage: '生成成功但未返回视频地址',
      })
      scheduleSeedanceQueueProcessing()

      return NextResponse.json({
        taskId: clientTaskId,
        status: result.status,
        error: '生成成功但未返回视频地址',
      }, { status: 500 })
    }

    let videoUrl = remoteVideoUrl
    try {
      const saved = await saveVideoFromUrl(remoteVideoUrl, workspaceId, userId, clientTaskId)
      videoUrl = saved.url
    }
    catch (saveError) {
      console.error('保存视频到本地失败，将使用远程 URL:', saveError)
    }

    await upsertSeedanceTaskRecord({
      userId,
      workspaceId,
      taskId: clientTaskId,
      status: 'succeeded',
      progress: 100,
      videoUrl,
      remoteVideoUrl,
    })
    scheduleSeedanceQueueProcessing()

    return NextResponse.json({
      taskId: clientTaskId,
      status: result.status,
      videoUrl,
      remoteVideoUrl,
      creditCost,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { userId, workspaceId } = await requireAuth()
    const { searchParams } = new URL(request.url)
    const pageNum = Math.max(1, Number(searchParams.get('page_num') ?? searchParams.get('pageNum') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('page_size') ?? searchParams.get('pageSize') ?? 20)))
    const statusParam = searchParams.get('filter.status') ?? searchParams.get('status') ?? ''
    const activeOnly = searchParams.get('active') === 'true'

    if (activeOnly) {
      const activeItems = await listActiveSeedanceTaskRecords({ userId, workspaceId })

      const syncResults = await Promise.allSettled(
        activeItems
          .filter(item => item.status !== 'waiting' && item.status !== 'submitting')
          .map(item => syncSeedanceTaskRecordFromApi(userId, item.taskId)),
      )

      scheduleSeedanceQueueProcessing()

      const refreshed = await listActiveSeedanceTaskRecords({ userId, workspaceId })
      const errorCodeByTaskId = new Map<string, string>()
      for (const result of syncResults) {
        if (result.status === 'fulfilled' && result.value?.errorCode)
          errorCodeByTaskId.set(result.value.record.taskId, result.value.errorCode)
      }

      return NextResponse.json({
        total: refreshed.length,
        items: await Promise.all(refreshed.map(record => seedanceTaskRecordToListItem(
          record,
          { errorCode: errorCodeByTaskId.get(record.taskId) },
        ))),
      })
    }

    const status = VALID_STATUSES.includes(statusParam as SeedanceTaskStatus)
      ? (statusParam as SeedanceTaskStatus)
      : undefined

    const result = await listSeedanceTaskRecords({
      userId,
      workspaceId,
      pageNum,
      pageSize,
      status,
    })

    const activeItems = result.items.filter(item =>
      item.status === 'queued' || item.status === 'running',
    )

    const syncResults = await Promise.allSettled(
      activeItems.map(item => syncSeedanceTaskRecordFromApi(userId, item.taskId)),
    )

    scheduleSeedanceQueueProcessing()

    const refreshed = activeItems.length > 0
      ? await listSeedanceTaskRecords({
          userId,
          workspaceId,
          pageNum,
          pageSize,
          status,
        })
      : result

    const errorCodeByTaskId = new Map<string, string>()
    for (const syncResult of syncResults) {
      if (syncResult.status === 'fulfilled' && syncResult.value?.errorCode)
        errorCodeByTaskId.set(syncResult.value.record.taskId, syncResult.value.errorCode)
    }

    return NextResponse.json({
      total: refreshed.total,
      items: await Promise.all(refreshed.items.map(record => seedanceTaskRecordToListItem(
        record,
        { errorCode: errorCodeByTaskId.get(record.taskId) },
      ))),
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
