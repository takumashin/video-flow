import { NextResponse } from 'next/server'
import { buildVideoDownloadFilename } from '@/lib/video-download'
import { getMimeTypeFromVideoFilename, readVideo } from '@/lib/video-storage'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === '1'
    const taskId = searchParams.get('taskId') ?? undefined
    const createdAt = searchParams.get('createdAt')
      ? Number(searchParams.get('createdAt'))
      : undefined

    const file = await readVideo(id)

    if (!file) {
      return NextResponse.json({ error: '视频不存在' }, { status: 404 })
    }

    const mimeType = getMimeTypeFromVideoFilename(id)
    const headers: Record<string, string> = {
      'Content-Type': mimeType,
      'Content-Length': String(file.buffer.length),
    }

    if (download) {
      const filename = buildVideoDownloadFilename({ taskId, createdAt, videoId: id })
      headers['Content-Disposition'] = `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`
      headers['Cache-Control'] = 'private, no-cache'
    }
    else {
      headers['Cache-Control'] = 'public, max-age=31536000, immutable'
    }

    return new NextResponse(new Uint8Array(file.buffer), { headers })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
