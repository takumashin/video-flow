import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import {
  createWorkspaceInviteLink,
  listWorkspaceInvites,
  listWorkspaceMembers,
} from '@/lib/workspace/members'
import { isFeishuAppConfigured } from '@/lib/feishu/app-client'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    await requireAuth({ workspaceId: id, permission: 'manage_members' })

    const [members, invites] = await Promise.all([
      listWorkspaceMembers(id),
      listWorkspaceInvites(id),
    ])

    return NextResponse.json({
      members,
      invites,
      linkInviteEnabled: isFeishuAppConfigured(),
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const auth = await requireAuth({ workspaceId: id, permission: 'invite_members' })

    if (!isFeishuAppConfigured()) {
      return NextResponse.json({
        error: '飞书登录未配置，无法生成协作邀请链接。请先配置 AUTH_FEISHU_APP_ID / AUTH_FEISHU_APP_SECRET',
      }, { status: 503 })
    }

    const body = await request.json()
    const role = body.role === 'admin' ? 'admin' : 'member'

    const result = await createWorkspaceInviteLink({
      workspaceId: id,
      role,
      invitedBy: auth.userId,
    })

    return NextResponse.json({ success: true, result })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
