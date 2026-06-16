import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import {
  deleteWorkspaceForUser,
  renameWorkspaceForUser,
} from '@/lib/workspace/members'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const { userId } = await requireAuth({ workspaceId: id, permission: 'rename_workspace' })
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name)
      return NextResponse.json({ error: '请填写工作空间名称' }, { status: 400 })

    const workspace = await renameWorkspaceForUser(id, userId, name)
    return NextResponse.json({ workspace })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const auth = await requireAuth({ workspaceId: id, permission: 'delete_workspace' })
    const result = await deleteWorkspaceForUser(id, auth.userId)
    return NextResponse.json({ success: true, ...result })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
