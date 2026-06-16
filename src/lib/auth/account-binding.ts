import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { users } from '@/db/schema'
import { isOAuthPlaceholderEmail } from '@/lib/auth/credentials'

export type AccountBindingStatus = {
  needsBinding: boolean
  email: string
  emailEditable: boolean
  hasPassword: boolean
}

export async function getAccountBindingStatus(userId: string): Promise<AccountBindingStatus> {
  const [user] = await db
    .select({
      email: users.email,
      passwordHash: users.passwordHash,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user) {
    return {
      needsBinding: false,
      email: '',
      emailEditable: false,
      hasPassword: false,
    }
  }

  const hasPassword = !!user.passwordHash
  const emailEditable = isOAuthPlaceholderEmail(user.email)

  return {
    needsBinding: !hasPassword,
    email: user.email,
    emailEditable,
    hasPassword,
  }
}

export async function bindCredentialsForUser(input: {
  userId: string
  email: string
  password: string
}) {
  const status = await getAccountBindingStatus(input.userId)
  if (!status.needsBinding)
    throw new Error('账号已绑定邮箱密码，无需重复操作')

  const email = input.email.trim().toLowerCase()
  if (!email || !email.includes('@'))
    throw new Error('请输入有效邮箱')

  if (input.password.length < 8)
    throw new Error('密码至少 8 位')

  const targetEmail = status.emailEditable ? email : status.email

  if (status.emailEditable && targetEmail !== status.email) {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, targetEmail))
      .limit(1)

    if (existing && existing.id !== input.userId)
      throw new Error('该邮箱已被其他账号使用')
  }

  const passwordHash = await bcrypt.hash(input.password, 12)

  const [updated] = await db
    .update(users)
    .set({
      email: targetEmail,
      passwordHash,
      updatedAt: new Date(),
    })
    .where(eq(users.id, input.userId))
    .returning({
      id: users.id,
      email: users.email,
      name: users.name,
    })

  if (!updated)
    throw new Error('绑定失败，请稍后重试')

  return updated
}
