import { v4 as uuidv4 } from 'uuid'
import { and, desc, eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  userPreferences,
  workspaceMembers,
  workspaces,
  type WorkspaceRole,
} from '@/db/schema'

export type WorkspaceSummary = {
  id: string
  name: string
  slug: string
  role: WorkspaceRole
  createdAt: Date
}

function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fff]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
  return `${base || 'workspace'}-${uuidv4().slice(0, 8)}`
}

export async function createWorkspaceForUser(
  userId: string,
  name: string,
  role: WorkspaceRole = 'owner',
) {
  const [workspace] = await db
    .insert(workspaces)
    .values({
      name: name.trim() || '未命名工作空间',
      slug: slugify(name),
    })
    .returning()

  await db.insert(workspaceMembers).values({
    workspaceId: workspace.id,
    userId,
    role,
  })

  return workspace
}

export async function createDefaultWorkspaceForUser(userId: string, userName?: string | null) {
  const name = userName?.trim()
    ? `${userName.trim()} 的工作空间`
    : '我的工作空间'

  const workspace = await createWorkspaceForUser(userId, name, 'owner')
  await setActiveWorkspace(userId, workspace.id)
  return workspace
}

export async function listUserWorkspaces(userId: string): Promise<WorkspaceSummary[]> {
  const rows = await db
    .select({
      id: workspaces.id,
      name: workspaces.name,
      slug: workspaces.slug,
      role: workspaceMembers.role,
      createdAt: workspaces.createdAt,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(eq(workspaceMembers.userId, userId))
    .orderBy(desc(workspaces.updatedAt))

  return rows
}

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  const [row] = await db
    .select({
      workspaceId: workspaceMembers.workspaceId,
      role: workspaceMembers.role,
      name: workspaces.name,
      slug: workspaces.slug,
    })
    .from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
    .where(and(
      eq(workspaceMembers.userId, userId),
      eq(workspaceMembers.workspaceId, workspaceId),
    ))
    .limit(1)

  return row ?? null
}

export async function setActiveWorkspace(userId: string, workspaceId: string) {
  await db
    .insert(userPreferences)
    .values({ userId, activeWorkspaceId: workspaceId })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { activeWorkspaceId: workspaceId },
    })
}

export async function getActiveWorkspaceId(userId: string): Promise<string | null> {
  const [prefs] = await db
    .select({ activeWorkspaceId: userPreferences.activeWorkspaceId })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  if (prefs?.activeWorkspaceId)
    return prefs.activeWorkspaceId

  const userWorkspaces = await listUserWorkspaces(userId)
  const first = userWorkspaces[0]
  if (!first)
    return null

  await setActiveWorkspace(userId, first.id)
  return first.id
}

export async function ensureUserHasWorkspace(userId: string, userName?: string | null) {
  const existing = await listUserWorkspaces(userId)
  if (existing.length > 0) {
    const activeId = await getActiveWorkspaceId(userId)
    if (activeId)
      return activeId
    await setActiveWorkspace(userId, existing[0].id)
    return existing[0].id
  }

  const workspace = await createDefaultWorkspaceForUser(userId, userName)
  return workspace.id
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const [workspace] = await db
    .update(workspaces)
    .set({ name: name.trim() || '未命名工作空间', updatedAt: new Date() })
    .where(eq(workspaces.id, workspaceId))
    .returning()

  return workspace ?? null
}

export async function deleteWorkspace(workspaceId: string) {
  const result = await db
    .delete(workspaces)
    .where(eq(workspaces.id, workspaceId))
    .returning({ id: workspaces.id })

  return result.length > 0
}
