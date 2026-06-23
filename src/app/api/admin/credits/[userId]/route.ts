import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/context'
import { authErrorResponse } from '@/lib/auth/context'
import {
  countCreditTransactions,
  ensureUserCreditsAccount,
  getUserCreditSummary,
  grantCredits,
  listCreditTransactions,
} from '@/lib/credits/service'

type RouteContext = {
  params: Promise<{ userId: string }>
}

export async function GET(_request: Request, context: RouteContext) {
  try {
    await requireAdmin()
    const { userId } = await context.params

    const summary = await getUserCreditSummary(userId)
    if (!summary)
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    await ensureUserCreditsAccount(userId)

    const [transactions, totalTransactions] = await Promise.all([
      listCreditTransactions(userId, { limit: 100 }),
      countCreditTransactions(userId),
    ])

    return NextResponse.json({
      summary: {
        ...summary,
        balance: Number(summary.balance),
        totalConsumed: Number(summary.totalConsumed),
        totalGranted: Number(summary.totalGranted),
        generationCount: Number(summary.generationCount),
        createdAt: summary.createdAt.toISOString(),
      },
      transactions: transactions.map(item => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
      totalTransactions,
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const admin = await requireAdmin()
    const { userId } = await context.params
    const body = await request.json()

    const amount = Number.parseInt(String(body.amount ?? ''), 10)
    const description = typeof body.description === 'string' ? body.description.trim() : ''

    if (!Number.isFinite(amount) || amount <= 0)
      return NextResponse.json({ error: '充值点数必须为正整数' }, { status: 400 })

    const summary = await getUserCreditSummary(userId)
    if (!summary)
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    await ensureUserCreditsAccount(userId)

    const balanceAfter = await grantCredits({
      userId,
      amount,
      type: 'recharge',
      description: description || `管理员充值 · ${admin.email}`,
    })

    const updated = await getUserCreditSummary(userId)

    return NextResponse.json({
      balanceAfter,
      summary: updated
        ? {
            ...updated,
            balance: Number(updated.balance),
            totalConsumed: Number(updated.totalConsumed),
            totalGranted: Number(updated.totalGranted),
            generationCount: Number(updated.generationCount),
            createdAt: updated.createdAt.toISOString(),
          }
        : null,
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
