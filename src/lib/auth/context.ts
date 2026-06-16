import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getWorkspaceMembership } from '@/lib/workspace/service'
import type { WorkspacePermission } from '@/lib/workspace/permissions'
import { canPerform } from '@/lib/workspace/permissions'

export class AuthError extends Error {
  status: number

  constructor(message: string, status = 401) {
    super(message)
    this.name = 'AuthError'
    this.status = status
  }
}

export async function requireAuth(options?: {
  workspaceId?: string
  permission?: WorkspacePermission
}) {
  const session = await auth()

  if (!session?.user?.id)
    throw new AuthError('请先登录')

  const workspaceId = options?.workspaceId ?? session.activeWorkspaceId
  if (!workspaceId)
    throw new AuthError('未找到工作空间，请刷新页面或联系管理员', 400)

  const membership = await getWorkspaceMembership(
    session.user.id,
    workspaceId,
  )

  if (!membership)
    throw new AuthError('无权访问当前工作空间', 403)

  if (options?.permission && !canPerform(membership.role, options.permission))
    throw new AuthError('当前角色无权执行此操作', 403)

  return {
    userId: session.user.id,
    workspaceId,
    role: membership.role,
    user: session.user,
    workspaceName: membership.name,
  }
}

export async function requireWorkspaceAccess(userId: string, workspaceId: string) {
  const membership = await getWorkspaceMembership(userId, workspaceId)
  if (!membership)
    throw new AuthError('无权访问该工作空间', 403)

  return membership
}

export async function requireWorkspacePermission(
  userId: string,
  workspaceId: string,
  permission: WorkspacePermission,
) {
  const membership = await requireWorkspaceAccess(userId, workspaceId)
  if (!canPerform(membership.role, permission))
    throw new AuthError('当前角色无权执行此操作', 403)

  return membership
}

export function authErrorResponse(error: unknown) {
  if (error instanceof AuthError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  const message = error instanceof Error ? error.message : '服务器错误'
  const status = message.includes('无权') || message.includes('只有') ? 403 : 500
  return NextResponse.json({ error: message }, { status })
}
