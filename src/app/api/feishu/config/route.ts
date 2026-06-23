import { NextResponse } from 'next/server'
import { isFeishuAppConfigured } from '@/lib/feishu/app-client'

export async function GET() {
  return NextResponse.json({
    enabled: isFeishuAppConfigured(),
    linkInviteEnabled: isFeishuAppConfigured(),
  })
}
