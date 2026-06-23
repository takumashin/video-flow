import { and, eq, or } from 'drizzle-orm'
import { db } from '@/db'
import { accounts } from '@/db/schema'

export async function findUserIdByFeishuIdentity(input: {
  openId?: string | null
  unionId?: string | null
}) {
  const ids = [input.unionId, input.openId].filter(Boolean) as string[]
  if (ids.length === 0)
    return null

  const [row] = await db
    .select({ userId: accounts.userId })
    .from(accounts)
    .where(and(
      eq(accounts.provider, 'feishu'),
      or(...ids.map(id => eq(accounts.providerAccountId, id))),
    ))
    .limit(1)

  return row?.userId ?? null
}

export async function getFeishuIdentityForUser(userId: string) {
  const [row] = await db
    .select({ providerAccountId: accounts.providerAccountId })
    .from(accounts)
    .where(and(
      eq(accounts.userId, userId),
      eq(accounts.provider, 'feishu'),
    ))
    .limit(1)

  return row?.providerAccountId ?? null
}

export async function userMatchesFeishuInvite(
  userId: string,
  invite: { feishuOpenId?: string | null; feishuUnionId?: string | null },
) {
  const providerAccountId = await getFeishuIdentityForUser(userId)
  if (!providerAccountId)
    return false

  const targets = [invite.feishuUnionId, invite.feishuOpenId].filter(Boolean)
  return targets.includes(providerAccountId)
}
