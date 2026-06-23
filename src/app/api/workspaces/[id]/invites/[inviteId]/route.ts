import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { cancelWorkspaceInvite } from '@/lib/workspace/members'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; inviteId: string }> },
) {
  try {
    const { id, inviteId } = await params
    await requireAuth({ workspaceId: id, permission: 'manage_members' })

    const cancelled = await cancelWorkspaceInvite(id, inviteId)
    if (!cancelled)
      return NextResponse.json({ error: '邀请不存在' }, { status: 404 })

    return NextResponse.json({ success: true })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
