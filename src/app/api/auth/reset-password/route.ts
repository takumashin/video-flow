import { NextResponse } from 'next/server'
import { resetPasswordWithToken } from '@/lib/auth/user-profile'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email : ''
    const token = typeof body.token === 'string' ? body.token : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

    if (!email || !token || !password)
      return NextResponse.json({ error: '请填写完整信息' }, { status: 400 })

    if (password !== confirmPassword)
      return NextResponse.json({ error: '两次输入的密码不一致' }, { status: 400 })

    await resetPasswordWithToken(email, token, password)
    return NextResponse.json({ success: true })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '重置失败'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
