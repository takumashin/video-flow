import { eq } from 'drizzle-orm'
import bcrypt from 'bcryptjs'
import { db } from '@/db'
import { users } from '@/db/schema'

export async function verifyCredentials(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase()
  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1)

  if (!user?.passwordHash)
    return null

  const valid = await bcrypt.compare(password, user.passwordHash)
  if (!valid)
    return null

  return user
}

export async function createCredentialsUser(input: {
  email: string
  password: string
  name?: string
}) {
  const email = input.email.trim().toLowerCase()
  const passwordHash = await bcrypt.hash(input.password, 12)

  const [user] = await db
    .insert(users)
    .values({
      email,
      name: input.name?.trim() || email.split('@')[0],
      passwordHash,
    })
    .returning()

  return user
}

export function isOAuthPlaceholderEmail(email: string) {
  return email.endsWith('@oauth.local')
}
