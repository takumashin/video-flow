import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { users } from '@/db/schema'
import { consumeAuthToken, createAuthToken } from '@/lib/auth/tokens'
import { getAppBaseUrl, sendEmail } from '@/lib/email/send'
import { isOAuthPlaceholderEmail } from '@/lib/auth/credentials'

export type UserProfile = {
  id: string
  name: string | null
  email: string
  image: string | null
  emailVerified: Date | null
  hasPassword: boolean
  createdAt: Date
}

export async function getUserProfile(userId: string): Promise<UserProfile | null> {
  const [user] = await db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user)
    return null

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    image: user.image,
    emailVerified: user.emailVerified,
    hasPassword: !!user.passwordHash,
    createdAt: user.createdAt,
  }
}

export async function updateUserProfile(
  userId: string,
  input: { name?: string; image?: string | null },
) {
  const patch: Partial<typeof users.$inferInsert> = { updatedAt: new Date() }

  if (input.name !== undefined)
    patch.name = input.name.trim() || null

  if (input.image !== undefined)
    patch.image = input.image?.trim() || null

  const [updated] = await db
    .update(users)
    .set(patch)
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      name: users.name,
      email: users.email,
      image: users.image,
      emailVerified: users.emailVerified,
      passwordHash: users.passwordHash,
      createdAt: users.createdAt,
    })

  if (!updated)
    throw new Error('用户不存在')

  return {
    id: updated.id,
    name: updated.name,
    email: updated.email,
    image: updated.image,
    emailVerified: updated.emailVerified,
    hasPassword: !!updated.passwordHash,
    createdAt: updated.createdAt,
  } satisfies UserProfile
}

export async function changeUserPassword(
  userId: string,
  currentPassword: string,
  newPassword: string,
) {
  if (newPassword.length < 8)
    throw new Error('新密码至少 8 位')

  const [user] = await db
    .select({ passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user?.passwordHash)
    throw new Error('当前账号未设置密码，请先绑定邮箱密码')

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid)
    throw new Error('当前密码不正确')

  const passwordHash = await bcrypt.hash(newPassword, 12)
  await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.id, userId))
}

export async function requestPasswordReset(email: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const [user] = await db
    .select({ id: users.id, email: users.email, passwordHash: users.passwordHash })
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (!user?.passwordHash || isOAuthPlaceholderEmail(user.email))
    return { sent: false as const }

  const { token } = await createAuthToken('passwordReset', normalizedEmail)
  const resetUrl = `${getAppBaseUrl()}/reset-password?email=${encodeURIComponent(normalizedEmail)}&token=${token}`

  await sendEmail({
    to: normalizedEmail,
    subject: '重置 Seedance Studio 密码',
    html: `
      <p>你好，</p>
      <p>我们收到了重置密码的请求。请点击下方链接设置新密码（1 小时内有效）：</p>
      <p><a href="${resetUrl}">${resetUrl}</a></p>
      <p>如非本人操作，请忽略此邮件。</p>
    `,
    text: `重置密码链接（1 小时内有效）：${resetUrl}`,
  })

  return { sent: true as const }
}

export async function resetPasswordWithToken(
  email: string,
  token: string,
  newPassword: string,
) {
  if (newPassword.length < 8)
    throw new Error('密码至少 8 位')

  const normalizedEmail = email.trim().toLowerCase()
  const valid = await consumeAuthToken('passwordReset', normalizedEmail, token)
  if (!valid)
    throw new Error('链接无效或已过期')

  const passwordHash = await bcrypt.hash(newPassword, 12)
  const [updated] = await db
    .update(users)
    .set({ passwordHash, updatedAt: new Date() })
    .where(eq(users.email, normalizedEmail))
    .returning({ id: users.id })

  if (!updated)
    throw new Error('用户不存在')
}

export async function sendEmailVerification(userId: string) {
  const [user] = await db
    .select({ id: users.id, email: users.email, emailVerified: users.emailVerified })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)

  if (!user)
    throw new Error('用户不存在')

  if (user.emailVerified)
    throw new Error('邮箱已验证')

  if (isOAuthPlaceholderEmail(user.email))
    throw new Error('请先绑定真实邮箱后再验证')

  const { token } = await createAuthToken('emailVerify', user.id)
  const verifyUrl = `${getAppBaseUrl()}/verify-email?token=${token}&uid=${user.id}`

  await sendEmail({
    to: user.email,
    subject: '验证 Seedance Studio 邮箱',
    html: `
      <p>你好，</p>
      <p>请点击下方链接验证你的邮箱（24 小时内有效）：</p>
      <p><a href="${verifyUrl}">${verifyUrl}</a></p>
    `,
    text: `验证邮箱链接（24 小时内有效）：${verifyUrl}`,
  })
}

export async function verifyEmailWithToken(userId: string, token: string) {
  const valid = await consumeAuthToken('emailVerify', userId, token)
  if (!valid)
    throw new Error('验证链接无效或已过期')

  const [updated] = await db
    .update(users)
    .set({ emailVerified: new Date(), updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning({ id: users.id })

  if (!updated)
    throw new Error('用户不存在')
}
