import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { userPreferences } from '@/db/schema'

export async function getLastWorkflowId(
  userId: string,
  workspaceId: string,
): Promise<string | null> {
  const [prefs] = await db
    .select({ lastWorkflowIds: userPreferences.lastWorkflowIds })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  return prefs?.lastWorkflowIds?.[workspaceId] ?? null
}

export async function setLastWorkflowId(
  userId: string,
  workspaceId: string,
  workflowId: string,
) {
  const [prefs] = await db
    .select({ lastWorkflowIds: userPreferences.lastWorkflowIds })
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  const lastWorkflowIds = {
    ...(prefs?.lastWorkflowIds ?? {}),
    [workspaceId]: workflowId,
  }

  await db
    .insert(userPreferences)
    .values({ userId, lastWorkflowIds })
    .onConflictDoUpdate({
      target: userPreferences.userId,
      set: { lastWorkflowIds },
    })
}
