import { NextResponse } from 'next/server'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import { users } from '@/db/schema'
import { createCredentialsUser } from '@/lib/auth/credentials'
import { createDefaultWorkspaceForUser } from '@/lib/workspace/service'
import { ensureUserCreditsAccount } from '@/lib/credits/service'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!email || !password)
      return NextResponse.json({ error: '请填写邮箱和密码' }, { status: 400 })

    if (password.length < 8)
      return NextResponse.json({ error: '密码至少 8 位' }, { status: 400 })

    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1)

    if (existing)
      return NextResponse.json({ error: '该邮箱已注册' }, { status: 409 })

    const user = await createCredentialsUser({ email, password, name })
    await createDefaultWorkspaceForUser(user.id, user.name)
    await ensureUserCreditsAccount(user.id)

    try {
      const { sendEmailVerification } = await import('@/lib/auth/user-profile')
      await sendEmailVerification(user.id)
    }
    catch (error) {
      console.warn('[register] 发送验证邮件失败:', error)
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email, name: user.name },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '注册失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
