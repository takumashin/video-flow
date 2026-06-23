import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import {
  deleteAssetFolder,
  renameAssetFolder,
} from '@/lib/asset-folders/service'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name)
      return NextResponse.json({ error: '请填写文件夹名称' }, { status: 400 })

    const folder = await renameAssetFolder(id, workspaceId, name)
    if (!folder)
      return NextResponse.json({ error: '文件夹不存在' }, { status: 404 })

    return NextResponse.json({
      folder: {
        id: folder.id,
        name: folder.name,
        createdAt: folder.createdAt.getTime(),
        updatedAt: folder.updatedAt.getTime(),
      },
    })
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json({ error: '该文件夹名称已存在' }, { status: 409 })
    }
    return authErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id } = await params
    const deleted = await deleteAssetFolder(id, workspaceId)

    if (!deleted)
      return NextResponse.json({ error: '文件夹不存在' }, { status: 404 })

    return NextResponse.json({ ok: true })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
