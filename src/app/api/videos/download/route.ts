import { NextResponse } from 'next/server'
import {
  buildVideoDownloadFilename,
  isAllowedRemoteVideoUrl,
} from '@/lib/video-download'
import {
  extractVideoId,
  isLocalVideoUrl,
} from '@/lib/video-storage'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const sourceUrl = searchParams.get('url')?.trim()

    if (!sourceUrl) {
      return NextResponse.json({ error: '缺少视频地址' }, { status: 400 })
    }

    const taskId = searchParams.get('taskId') ?? undefined
    const createdAt = searchParams.get('createdAt')
      ? Number(searchParams.get('createdAt'))
      : undefined

    if (isLocalVideoUrl(sourceUrl)) {
      const id = extractVideoId(sourceUrl)!
      const redirectUrl = new URL(`/api/videos/${id}`, request.url)
      redirectUrl.searchParams.set('download', '1')
      if (taskId)
        redirectUrl.searchParams.set('taskId', taskId)
      if (createdAt != null)
        redirectUrl.searchParams.set('createdAt', String(createdAt))
      return NextResponse.redirect(redirectUrl)
    }

    if (!isAllowedRemoteVideoUrl(sourceUrl)) {
      return NextResponse.json({ error: '不支持下载该来源的视频地址' }, { status: 403 })
    }

    const response = await fetch(sourceUrl)
    if (!response.ok) {
      return NextResponse.json(
        { error: `下载视频失败 (${response.status})` },
        { status: 502 },
      )
    }

    const contentType = response.headers.get('content-type') ?? 'video/mp4'
    const buffer = Buffer.from(await response.arrayBuffer())
    const filename = buildVideoDownloadFilename({ taskId, createdAt })

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(buffer.length),
        'Content-Disposition': `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-cache',
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '下载失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
