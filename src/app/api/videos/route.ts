import { NextResponse } from 'next/server'
import { saveVideoFromUrl } from '@/lib/video-storage'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : ''

    if (!sourceUrl)
      return NextResponse.json({ error: 'sourceUrl 不能为空' }, { status: 400 })

    const saved = await saveVideoFromUrl(sourceUrl)
    return NextResponse.json({ videoUrl: saved.url, id: saved.id })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '保存失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
