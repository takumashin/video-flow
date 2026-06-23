import { customFetch } from 'next-auth'
import type { OAuthConfig, OAuthUserConfig } from 'next-auth/providers'

type FeishuDomain = 'feishu' | 'lark'

type FeishuProfile = {
  name?: string
  en_name?: string
  avatar_url?: string
  open_id?: string
  union_id?: string
  email?: string
  user_id?: string
}

type FeishuApiResponse<T> = {
  code: number
  msg?: string
  error?: string
  error_description?: string
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
  data?: T
}

function getFeishuHosts(domain: FeishuDomain = 'feishu') {
  if (domain === 'lark') {
    return {
      accountsHost: 'accounts.larksuite.com',
      openHost: 'open.larksuite.com',
    }
  }

  return {
    accountsHost: 'accounts.feishu.cn',
    openHost: 'open.feishu.cn',
  }
}

function resolveFeishuDomain(domain?: FeishuDomain): FeishuDomain {
  const configured = domain ?? process.env.AUTH_FEISHU_DOMAIN
  return configured === 'lark' ? 'lark' : 'feishu'
}

function parseFeishuTokenPayload(result: FeishuApiResponse<{
  access_token?: string
  token_type?: string
  expires_in?: number
  refresh_token?: string
  scope?: string
}>) {
  if (result.code !== 0) {
    throw new Error(
      `飞书授权失败: ${result.error_description ?? result.msg ?? result.error ?? result.code}`,
    )
  }

  const accessToken = result.access_token ?? result.data?.access_token
  if (!accessToken) {
    throw new Error('飞书授权失败: 未返回 access_token')
  }

  return {
    access_token: accessToken,
    token_type: result.token_type ?? result.data?.token_type ?? 'Bearer',
    expires_in: result.expires_in ?? result.data?.expires_in,
    refresh_token: result.refresh_token ?? result.data?.refresh_token,
    scope: result.scope ?? result.data?.scope,
  }
}

function readRequestBody(body: BodyInit | null | undefined) {
  if (typeof body === 'string')
    return body

  if (body instanceof URLSearchParams)
    return body.toString()

  return ''
}

export function FeishuProvider(
  options: OAuthUserConfig<FeishuProfile> & { domain?: FeishuDomain },
): OAuthConfig<FeishuProfile> {
  const domain = resolveFeishuDomain(options.domain)
  const { accountsHost, openHost } = getFeishuHosts(domain)
  const { domain: _domain, ...providerOptions } = options
  const clientId = providerOptions.clientId!
  const clientSecret = providerOptions.clientSecret!
  const tokenUrl = `https://${openHost}/open-apis/authen/v2/oauth/token`

  const feishuScope = process.env.AUTH_FEISHU_SCOPE?.trim() ?? ''

  return {
    id: 'feishu',
    name: '飞书',
    type: 'oauth',
    checks: ['state'],
    client: {
      token_endpoint_auth_method: 'client_secret_post',
    },
    authorization: {
      url: `https://${accountsHost}/open-apis/authen/v1/authorize`,
      params: {
        response_type: 'code',
        // Auth.js 默认会注入 openid profile email（OIDC），飞书不支持，必须显式覆盖
        scope: feishuScope,
      },
    },
    token: tokenUrl,
    async [customFetch](...args: Parameters<typeof fetch>) {
      const url = new URL(args[0] instanceof Request ? args[0].url : String(args[0]))

      if (url.pathname.endsWith('/authen/v2/oauth/token')) {
        const request = args[1]
        const params = new URLSearchParams(readRequestBody(request?.body ?? null))
        const code = params.get('code')
        const redirect_uri = params.get('redirect_uri')

        if (!code || !redirect_uri) {
          throw new Error('飞书授权失败: 缺少 code 或 redirect_uri')
        }

        const response = await fetch(tokenUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            grant_type: 'authorization_code',
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri,
          }),
        })

        const result = await response.json() as FeishuApiResponse<{
          access_token?: string
          token_type?: string
          expires_in?: number
          refresh_token?: string
          scope?: string
        }>

        const tokens = parseFeishuTokenPayload(result)
        return Response.json(tokens)
      }

      return fetch(...args)
    },
    userinfo: {
      url: `https://${openHost}/open-apis/authen/v1/user_info`,
      async request(context: {
        tokens: Record<string, unknown>
        provider: OAuthConfig<FeishuProfile>
      }) {
        const response = await fetch(`https://${openHost}/open-apis/authen/v1/user_info`, {
          headers: {
            Authorization: `Bearer ${String(context.tokens.access_token)}`,
          },
        })

        const result = await response.json() as FeishuApiResponse<FeishuProfile>

        if (result.code !== 0 || !result.data) {
          throw new Error(`获取飞书用户信息失败: ${result.msg ?? result.code}`)
        }

        return result.data
      },
    },
    profile(profile) {
      const id = profile.union_id ?? profile.open_id ?? profile.user_id!
      const email = profile.email?.trim()

      return {
        id,
        name: profile.name ?? profile.en_name ?? '飞书用户',
        email: email || `feishu_${id}@oauth.local`,
        image: profile.avatar_url,
      }
    },
    style: {
      bg: '#3370ff',
      text: '#fff',
    },
    options: providerOptions,
  }
}
