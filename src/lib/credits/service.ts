import { and, desc, eq, ilike, or, sql } from 'drizzle-orm'
import { db } from '@/db'
import { creditTransactions, userCredits, users, type CreditTransactionType } from '@/db/schema'
import { isReviewRelatedTaskFailure } from '@/lib/credits/refund-policy'
import { getModelOption, getSeedanceModelCreditCost } from '@/lib/seedance-models'

export class InsufficientCreditsError extends Error {
  readonly balance: number
  readonly required: number

  constructor(balance: number, required: number) {
    super(`点数不足，需要 ${required} 点，当前余额 ${balance} 点`)
    this.name = 'InsufficientCreditsError'
    this.balance = balance
    this.required = required
  }
}

export function getInitialUserCredits(): number {
  const raw = process.env.USER_INITIAL_CREDITS?.trim()
  if (!raw)
    return 5000

  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000
}

export async function getUserCreditBalance(userId: string): Promise<number> {
  const [row] = await db
    .select({ balance: userCredits.balance })
    .from(userCredits)
    .where(eq(userCredits.userId, userId))
    .limit(1)

  return row?.balance ?? 0
}

export async function ensureUserCreditsAccount(userId: string): Promise<number> {
  const initial = getInitialUserCredits()

  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ balance: userCredits.balance })
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .limit(1)

    if (existing)
      return existing.balance

    await tx.insert(userCredits).values({
      userId,
      balance: initial,
    })

    if (initial > 0) {
      await tx.insert(creditTransactions).values({
        userId,
        amount: initial,
        balanceAfter: initial,
        type: 'signup_bonus',
        description: '新用户注册赠送',
      })
    }

    return initial
  })
}

type SpendCreditsInput = {
  userId: string
  amount: number
  type: CreditTransactionType
  model?: string
  taskId?: string
  description?: string
}

export async function spendCredits(input: SpendCreditsInput): Promise<number> {
  const { userId, amount, type, model, taskId, description } = input
  if (amount <= 0)
    throw new Error('扣点数量必须大于 0')

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ balance: userCredits.balance })
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .limit(1)

    if (!row)
      throw new InsufficientCreditsError(0, amount)

    if (row.balance < amount)
      throw new InsufficientCreditsError(row.balance, amount)

    const balanceAfter = row.balance - amount

    await tx
      .update(userCredits)
      .set({
        balance: balanceAfter,
        updatedAt: new Date(),
      })
      .where(eq(userCredits.userId, userId))

    await tx.insert(creditTransactions).values({
      userId,
      amount: -amount,
      balanceAfter,
      type,
      model,
      taskId,
      description,
    })

    return balanceAfter
  })
}

export async function grantCredits(input: {
  userId: string
  amount: number
  type: CreditTransactionType
  description?: string
  taskId?: string
  model?: string
}): Promise<number> {
  const { userId, amount, type, description, taskId, model } = input
  if (amount <= 0)
    throw new Error('充值数量必须大于 0')

  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ balance: userCredits.balance })
      .from(userCredits)
      .where(eq(userCredits.userId, userId))
      .limit(1)

    const currentBalance = row?.balance ?? 0
    const balanceAfter = currentBalance + amount

    if (row) {
      await tx
        .update(userCredits)
        .set({
          balance: balanceAfter,
          updatedAt: new Date(),
        })
        .where(eq(userCredits.userId, userId))
    }
    else {
      await tx.insert(userCredits).values({
        userId,
        balance: balanceAfter,
      })
    }

    await tx.insert(creditTransactions).values({
      userId,
      amount,
      balanceAfter,
      type,
      taskId,
      model,
      description,
    })

    return balanceAfter
  })
}

export async function hasCreditRefundForTask(userId: string, taskId: string): Promise<boolean> {
  const [row] = await db
    .select({ id: creditTransactions.id })
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, userId),
      eq(creditTransactions.taskId, taskId),
      eq(creditTransactions.type, 'refund'),
    ))
    .limit(1)

  return !!row
}

export async function getTaskCreditSpendAmount(userId: string, taskId: string): Promise<number | null> {
  const [row] = await db
    .select({ amount: creditTransactions.amount })
    .from(creditTransactions)
    .where(and(
      eq(creditTransactions.userId, userId),
      eq(creditTransactions.taskId, taskId),
      eq(creditTransactions.type, 'video_generation'),
    ))
    .limit(1)

  if (!row)
    return null

  return Math.abs(row.amount)
}

export async function refundCreditsForReviewFailedTask(input: {
  userId: string
  taskId: string
  model?: string | null
  creditCost?: number
  errorMessage?: string | null
}): Promise<{ refunded: boolean, amount: number, balanceAfter?: number }> {
  if (!isReviewRelatedTaskFailure(input.errorMessage))
    return { refunded: false, amount: 0 }

  if (await hasCreditRefundForTask(input.userId, input.taskId))
    return { refunded: false, amount: 0 }

  const spentAmount = await getTaskCreditSpendAmount(input.userId, input.taskId)
  const amount = spentAmount
    ?? input.creditCost
    ?? (input.model ? getSeedanceModelCreditCost(input.model) : 0)

  if (amount <= 0)
    return { refunded: false, amount: 0 }

  const modelLabel = input.model ? getModelOption(input.model)?.label ?? input.model : 'Seedance'
  const reason = input.errorMessage?.trim()
  const description = reason
    ? `内容审查失败退还 · ${modelLabel} · ${reason}`
    : `内容审查失败退还 · ${modelLabel}`

  const balanceAfter = await grantCredits({
    userId: input.userId,
    amount,
    type: 'refund',
    taskId: input.taskId,
    model: input.model ?? undefined,
    description,
  })

  return { refunded: true, amount, balanceAfter }
}

export async function refundCreditsForTask(input: {
  userId: string
  amount: number
  taskId: string
  model?: string
  description?: string
}): Promise<number | null> {
  if (input.amount <= 0)
    return null

  if (await hasCreditRefundForTask(input.userId, input.taskId))
    return null

  return grantCredits({
    userId: input.userId,
    amount: input.amount,
    type: 'refund',
    taskId: input.taskId,
    model: input.model,
    description: input.description ?? `任务失败退还 · ${input.taskId}`,
  })
}

export async function spendCreditsForVideoGeneration(input: {
  userId: string
  model: string
  taskId?: string
}): Promise<{ cost: number, balanceAfter: number }> {
  await ensureUserCreditsAccount(input.userId)

  const cost = getSeedanceModelCreditCost(input.model)
  const modelLabel = getModelOption(input.model)?.label ?? input.model

  const balanceAfter = await spendCredits({
    userId: input.userId,
    amount: cost,
    type: 'video_generation',
    model: input.model,
    taskId: input.taskId,
    description: `视频生成 · ${modelLabel}`,
  })

  return { cost, balanceAfter }
}

export async function listRecentCreditTransactions(userId: string, limit = 20) {
  return listCreditTransactions(userId, { limit })
}

export async function listCreditTransactions(
  userId: string,
  options?: { limit?: number, offset?: number },
) {
  const limit = options?.limit ?? 50
  const offset = options?.offset ?? 0

  return db
    .select({
      id: creditTransactions.id,
      amount: creditTransactions.amount,
      balanceAfter: creditTransactions.balanceAfter,
      type: creditTransactions.type,
      model: creditTransactions.model,
      taskId: creditTransactions.taskId,
      description: creditTransactions.description,
      createdAt: creditTransactions.createdAt,
    })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(limit)
    .offset(offset)
}

export type UserCreditSummary = {
  userId: string
  email: string
  name: string | null
  balance: number
  totalConsumed: number
  totalGranted: number
  generationCount: number
  createdAt: Date
}

export type GlobalCreditStats = {
  userCount: number
  totalBalance: number
  totalConsumed: number
  totalGranted: number
  generationCount: number
}

function buildUserSearchFilter(search?: string) {
  const keyword = search?.trim()
  if (!keyword)
    return undefined

  const pattern = `%${keyword}%`
  return or(
    ilike(users.email, pattern),
    ilike(users.name, pattern),
  )
}

export async function listUsersCreditSummary(options?: {
  search?: string
  limit?: number
  offset?: number
}): Promise<UserCreditSummary[]> {
  const limit = options?.limit ?? 100
  const offset = options?.offset ?? 0
  const searchFilter = buildUserSearchFilter(options?.search)

  const query = db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      balance: sql<number>`coalesce(${userCredits.balance}, 0)`,
      totalConsumed: sql<number>`coalesce((
        select sum(abs(${creditTransactions.amount}))
        from ${creditTransactions}
        where ${creditTransactions.userId} = ${users.id}
          and ${creditTransactions.amount} < 0
      ), 0)`,
      totalGranted: sql<number>`coalesce((
        select sum(${creditTransactions.amount})
        from ${creditTransactions}
        where ${creditTransactions.userId} = ${users.id}
          and ${creditTransactions.amount} > 0
      ), 0)`,
      generationCount: sql<number>`coalesce((
        select count(*)
        from ${creditTransactions}
        where ${creditTransactions.userId} = ${users.id}
          and ${creditTransactions.type} = 'video_generation'
      ), 0)`,
    })
    .from(users)
    .leftJoin(userCredits, eq(userCredits.userId, users.id))
    .orderBy(desc(users.createdAt))
    .limit(limit)
    .offset(offset)

  if (searchFilter)
    return query.where(searchFilter).then(rows => rows.map(normalizeUserCreditSummary))

  return query.then(rows => rows.map(normalizeUserCreditSummary))
}

function normalizeUserCreditSummary(row: {
  userId: string
  email: string
  name: string | null
  createdAt: Date
  balance: number
  totalConsumed: number
  totalGranted: number
  generationCount: number
}): UserCreditSummary {
  return {
    ...row,
    balance: Number(row.balance),
    totalConsumed: Number(row.totalConsumed),
    totalGranted: Number(row.totalGranted),
    generationCount: Number(row.generationCount),
  }
}

export async function getGlobalCreditStats(): Promise<GlobalCreditStats> {
  const [row] = await db
    .select({
      userCount: sql<number>`count(distinct ${users.id})`,
      totalBalance: sql<number>`coalesce(sum(${userCredits.balance}), 0)`,
      totalConsumed: sql<number>`coalesce((
        select sum(abs(${creditTransactions.amount}))
        from ${creditTransactions}
        where ${creditTransactions.amount} < 0
      ), 0)`,
      totalGranted: sql<number>`coalesce((
        select sum(${creditTransactions.amount})
        from ${creditTransactions}
        where ${creditTransactions.amount} > 0
      ), 0)`,
      generationCount: sql<number>`coalesce((
        select count(*)
        from ${creditTransactions}
        where ${creditTransactions.type} = 'video_generation'
      ), 0)`,
    })
    .from(users)
    .leftJoin(userCredits, eq(userCredits.userId, users.id))

  return {
    userCount: Number(row?.userCount ?? 0),
    totalBalance: Number(row?.totalBalance ?? 0),
    totalConsumed: Number(row?.totalConsumed ?? 0),
    totalGranted: Number(row?.totalGranted ?? 0),
    generationCount: Number(row?.generationCount ?? 0),
  }
}

export async function getUserCreditSummary(userId: string): Promise<UserCreditSummary | null> {
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      name: users.name,
      createdAt: users.createdAt,
      balance: sql<number>`coalesce(${userCredits.balance}, 0)`,
      totalConsumed: sql<number>`coalesce((
        select sum(abs(${creditTransactions.amount}))
        from ${creditTransactions}
        where ${creditTransactions.userId} = ${users.id}
          and ${creditTransactions.amount} < 0
      ), 0)`,
      totalGranted: sql<number>`coalesce((
        select sum(${creditTransactions.amount})
        from ${creditTransactions}
        where ${creditTransactions.userId} = ${users.id}
          and ${creditTransactions.amount} > 0
      ), 0)`,
      generationCount: sql<number>`coalesce((
        select count(*)
        from ${creditTransactions}
        where ${creditTransactions.userId} = ${users.id}
          and ${creditTransactions.type} = 'video_generation'
      ), 0)`,
    })
    .from(users)
    .leftJoin(userCredits, eq(userCredits.userId, users.id))
    .where(eq(users.id, userId))
    .limit(1)

  if (!row)
    return null

  return {
    ...row,
    balance: Number(row.balance),
    totalConsumed: Number(row.totalConsumed),
    totalGranted: Number(row.totalGranted),
    generationCount: Number(row.generationCount),
  }
}

export async function countCreditTransactions(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)` })
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))

  return Number(row?.count ?? 0)
}
