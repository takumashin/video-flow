import { NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/admin/context'
import { authErrorResponse } from '@/lib/auth/context'
import { getGlobalCreditStats, listUsersCreditSummary } from '@/lib/credits/service'

export async function GET(request: Request) {
  try {
    await requireAdmin()

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('q') ?? undefined
    const limit = Math.min(Number.parseInt(searchParams.get('limit') ?? '100', 10) || 100, 200)
    const offset = Math.max(Number.parseInt(searchParams.get('offset') ?? '0', 10) || 0, 0)

    const [summary, users] = await Promise.all([
      getGlobalCreditStats(),
      listUsersCreditSummary({ search, limit, offset }),
    ])

    return NextResponse.json({
      summary,
      users: users.map(user => ({
        ...user,
        balance: Number(user.balance),
        totalConsumed: Number(user.totalConsumed),
        totalGranted: Number(user.totalGranted),
        generationCount: Number(user.generationCount),
        createdAt: user.createdAt.toISOString(),
      })),
    })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
