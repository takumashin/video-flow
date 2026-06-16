import { randomBytes } from 'crypto'
import { and, eq, gt } from 'drizzle-orm'
import { db } from '@/db'
import { verificationTokens } from '@/db/schema'

const TOKEN_TTL_MS = {
  emailVerify: 24 * 60 * 60 * 1000,
  passwordReset: 60 * 60 * 1000,
} as const

export type AuthTokenPurpose = keyof typeof TOKEN_TTL_MS

function buildIdentifier(purpose: AuthTokenPurpose, key: string) {
  return `${purpose}:${key}`
}

function generateToken() {
  return randomBytes(32).toString('hex')
}

export async function createAuthToken(purpose: AuthTokenPurpose, key: string) {
  const token = generateToken()
  const expires = new Date(Date.now() + TOKEN_TTL_MS[purpose])
  const identifier = buildIdentifier(purpose, key)

  await db
    .delete(verificationTokens)
    .where(eq(verificationTokens.identifier, identifier))

  await db.insert(verificationTokens).values({
    identifier,
    token,
    expires,
  })

  return { token, expires, identifier }
}

export async function consumeAuthToken(purpose: AuthTokenPurpose, key: string, token: string) {
  const identifier = buildIdentifier(purpose, key)
  const now = new Date()

  const [row] = await db
    .select()
    .from(verificationTokens)
    .where(and(
      eq(verificationTokens.identifier, identifier),
      eq(verificationTokens.token, token),
      gt(verificationTokens.expires, now),
    ))
    .limit(1)

  if (!row)
    return false

  await db
    .delete(verificationTokens)
    .where(and(
      eq(verificationTokens.identifier, identifier),
      eq(verificationTokens.token, token),
    ))

  return true
}
