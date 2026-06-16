import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { createWorkflowSyncToken, getWorkflowWsUrl } from '@/lib/workflow-sync/token'

export async function GET() {
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
      wsUrl: getWorkflowWsUrl(),
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
