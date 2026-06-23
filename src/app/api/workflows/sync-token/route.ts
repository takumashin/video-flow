import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { createWorkflowSyncToken, resolveWorkflowWsUrl } from '@/lib/workflow-sync/token'

export async function GET(request: Request) {
  try {
    const { userId, workspaceId, user } = await requireAuth()
    const { token, expiresAt } = createWorkflowSyncToken({
      userId,
      userName: user.name?.trim() || user.email || '协作者',
      userImage: user.image ?? null,
      workspaceId,
    })

    return NextResponse.json({
      token,
      wsUrl: resolveWorkflowWsUrl(request.headers.get('host')),
      expiresAt,
      user: {
        id: userId,
        name: user.name?.trim() || user.email || '协作者',
        image: user.image ?? null,
      },
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
