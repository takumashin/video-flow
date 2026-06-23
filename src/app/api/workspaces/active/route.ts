import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getWorkspaceMembership, setActiveWorkspace } from '@/lib/workspace/service'

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth()
    const body = await request.json()
    const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId : ''

    if (!workspaceId)
      return NextResponse.json({ error: '缺少 workspaceId' }, { status: 400 })

    const membership = await getWorkspaceMembership(userId, workspaceId)
    if (!membership)
      return NextResponse.json({ error: '无权访问该工作空间' }, { status: 403 })

    await setActiveWorkspace(userId, workspaceId)

    return NextResponse.json({
      success: true,
      workspace: {
        id: membership.workspaceId,
        name: membership.name,
        slug: membership.slug,
        role: membership.role,
      },
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
