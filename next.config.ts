import type { NextConfig } from 'next'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = path.dirname(fileURLToPath(import.meta.url))

const nextConfig: NextConfig = {
  turbopack: {
    root: projectRoot,
  },
  env: {
    NEXT_PUBLIC_AUTH_WECHAT_ENABLED: process.env.AUTH_WECHAT_APP_ID ? 'true' : '',
    NEXT_PUBLIC_AUTH_FEISHU_ENABLED: process.env.AUTH_FEISHU_APP_ID ? 'true' : '',
    NEXT_PUBLIC_AUTH_WEIBO_ENABLED: process.env.AUTH_WEIBO_CLIENT_ID ? 'true' : '',
  },
}

export default nextConfig
