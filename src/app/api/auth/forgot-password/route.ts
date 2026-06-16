import { NextResponse } from 'next/server'
import { requestPasswordReset } from '@/lib/auth/user-profile'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email : ''

    if (!email.trim())
      return NextResponse.json({ error: '请填写邮箱' }, { status: 400 })

    await requestPasswordReset(email)

    return NextResponse.json({
      success: true,
      message: '若该邮箱已注册且设置了密码，你将收到重置邮件',
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '请求失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
