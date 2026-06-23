import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import AuthSessionProvider from '@/components/auth-session-provider'
import ThemeProvider from '@/components/theme-provider'
import Toaster from '@/components/toaster'
import { SITE_LOGO_SRC } from '@/lib/site-logo'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

const themeInitScript = `
(function () {
  try {
    var stored = JSON.parse(localStorage.getItem('seedance-theme') || '{}');
    var mode = stored.state && stored.state.mode ? stored.state.mode : 'dark';
    var dark =
      mode === 'dark' ||
      (mode === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.documentElement.classList.toggle('dark', dark);
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light';
  } catch (_) {}
})();
`

export const metadata: Metadata = {
  title: 'Seedance Studio - AI 视频生成工作流',
  description: '基于 React Flow 的 AI 视频生成工具，接入火山引擎 Seedance API',
  icons: {
    icon: SITE_LOGO_SRC,
    apple: SITE_LOGO_SRC,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="zh-CN"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script>{themeInitScript}</script>
      </head>
      <body className="h-full overflow-hidden bg-background text-foreground">
        <AuthSessionProvider>
          <ThemeProvider>{children}</ThemeProvider>
          <Toaster />
        </AuthSessionProvider>
      </body>
    </html>
  )
}
