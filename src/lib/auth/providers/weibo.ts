import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers'

type WeiboProfile = {
  id: number | string
  idstr?: string
  screen_name?: string
  name?: string
  profile_image_url?: string
  avatar_large?: string
}

export function WeiboProvider(
  options: OAuthUserConfig<WeiboProfile>,
): OAuthConfig<WeiboProfile> {
  return {
    id: 'weibo',
    name: '微博',
    type: 'oauth',
    checks: ['state'],
    authorization: {
      url: 'https://api.weibo.com/oauth2/authorize',
      params: {
        response_type: 'code',
      },
    },
    token: {
      url: 'https://api.weibo.com/oauth2/access_token',
      async request(context: {
        params: Record<string, string | undefined>
        provider: OAuthConfig<WeiboProfile> & { callbackUrl: string }
      }) {
        const { params, provider } = context
        const body = new URLSearchParams({
          client_id: provider.clientId!,
          client_secret: provider.clientSecret!,
          grant_type: 'authorization_code',
          code: params.code!,
          redirect_uri: provider.callbackUrl,
        })

        const response = await fetch('https://api.weibo.com/oauth2/access_token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        })

        const tokens = await response.json()

        if (tokens.error) {
          throw new Error(`微博授权失败: ${tokens.error_description ?? tokens.error}`)
        }

        return { tokens }
      },
    },
    userinfo: {
      url: 'https://api.weibo.com/2/users/show.json',
      async request(context: {
        tokens: Record<string, unknown>
      }) {
        const { tokens } = context
        const url = new URL('https://api.weibo.com/2/users/show.json')
        url.searchParams.set('access_token', String(tokens.access_token))
        url.searchParams.set('uid', String(tokens.uid))

        const response = await fetch(url)
        const profile = await response.json()

        if (profile.error) {
          throw new Error(`获取微博用户信息失败: ${profile.error}`)
        }

        return profile
      },
    },
    profile(profile) {
      const id = profile.idstr ?? String(profile.id)
      return {
        id,
        name: profile.screen_name ?? profile.name ?? '微博用户',
        email: `weibo_${id}@oauth.local`,
        image: profile.avatar_large ?? profile.profile_image_url,
      }
    },
    style: {
      bg: '#ff8200',
      text: '#fff',
    },
    options,
  }
}
