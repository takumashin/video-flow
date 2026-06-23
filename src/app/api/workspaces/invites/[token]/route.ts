import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { authErrorResponse } from '@/lib/auth/context'
import { acceptWorkspaceInvite, getInviteByToken } from '@/lib/workspace/members'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const { token } = await params
    const invite = await getInviteByToken(token)
    if (!invite)
      return NextResponse.json({ error: '邀请无效或已过期' }, { status: 404 })

    return NextResponse.json({
      invite: {
        inviteChannel: invite.inviteChannel,
        email: invite.email,
        displayName: invite.displayName,
        role: invite.role,
        workspaceName: invite.workspaceName,
        expiresAt: invite.expiresAt,
      },
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { token } = await params
    const result = await acceptWorkspaceInvite(token, session.user.id)
    return NextResponse.json({ success: true, ...result })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
