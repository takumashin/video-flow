import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { sendEmailVerification, verifyEmailWithToken } from '@/lib/auth/user-profile'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')
    const uid = searchParams.get('uid')

    if (!token || !uid)
      return NextResponse.json({ error: '链接无效' }, { status: 400 })

    await verifyEmailWithToken(uid, token)
    return NextResponse.json({ success: true })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '验证失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

export async function POST() {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ error: '请先登录' }, { status: 401 })

    await sendEmailVerification(session.user.id)
    return NextResponse.json({ success: true, message: '验证邮件已发送' })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '发送失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
