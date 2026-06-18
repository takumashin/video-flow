import NextAuth from 'next-auth'
import Credentials from 'next-auth/providers/credentials'
import type { Provider } from 'next-auth/providers'
import { DrizzleAdapter } from '@auth/drizzle-adapter'
import { eq } from 'drizzle-orm'
import { db } from '@/db'
import {
  accounts,
  sessions,
  userPreferences,
  users,
  verificationTokens,
  workspaceMembers,
} from '@/db/schema'
import { authConfig } from '@/lib/auth/config-edge'
import { verifyCredentials } from '@/lib/auth/credentials'
import { WeChatProvider } from '@/lib/auth/providers/wechat'
import { WeiboProvider } from '@/lib/auth/providers/weibo'
import { FeishuProvider } from '@/lib/auth/providers/feishu'
import {
  ensureUserHasWorkspace,
  getActiveWorkspaceId,
  getWorkspaceMembership,
} from '@/lib/workspace/service'
import { getAccountBindingStatus } from '@/lib/auth/account-binding'
import { getUserProfile } from '@/lib/auth/user-profile'
import { ensureUserCreditsAccount } from '@/lib/credits/service'

const providers: Provider[] = [
  Credentials({
    name: 'credentials',
    credentials: {
      email: { label: '邮箱', type: 'email' },
      password: { label: '密码', type: 'password' },
    },
    authorize: async (credentials) => {
      const email = credentials?.email
      const password = credentials?.password
      if (typeof email !== 'string' || typeof password !== 'string')
        return null

      const user = await verifyCredentials(email, password)
      if (!user)
        return null

      return {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
      }
    },
  }),
]

if (process.env.AUTH_WECHAT_APP_ID && process.env.AUTH_WECHAT_APP_SECRET) {
  providers.push(
    WeChatProvider({
      clientId: process.env.AUTH_WECHAT_APP_ID,
      clientSecret: process.env.AUTH_WECHAT_APP_SECRET,
    }),
  )
}

if (process.env.AUTH_FEISHU_APP_ID && process.env.AUTH_FEISHU_APP_SECRET) {
  providers.push(
    FeishuProvider({
      clientId: process.env.AUTH_FEISHU_APP_ID,
      clientSecret: process.env.AUTH_FEISHU_APP_SECRET,
    }),
  )
}

if (process.env.AUTH_WEIBO_CLIENT_ID && process.env.AUTH_WEIBO_CLIENT_SECRET) {
  providers.push(
    WeiboProvider({
      clientId: process.env.AUTH_WEIBO_CLIENT_ID,
      clientSecret: process.env.AUTH_WEIBO_CLIENT_SECRET,
    }),
  )
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
  }),
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60,
  },
  // 允许 HTTP 环境使用 cookie（非 HTTPS）
  useSecureCookies: process.env.NODE_ENV === 'production' && process.env.AUTH_URL?.startsWith('https://'),
  cookies: {
    sessionToken: {
      name: `next-auth.session-token`,
      options: {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production' && process.env.AUTH_URL?.startsWith('https://'),
        path: '/',
        maxAge: 30 * 24 * 60 * 60,
      },
    },
  },
  providers,
  events: {
    createUser: async ({ user }) => {
      if (user.id) {
        await ensureUserHasWorkspace(user.id, user.name)
        await ensureUserCreditsAccount(user.id)
      }
    },
  },
  callbacks: {
    ...authConfig.callbacks,
    async signIn({ user }) {
      if (!user.id)
        return true

      try {
        await ensureUserHasWorkspace(user.id, user.name)
      }
      catch (error) {
        console.error('[auth] 初始化工作空间失败:', error)
      }
      return true
    },
    async jwt({ token, user, trigger, session }) {
      const userId = user?.id ?? token.sub
      if (!userId)
        return token

      if (user) {
        token.sub = user.id
        token.email = user.email
        token.name = user.name
        token.picture = user.image
      }

      if (trigger === 'update' && session?.activeWorkspaceId) {
        try {
          token.activeWorkspaceId = session.activeWorkspaceId as string
          const membership = await getWorkspaceMembership(
            userId,
            session.activeWorkspaceId as string,
          )
          token.activeWorkspaceRole = membership?.role ?? null
          token.activeWorkspaceName = membership?.name ?? null
        }
        catch (error) {
          console.error('[auth] 切换工作空间时读取数据库失败:', error)
        }
      }

      if (trigger === 'update' && session?.needsAccountBinding === false) {
        token.needsAccountBinding = false
      }

      if (trigger === 'update' && typeof session?.name === 'string') {
        token.name = session.name
      }

      if (trigger === 'update' && typeof session?.activeWorkspaceName === 'string') {
        token.activeWorkspaceName = session.activeWorkspaceName
      }

      if (user || trigger === 'update') {
        try {
          const binding = await getAccountBindingStatus(userId)
          token.needsAccountBinding = binding.needsBinding
          token.email = binding.email || token.email
        }
        catch (error) {
          console.error('[auth] 读取账号绑定状态失败:', error)
        }
      }

      const shouldRefreshProfile = user
        || (trigger === 'update' && (session?.name || session?.refreshProfile))

      if (shouldRefreshProfile) {
        try {
          const profile = await getUserProfile(userId)
          if (profile) {
            token.name = profile.name
            token.picture = profile.image
            token.emailVerified = profile.emailVerified?.toISOString() ?? null
          }
        }
        catch (error) {
          console.error('[auth] 读取用户资料失败:', error)
        }
      }

      if (trigger === 'update' && session?.activeWorkspaceId)
        return token

      const shouldRefreshWorkspace = user
        || (trigger === 'update' && session?.activeWorkspaceId)
        || !token.activeWorkspaceId

      if (!shouldRefreshWorkspace)
        return token

      try {
        const workspaceId = (token.activeWorkspaceId as string | undefined)
          ?? await getActiveWorkspaceId(userId)

        token.activeWorkspaceId = workspaceId

        if (workspaceId) {
          const membership = await getWorkspaceMembership(userId, workspaceId)
          token.activeWorkspaceRole = membership?.role ?? null
          token.activeWorkspaceName = membership?.name ?? null
        }
      }
      catch (error) {
        console.error('[auth] 读取工作空间信息失败:', error)
      }

      return token
    },
    async session({ session, token }) {
      if (token.sub)
        session.user.id = token.sub

      session.activeWorkspaceId = (token.activeWorkspaceId as string | null) ?? null
      session.activeWorkspaceRole = (token.activeWorkspaceRole as typeof session.activeWorkspaceRole) ?? null
      session.activeWorkspaceName = (token.activeWorkspaceName as string | null) ?? null
      session.needsAccountBinding = (token.needsAccountBinding as boolean | undefined) ?? false
      session.emailVerified = (token.emailVerified as string | null) ?? null
      if (token.email)
        session.user.email = token.email as string
      if (token.name)
        session.user.name = token.name as string
      if (token.picture)
        session.user.image = token.picture as string
      return session
    },
  },
})

export async function clearUserActiveWorkspace(userId: string, workspaceId: string) {
  const [prefs] = await db
    .select()
    .from(userPreferences)
    .where(eq(userPreferences.userId, userId))
    .limit(1)

  if (prefs?.activeWorkspaceId === workspaceId) {
    const [fallback] = await db
      .select({ workspaceId: workspaceMembers.workspaceId })
      .from(workspaceMembers)
      .where(eq(workspaceMembers.userId, userId))
      .limit(1)

    if (fallback) {
      await db
        .update(userPreferences)
        .set({ activeWorkspaceId: fallback.workspaceId })
        .where(eq(userPreferences.userId, userId))
    }
  }
}
