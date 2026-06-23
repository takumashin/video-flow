import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import {
  createWorkspaceForUser,
  listUserWorkspaces,
} from '@/lib/workspace/service'

export async function GET() {
  try {
    const { userId } = await requireAuth()
    const workspaces = await listUserWorkspaces(userId)
    return NextResponse.json({ workspaces })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { userId } = await requireAuth()
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name)
      return NextResponse.json({ error: '请填写工作空间名称' }, { status: 400 })

    const workspace = await createWorkspaceForUser(userId, name, 'owner')
    return NextResponse.json({
      workspace: {
        id: workspace.id,
        name: workspace.name,
        slug: workspace.slug,
        role: 'owner' as const,
        createdAt: workspace.createdAt,
      },
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
