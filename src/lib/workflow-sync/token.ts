import { createHmac, timingSafeEqual } from 'node:crypto'

export type WorkflowSyncTokenPayload = {
  userId: string
  userName: string
  userImage: string | null
  workspaceId: string
  exp: number
}

const TOKEN_TTL_MS = 15 * 60 * 1000

function base64UrlEncode(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function base64UrlDecode(value: string): string {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function signPayload(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

export function getWorkflowSyncSecret(): string {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret)
    throw new Error('AUTH_SECRET 未设置')
  return secret
}

export function createWorkflowSyncToken(input: {
  userId: string
  userName: string
  userImage: string | null
  workspaceId: string
}): { token: string, expiresAt: number } {
  const secret = getWorkflowSyncSecret()
  const expiresAt = Date.now() + TOKEN_TTL_MS
  const payload: WorkflowSyncTokenPayload = {
    userId: input.userId,
    userName: input.userName,
    userImage: input.userImage,
    workspaceId: input.workspaceId,
    exp: expiresAt,
  }
  const encodedPayload = base64UrlEncode(JSON.stringify(payload))
  const signature = signPayload(encodedPayload, secret)
  return { token: `${encodedPayload}.${signature}`, expiresAt }
}

export function verifyWorkflowSyncToken(token: string): WorkflowSyncTokenPayload | null {
  const secret = process.env.AUTH_SECRET?.trim()
  if (!secret)
    return null

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature)
    return null

  const expected = signPayload(encodedPayload, secret)
  const sigBuffer = Buffer.from(signature)
  const expectedBuffer = Buffer.from(expected)
  if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer))
    return null

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload)) as WorkflowSyncTokenPayload
    if (!payload.userId || !payload.workspaceId || !payload.exp)
      return null
    if (Date.now() > payload.exp)
      return null
    return payload
  }
  catch {
    return null
  }
}

export function getWorkflowWsPort(): number {
  const raw = process.env.WORKFLOW_WS_PORT?.trim()
  if (!raw)
    return 3001
  const parsed = Number.parseInt(raw, 10)
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3001
}

function wsProtocolForHttpProtocol(protocol: string): 'ws' | 'wss' {
  return protocol === 'https:' ? 'wss' : 'ws'
}

function isUnusableClientHost(hostname: string): boolean {
  return !hostname || hostname === '0.0.0.0' || hostname === '::' || hostname === '[::]'
}

/** 解析协作 WebSocket 地址：优先 env，其次 AUTH_URL / 请求 Host，最后 localhost */
export function resolveWorkflowWsUrl(requestHost?: string | null): string {
  const port = getWorkflowWsPort()

  for (const candidate of [
    process.env.WORKFLOW_WS_URL?.trim(),
    process.env.NEXT_PUBLIC_WORKFLOW_WS_URL?.trim(),
  ]) {
    if (!candidate)
      continue
    try {
      const url = new URL(candidate)
      if (!isUnusableClientHost(url.hostname))
        return candidate
    }
    catch {
      // ignore invalid URL
    }
  }

  const authUrl = process.env.AUTH_URL?.trim() || process.env.NEXTAUTH_URL?.trim()
  if (authUrl) {
    try {
      const url = new URL(authUrl)
      if (!isUnusableClientHost(url.hostname)) {
        const wsProtocol = wsProtocolForHttpProtocol(url.protocol)
        return `${wsProtocol}://${url.hostname}:${port}`
      }
    }
    catch {
      // fall through
    }
  }

  const host = requestHost?.trim()
  if (host) {
    const hostname = host.split(':')[0]
    if (!isUnusableClientHost(hostname))
      return `ws://${hostname}:${port}`
  }

  return `ws://127.0.0.1:${port}`
}

export function getWorkflowWsUrl(): string {
  return resolveWorkflowWsUrl()
}
