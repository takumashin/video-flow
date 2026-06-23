import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import {
  ensureUserCreditsAccount,
  getUserCreditBalance,
  listRecentCreditTransactions,
} from '@/lib/credits/service'
import { SEEDANCE_MODELS } from '@/lib/seedance-models'

export async function GET() {
  try {
    const { userId } = await requireAuth()
    await ensureUserCreditsAccount(userId)
    const balance = await getUserCreditBalance(userId)
    const transactions = await listRecentCreditTransactions(userId, 10)

    return NextResponse.json({
      balance,
      modelCosts: SEEDANCE_MODELS.map(model => ({
        id: model.id,
        label: model.label,
        creditCost: model.creditCost,
      })),
      transactions: transactions.map(item => ({
        ...item,
        createdAt: item.createdAt.toISOString(),
      })),
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
