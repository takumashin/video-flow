import { NextResponse } from 'next/server'
import {
  getVolcengineBalanceConsoleUrl,
  getVolcengineBillingCredentials,
  queryVolcengineAccountBalance,
} from '@/lib/volcengine-billing'

export async function GET() {
  const consoleUrl = getVolcengineBalanceConsoleUrl()

  if (!getVolcengineBillingCredentials()) {
    return NextResponse.json({
      configured: false,
      consoleUrl,
      hint: '在 .env.local 配置 VOLC_ACCESS_KEY_ID 与 VOLC_SECRET_ACCESS_KEY 后可在此显示账户余额（IAM 密钥，与 ARK_API_KEY 不同）',
    })
  }

  try {
    const balance = await queryVolcengineAccountBalance()

    return NextResponse.json({
      configured: true,
      consoleUrl,
      balance,
      updatedAt: Date.now(),
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '查询余额失败'
    return NextResponse.json({
      configured: true,
      consoleUrl,
      error: message,
    }, { status: 500 })
  }
}
