import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

function devAllowedOrigins(): string[] {
  const origins = new Set<string>()
  for (const key of ['AUTH_URL', 'NEXTAUTH_URL'] as const) {
    const raw = process.env[key]?.trim()
    if (!raw)
      continue
    try {
      origins.add(new URL(raw).hostname)
    }
    catch {
      // ignore invalid URL
    }
  }
  return [...origins]
}

const allowedDevOrigins = devAllowedOrigins()

const nextConfig: NextConfig = {
  ...(allowedDevOrigins.length ? { allowedDevOrigins } : {}),
  turbopack: {
    root: projectRoot,
  },
  env: {
    NEXTAUTH_URL: process.env.AUTH_URL ?? process.env.NEXTAUTH_URL ?? '',
    NEXT_PUBLIC_AUTH_WECHAT_ENABLED: process.env.AUTH_WECHAT_APP_ID ? 'true' : '',
    NEXT_PUBLIC_AUTH_FEISHU_ENABLED: process.env.AUTH_FEISHU_APP_ID ? 'true' : '',
    NEXT_PUBLIC_AUTH_WEIBO_ENABLED: process.env.AUTH_WEIBO_CLIENT_ID ? 'true' : '',
  },
}

export default nextConfig
