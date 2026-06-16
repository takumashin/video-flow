import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { getAccountBindingStatus } from '@/lib/auth/account-binding'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ error: '请先登录' }, { status: 401 })

  const status = await getAccountBindingStatus(session.user.id)
  return NextResponse.json(status)
}
