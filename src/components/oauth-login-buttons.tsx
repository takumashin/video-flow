'use client'

import { signIn } from 'next-auth/react'
import { FEISHU_OAUTH_LOGO_URL } from '@/lib/feishu-brand'

type OAuthLoginButtonsProps = {
  callbackUrl: string
}

export function OAuthLoginButtons({ callbackUrl }: OAuthLoginButtonsProps) {
  const hasWeChat = process.env.NEXT_PUBLIC_AUTH_WECHAT_ENABLED === 'true'
  const hasFeishu = process.env.NEXT_PUBLIC_AUTH_FEISHU_ENABLED === 'true'
  const hasWeibo = process.env.NEXT_PUBLIC_AUTH_WEIBO_ENABLED === 'true'

  if (!hasWeChat && !hasFeishu && !hasWeibo)
    return null

  return (
    <div className="mt-6 space-y-3">
      <div className="relative text-center text-xs text-muted">
        <span className="bg-surface px-2">或使用第三方登录</span>
      </div>
      {hasFeishu && (
        <p className="text-center text-xs leading-relaxed text-muted">
          飞书登录首次使用将自动创建账号，无需单独注册
        </p>
      )}
      <div className="grid gap-2 sm:grid-cols-2">
        {hasFeishu && (
          <button
            type="button"
            onClick={() => signIn('feishu', { callbackUrl })}
            className="inline-flex w-full items-center justify-center gap-2.5 rounded-lg border border-[#dee0e3] bg-white px-4 py-2.5 text-sm font-medium text-[#1f2329] shadow-sm transition hover:bg-[#f5f6f7] sm:col-span-2 dark:border-border dark:bg-surface dark:text-foreground dark:hover:bg-surface-muted"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={FEISHU_OAUTH_LOGO_URL}
              alt=""
              width={20}
              height={20}
              className="h-5 w-5 shrink-0 object-contain"
              decoding="async"
            />
            飞书登录
          </button>
        )}
        {hasWeChat && (
          <button
            type="button"
            onClick={() => signIn('wechat', { callbackUrl })}
            className="rounded-lg border border-border bg-[#07c160] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            微信登录
          </button>
        )}
        {hasWeibo && (
          <button
            type="button"
            onClick={() => signIn('weibo', { callbackUrl })}
            className="rounded-lg border border-border bg-[#ff8200] px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90"
          >
            微博登录
          </button>
        )}
      </div>
    </div>
  )
}
