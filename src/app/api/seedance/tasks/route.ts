import { NextResponse } from 'next/server'
import { buildSeedanceTaskPayload, createSeedanceTask, getSeedanceConfig, listSeedanceTasks, pollSeedanceTask } from '@/lib/seedance'
import { prepareAudiosForMode, prepareImagesForMode, prepareVideosForMode } from '@/lib/seedance-modes'
import { buildSeedanceApiVideoParamsFromRequest } from '@/lib/seedance-params'
import { resolveSeedanceModel } from '@/lib/seedance-models'
import { resolveImageUrlForApi, resolveMediaUrlForApi } from '@/lib/uploads'
import { saveVideoFromUrl } from '@/lib/video-storage'
import type {
  AudioContentItem,
  ImageContentItem,
  SeedanceCreateTaskRequest,
  SeedanceGenerationMode,
  SeedanceTaskStatus,
  VideoContentItem,
} from '@/lib/types'

const VALID_STATUSES: SeedanceTaskStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
]

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      prompt,
      images,
      videos,
      audios,
      generationMode = 'text_to_video',
      model,
      waitForResult = true,
    } = body

    if (!prompt?.trim()) {
      return NextResponse.json({ error: '提示词不能为空' }, { status: 400 })
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

      const resolvedUrl = await resolveMediaUrlForApi(item.videoUrl, '视频')

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
    const payload = buildSeedanceTaskPayload(resolvedModel, prompt, content, videoParams)

    const { id } = await createSeedanceTask(payload)

    if (!waitForResult) {
      return NextResponse.json({ taskId: id, status: 'queued' })
    }

    const result = await pollSeedanceTask(id)

    if (result.status !== 'succeeded') {
      return NextResponse.json({
        taskId: id,
        status: result.status,
        error: result.error?.message || '视频生成失败',
      }, { status: 500 })
    }

    const remoteVideoUrl = result.content?.video_url
    if (!remoteVideoUrl) {
      return NextResponse.json({
        taskId: id,
        status: result.status,
        error: '生成成功但未返回视频地址',
      }, { status: 500 })
    }

    let videoUrl = remoteVideoUrl
    try {
      const saved = await saveVideoFromUrl(remoteVideoUrl)
      videoUrl = saved.url
    }
    catch (saveError) {
      console.error('保存视频到本地失败，将使用远程 URL:', saveError)
    }

    return NextResponse.json({
      taskId: id,
      status: result.status,
      videoUrl,
      remoteVideoUrl,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const pageNum = Math.max(1, Number(searchParams.get('page_num') ?? searchParams.get('pageNum') ?? 1))
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('page_size') ?? searchParams.get('pageSize') ?? 20)))
    const statusParam = searchParams.get('filter.status') ?? searchParams.get('status') ?? ''
    const status = VALID_STATUSES.includes(statusParam as SeedanceTaskStatus)
      ? (statusParam as SeedanceTaskStatus)
      : undefined

    const taskIds = searchParams.getAll('filter.task_ids')
    if (taskIds.length === 0) {
      const single = searchParams.get('task_ids')
      if (single)
        taskIds.push(...single.split(',').map(id => id.trim()).filter(Boolean))
    }

    const result = await listSeedanceTasks({
      pageNum,
      pageSize,
      status: status ?? '',
      taskIds: taskIds.length > 0 ? taskIds : undefined,
    })

    return NextResponse.json(result)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
