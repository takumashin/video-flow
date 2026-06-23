import { customFetch } from 'next-auth'
import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers'

type WeChatProfile = {
  openid: string
  unionid?: string
  nickname?: string
  headimgurl?: string
}

type WeChatTokenResponse = {
  access_token?: string
  expires_in?: number
  refresh_token?: string
  openid?: string
  scope?: string
  unionid?: string
  errcode?: number
  errmsg?: string
}

function readRequestBody(body: BodyInit | null | undefined) {
  if (typeof body === 'string')
    return body

  if (body instanceof URLSearchParams)
    return body.toString()

  return ''
}

export function WeChatProvider(
  options: OAuthUserConfig<WeChatProfile>,
): OAuthConfig<WeChatProfile> {
  const clientId = options.clientId!
  const clientSecret = options.clientSecret!

  return {
    id: 'wechat',
    name: '微信',
    type: 'oauth',
    checks: ['state'],
    client: {
      token_endpoint_auth_method: 'none',
    },
    authorization: {
      url: 'https://open.weixin.qq.com/connect/qrconnect#wechat_redirect',
      params: {
        appid: clientId,
        scope: 'snsapi_login',
        response_type: 'code',
      },
    },
    token: 'https://api.weixin.qq.com/sns/oauth2/access_token',
    async [customFetch](...args: Parameters<typeof fetch>) {
      const url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]))
      const request = args[1]

      if (url.hostname === 'api.weixin.qq.com' && url.pathname.includes('/sns/oauth2/access_token')) {
        const params = new URLSearchParams(readRequestBody(request?.body ?? null))
        const code = params.get('code')

        if (!code) {
          throw new Error('微信授权失败: 缺少 code')
        }

        const tokenUrl = new URL('https://api.weixin.qq.com/sns/oauth2/access_token')
        tokenUrl.searchParams.set('appid', clientId)
        tokenUrl.searchParams.set('secret', clientSecret)
        tokenUrl.searchParams.set('code', code)
        tokenUrl.searchParams.set('grant_type', 'authorization_code')

        const response = await fetch(tokenUrl)
        const tokens = await response.json() as WeChatTokenResponse

        if (tokens.errcode) {
          throw new Error(`微信授权失败: ${tokens.errmsg ?? tokens.errcode}`)
        }

        if (!tokens.access_token || !tokens.openid) {
          throw new Error('微信授权失败: 未返回 access_token 或 openid')
        }

        return Response.json(tokens)
      }

      return fetch(...args)
    },
    userinfo: {
      url: 'https://api.weixin.qq.com/sns/userinfo',
      async request(context: {
        tokens: Record<string, unknown>
        provider: OAuthConfig<WeChatProfile>
      }) {
        const url = new URL('https://api.weixin.qq.com/sns/userinfo')
        url.searchParams.set('access_token', String(context.tokens.access_token))
        url.searchParams.set('openid', String(context.tokens.openid))
        url.searchParams.set('lang', 'zh_CN')

        const response = await fetch(url)
        const profile = await response.json() as WeChatProfile & { errcode?: number, errmsg?: string }

        if (profile.errcode) {
          throw new Error(`获取微信用户信息失败: ${profile.errmsg ?? profile.errcode}`)
        }

        return profile
      },
    },
    profile(profile) {
      const id = profile.unionid ?? profile.openid
      return {
        id,
        name: profile.nickname ?? '微信用户',
        email: `wechat_${id}@oauth.local`,
        image: profile.headimgurl,
      }
    },
    style: {
      bg: '#07c160',
      text: '#fff',
    },
    options,
  }
}
