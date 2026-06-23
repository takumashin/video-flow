import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { createByteRangeResponse } from '@/lib/http-byte-range'
import { getMimeTypeFromFilename, moveUploadToFolder, readUpload } from '@/lib/uploads'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id } = await params
    const file = await readUpload(id, workspaceId)

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    const mimeType = getMimeTypeFromFilename(id)

    return createByteRangeResponse(file.buffer, request, {
      'Content-Type': mimeType,
      'Cache-Control': 'public, max-age=31536000, immutable',
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const folderId = body.folderId === null
      ? null
      : typeof body.folderId === 'string' && body.folderId.trim()
        ? body.folderId.trim()
        : undefined

    if (folderId === undefined)
      return NextResponse.json({ error: '请提供 folderId' }, { status: 400 })

    const moved = await moveUploadToFolder(id, workspaceId, folderId)
    if (!moved)
      return NextResponse.json({ error: '文件或文件夹不存在' }, { status: 404 })

    return NextResponse.json({ ok: true, folderId })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
