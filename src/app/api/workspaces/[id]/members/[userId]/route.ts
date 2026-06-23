import { NextResponse } from 'next/server'
import type { WorkspaceRole } from '@/db/schema'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import {
  removeWorkspaceMember,
  updateWorkspaceMemberRole,
} from '@/lib/workspace/members'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const { id, userId: targetUserId } = await params
    const auth = await requireAuth({ workspaceId: id, permission: 'manage_members' })
    const body = await request.json()
    const role = body.role as WorkspaceRole

    if (role !== 'admin' && role !== 'member')
      return NextResponse.json({ error: '无效的角色' }, { status: 400 })

    await updateWorkspaceMemberRole(id, targetUserId, role, auth.role)
    return NextResponse.json({ success: true })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; userId: string }> },
) {
  try {
    const { id, userId: targetUserId } = await params
    const auth = await requireAuth({ workspaceId: id, permission: 'manage_members' })

    await removeWorkspaceMember(id, targetUserId, auth.role)
    return NextResponse.json({ success: true })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
