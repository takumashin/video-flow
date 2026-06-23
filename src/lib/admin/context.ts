import { auth } from '@/lib/auth/config'
import { AuthError } from '@/lib/auth/context'

function parseAdminEmails(): Set<string> {
  const raw = process.env.ADMIN_EMAILS?.trim()
  if (!raw)
    return new Set()

  return new Set(
    raw
      .split(',')
      .map(item => item.trim().toLowerCase())
      .filter(Boolean),
  )
}

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email)
    return false

  return parseAdminEmails().has(email.trim().toLowerCase())
}

export async function requireAdmin() {
  const session = await auth()
  if (!session?.user?.id)
    throw new AuthError('请先登录')

  const email = session.user.email
  if (!isAdminEmail(email))
    throw new AuthError('无权访问管理后台', 403)

  return {
    userId: session.user.id,
    email: email!,
    user: session.user,
  }
}
