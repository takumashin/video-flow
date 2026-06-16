type FeishuApiResponse<T> = {
  code: number
  msg?: string
  data?: T
}

let cachedTenantToken: { token: string; expiresAt: number } | null = null

export function isFeishuAppConfigured() {
  return !!(
    process.env.AUTH_FEISHU_APP_ID?.trim()
    && process.env.AUTH_FEISHU_APP_SECRET?.trim()
  )
}

export function getFeishuOpenHost() {
  return process.env.AUTH_FEISHU_DOMAIN === 'lark'
    ? 'open.larksuite.com'
    : 'open.feishu.cn'
}

export async function getFeishuTenantAccessToken() {
  if (!isFeishuAppConfigured())
    throw new Error('飞书应用未配置')

  const now = Date.now()
  if (cachedTenantToken && cachedTenantToken.expiresAt > now + 60_000)
    return cachedTenantToken.token

  const host = getFeishuOpenHost()
  const response = await fetch(`https://${host}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: process.env.AUTH_FEISHU_APP_ID,
      app_secret: process.env.AUTH_FEISHU_APP_SECRET,
    }),
  })

  const result = await response.json() as FeishuApiResponse<{
    tenant_access_token?: string
    expire?: number
  }>

  if (result.code !== 0 || !result.data?.tenant_access_token)
    throw new Error(result.msg || '获取飞书 tenant token 失败')

  cachedTenantToken = {
    token: result.data.tenant_access_token,
    expiresAt: now + (result.data.expire ?? 7200) * 1000,
  }

  return cachedTenantToken.token
}

export async function feishuApiRequest<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const token = await getFeishuTenantAccessToken()
  const host = getFeishuOpenHost()
  const response = await fetch(`https://${host}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=utf-8',
      ...init?.headers,
    },
  })

  const result = await response.json() as FeishuApiResponse<T>
  if (result.code !== 0)
    throw new Error(result.msg || `飞书 API 错误 (${result.code})`)

  return result.data as T
}
