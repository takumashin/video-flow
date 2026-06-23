import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { authErrorResponse } from '@/lib/auth/context'
import { changeUserPassword } from '@/lib/auth/user-profile'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const body = await request.json()
    const currentPassword = typeof body.currentPassword === 'string' ? body.currentPassword : ''
    const newPassword = typeof body.newPassword === 'string' ? body.newPassword : ''
    const confirmPassword = typeof body.confirmPassword === 'string' ? body.confirmPassword : ''

    if (!currentPassword || !newPassword)
      return NextResponse.json({ error: '请填写完整密码信息' }, { status: 400 })

    if (newPassword !== confirmPassword)
      return NextResponse.json({ error: '两次输入的新密码不一致' }, { status: 400 })

    await changeUserPassword(session.user.id, currentPassword, newPassword)
    return NextResponse.json({ success: true })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
