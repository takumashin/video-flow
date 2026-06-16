import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { saveVideoFromUrl } from '@/lib/video-storage'

export async function POST(request: Request) {
  try {
    const { workspaceId, userId } = await requireAuth()
    const body = await request.json()
    const sourceUrl = typeof body.sourceUrl === 'string' ? body.sourceUrl.trim() : ''
    const sourceTaskId = typeof body.sourceTaskId === 'string' ? body.sourceTaskId : undefined

    if (!sourceUrl)
      return NextResponse.json({ error: 'sourceUrl 不能为空' }, { status: 400 })

    const saved = await saveVideoFromUrl(sourceUrl, workspaceId, userId, sourceTaskId)
    return NextResponse.json({ videoUrl: saved.url, id: saved.id })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
