import type { NextAuthConfig } from 'next-auth'

function getAuthSecret() {
  const secret = process.env.AUTH_SECRET?.trim()
  if (secret)
    return secret

  if (process.env.NODE_ENV === 'development') {
    console.warn('[auth] AUTH_SECRET 未设置，开发环境使用临时密钥。生产环境必须配置 AUTH_SECRET。')
    return 'development-auth-secret-change-me'
  }

  throw new Error('AUTH_SECRET 环境变量未设置')
}

export const authConfig = {
  secret: getAuthSecret(),
  pages: {
    signIn: '/login',
  },
  providers: [],
  session: {
    strategy: 'jwt',
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const pathname = nextUrl.pathname
      const isPublic
        = pathname.startsWith('/login')
          || pathname.startsWith('/register')
          || pathname.startsWith('/forgot-password')
          || pathname.startsWith('/reset-password')
          || pathname.startsWith('/invite')
          || pathname.startsWith('/verify-email')
          || pathname.startsWith('/api/auth')
          || pathname.startsWith('/api/workspaces/invites/')

      if (pathname.startsWith('/account'))
        return !!auth?.user

      if (isPublic)
        return true

      return !!auth?.user
    },
    jwt({ token }) {
      return token
    },
    session({ session, token }) {
      if (token.sub)
        session.user.id = token.sub
      return session
    },
  },
  trustHost: true,
} satisfies NextAuthConfig
