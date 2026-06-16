import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { bindCredentialsForUser } from '@/lib/auth/account-binding'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

    if (password !== confirmPassword)
      return NextResponse.json({ error: '两次输入的密码不一致' }, { status: 400 })

    const user = await bindCredentialsForUser({
      userId: session.user.id,
      email,
      password,
    })

    try {
      const { sendEmailVerification } = await import('@/lib/auth/user-profile')
      await sendEmailVerification(user.id)
    }
    catch (error) {
      console.warn('[bind] 发送验证邮件失败:', error)
    }

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '绑定失败'
    const status = message.includes('已被') ? 409 : 400
    return NextResponse.json({ error: message }, { status })
  }
}
