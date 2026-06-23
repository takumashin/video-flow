import { randomBytes } from 'crypto'
import { and, desc, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import {
  users,
  workspaceInvites,
  workspaceMembers,
  workspaces,
  type WorkspaceInviteChannel,
  type WorkspaceRole,
} from '@/db/schema'
import { clearUserActiveWorkspace } from '@/lib/auth/config'
import { getFeishuIdentityForUser, userMatchesFeishuInvite } from '@/lib/feishu/user-link'
import {
  deleteWorkspace,
  getWorkspaceMembership,
  listUserWorkspaces,
  renameWorkspace,
  setActiveWorkspace,
} from '@/lib/workspace/service'
import { getAppBaseUrl } from '@/lib/email/send'

export type WorkspaceMemberItem = {
  userId: string
  name: string | null
  email: string
  image: string | null
  role: WorkspaceRole
  joinedAt: Date
}

export type WorkspaceInviteItem = {
  id: string
  inviteChannel: WorkspaceInviteChannel
  email: string | null
  feishuOpenId: string | null
  displayName: string | null
  role: 'admin' | 'member'
  invitedByName: string | null
  expiresAt: Date
  createdAt: Date
  token: string
  inviteUrl: string
}

export async function listWorkspaceMembers(workspaceId: string): Promise<WorkspaceMemberItem[]> {
  const rows = await db
    .select({
      userId: workspaceMembers.userId,
      role: workspaceMembers.role,
      joinedAt: workspaceMembers.joinedAt,
      name: users.name,
      email: users.email,
      image: users.image,
    })
    .from(workspaceMembers)
    .innerJoin(users, eq(users.id, workspaceMembers.userId))
    .where(eq(workspaceMembers.workspaceId, workspaceId))
    .orderBy(workspaceMembers.joinedAt)

  return rows
}

export async function listWorkspaceInvites(workspaceId: string): Promise<WorkspaceInviteItem[]> {
  const rows = await db
    .select({
      id: workspaceInvites.id,
      inviteChannel: workspaceInvites.inviteChannel,
      email: workspaceInvites.email,
      feishuOpenId: workspaceInvites.feishuOpenId,
      displayName: workspaceInvites.displayName,
      role: workspaceInvites.role,
      expiresAt: workspaceInvites.expiresAt,
      createdAt: workspaceInvites.createdAt,
      invitedByName: users.name,
      token: workspaceInvites.token,
    })
    .from(workspaceInvites)
    .innerJoin(users, eq(users.id, workspaceInvites.invitedBy))
    .where(and(
      eq(workspaceInvites.workspaceId, workspaceId),
      gt(workspaceInvites.expiresAt, new Date()),
    ))
    .orderBy(desc(workspaceInvites.createdAt))

  const baseUrl = getAppBaseUrl()
  return rows.map(row => ({
    ...row,
    inviteUrl: `${baseUrl}/invite/${row.token}`,
  }))
}

async function addMemberToWorkspace(
  workspaceId: string,
  userId: string,
  role: WorkspaceRole,
) {
  await db
    .insert(workspaceMembers)
    .values({ workspaceId, userId, role })
    .onConflictDoUpdate({
      target: [workspaceMembers.workspaceId, workspaceMembers.userId],
      set: { role },
    })
}

export async function createWorkspaceInviteLink(input: {
  workspaceId: string
  role: 'admin' | 'member'
  invitedBy: string
}) {
  const token = randomBytes(24).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
  const inviteUrl = `${getAppBaseUrl()}/invite/${token}`

  const invite = await db.transaction(async (tx) => {
    await tx
      .delete(workspaceInvites)
      .where(eq(workspaceInvites.workspaceId, input.workspaceId))

    const [created] = await tx
      .insert(workspaceInvites)
      .values({
        workspaceId: input.workspaceId,
        inviteChannel: 'feishu',
        displayName: '协作邀请链接',
        role: input.role,
        token,
        invitedBy: input.invitedBy,
        expiresAt,
      })
      .returning({ id: workspaceInvites.id })

    return created
  })

  return {
    type: 'link' as const,
    inviteId: invite.id,
    token,
    inviteUrl,
    expiresAt,
  }
}

export async function getInviteByToken(token: string) {
  const [invite] = await db
    .select({
      id: workspaceInvites.id,
      inviteChannel: workspaceInvites.inviteChannel,
      email: workspaceInvites.email,
      feishuOpenId: workspaceInvites.feishuOpenId,
      feishuUnionId: workspaceInvites.feishuUnionId,
      displayName: workspaceInvites.displayName,
      role: workspaceInvites.role,
      token: workspaceInvites.token,
      expiresAt: workspaceInvites.expiresAt,
      workspaceId: workspaceInvites.workspaceId,
      workspaceName: workspaces.name,
    })
    .from(workspaceInvites)
    .innerJoin(workspaces, eq(workspaces.id, workspaceInvites.workspaceId))
    .where(eq(workspaceInvites.token, token))
    .limit(1)

  if (!invite || invite.expiresAt <= new Date())
    return null

  return invite
}

export async function acceptWorkspaceInvite(token: string, userId: string) {
  const invite = await getInviteByToken(token)
  if (!invite)
    throw new Error('邀请无效或已过期')

  const [user] = await db
    .select({ email: users.email })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user)
    throw new Error('用户不存在')

  if (invite.inviteChannel === 'feishu') {
    const feishuAccountId = await getFeishuIdentityForUser(userId)
    if (!feishuAccountId)
      throw new Error('请使用飞书账号登录后再接受邀请')

    const isTargetedInvite = !!(invite.feishuOpenId || invite.feishuUnionId)
    if (isTargetedInvite) {
      const matched = await userMatchesFeishuInvite(userId, invite)
      if (!matched)
        throw new Error('此邀请链接仅限指定飞书账号使用')
    }
  }
  else {
    if (!invite.email)
      throw new Error('邀请信息不完整')

    if (user.email.trim().toLowerCase() !== invite.email.trim().toLowerCase())
      throw new Error('请使用被邀请的邮箱登录后再接受邀请')
  }

  const existing = await getWorkspaceMembership(userId, invite.workspaceId)
  if (existing)
    throw new Error('你已是该工作空间成员')

  await addMemberToWorkspace(invite.workspaceId, userId, invite.role)
  await db.delete(workspaceInvites).where(eq(workspaceInvites.id, invite.id))
  await setActiveWorkspace(userId, invite.workspaceId)

  return {
    workspaceId: invite.workspaceId,
    workspaceName: invite.workspaceName,
    role: invite.role,
  }
}

export async function removeWorkspaceMember(
  workspaceId: string,
  targetUserId: string,
  actorRole: WorkspaceRole,
) {
  const targetMembership = await getWorkspaceMembership(targetUserId, workspaceId)
  if (!targetMembership)
    throw new Error('成员不存在')

  if (targetMembership.role === 'owner')
    throw new Error('不能移除工作空间所有者')

  if (targetMembership.role === 'admin' && actorRole !== 'owner')
    throw new Error('只有所有者可以移除管理员')

  await db
    .delete(workspaceMembers)
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, targetUserId),
    ))

  await clearUserActiveWorkspace(targetUserId, workspaceId)
}

export async function updateWorkspaceMemberRole(
  workspaceId: string,
  targetUserId: string,
  role: WorkspaceRole,
  actorRole: WorkspaceRole,
) {
  if (role === 'owner')
    throw new Error('不能直接设置为所有者')

  const targetMembership = await getWorkspaceMembership(targetUserId, workspaceId)
  if (!targetMembership)
    throw new Error('成员不存在')

  if (targetMembership.role === 'owner')
    throw new Error('不能修改所有者角色')

  if (targetMembership.role === 'admin' && actorRole !== 'owner')
    throw new Error('只有所有者可以修改管理员角色')

  if (role === 'admin' && actorRole !== 'owner')
    throw new Error('只有所有者可以任命管理员')

  await db
    .update(workspaceMembers)
    .set({ role })
    .where(and(
      eq(workspaceMembers.workspaceId, workspaceId),
      eq(workspaceMembers.userId, targetUserId),
    ))
}

export async function cancelWorkspaceInvite(workspaceId: string, inviteId: string) {
  const result = await db
    .delete(workspaceInvites)
    .where(and(
      eq(workspaceInvites.workspaceId, workspaceId),
      eq(workspaceInvites.id, inviteId),
    ))
    .returning({ id: workspaceInvites.id })

  return result.length > 0
}

export async function renameWorkspaceForUser(
  workspaceId: string,
  userId: string,
  name: string,
) {
  const membership = await getWorkspaceMembership(userId, workspaceId)
  if (!membership)
    throw new Error('无权访问该工作空间')

  return renameWorkspace(workspaceId, name)
}

export async function deleteWorkspaceForUser(workspaceId: string, userId: string) {
  const membership = await getWorkspaceMembership(userId, workspaceId)
  if (!membership)
    throw new Error('无权访问该工作空间')

  if (membership.role !== 'owner')
    throw new Error('只有所有者可以删除工作空间')

  const userWorkspaces = await listUserWorkspaces(userId)
  if (userWorkspaces.length <= 1)
    throw new Error('至少保留一个工作空间，无法删除')

  const members = await listWorkspaceMembers(workspaceId)
  const deleted = await deleteWorkspace(workspaceId)
  if (!deleted)
    throw new Error('删除失败')

  for (const member of members)
    await clearUserActiveWorkspace(member.userId, workspaceId)

  const fallback = userWorkspaces.find(w => w.id !== workspaceId)
  if (fallback)
    await setActiveWorkspace(userId, fallback.id)

  return { fallbackWorkspaceId: fallback?.id ?? null }
}
