import nodemailer from 'nodemailer'

export type SendEmailInput = {
  to: string
  subject: string
  html: string
  text?: string
}

function getSmtpConfig() {
  const host = process.env.SMTP_HOST?.trim()
  const port = Number(process.env.SMTP_PORT ?? '587')
  const user = process.env.SMTP_USER?.trim()
  const pass = process.env.SMTP_PASS?.trim()
  const from = process.env.SMTP_FROM?.trim() || user

  if (!host || !from)
    return null

  return {
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
    from,
  }
}

export function getAppBaseUrl() {
  return (process.env.AUTH_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000').replace(/\/$/, '')
}

export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean; devPreviewUrl?: string }> {
  const smtp = getSmtpConfig()

  if (!smtp) {
    if (process.env.NODE_ENV === 'production') {
      console.warn('[email] SMTP 未配置，跳过发送:', input.subject, '->', input.to)
      return { sent: false }
    }

    const preview = input.text ?? input.html.replace(/<[^>]+>/g, ' ')
    console.info('[email:dev]', {
      to: input.to,
      subject: input.subject,
      body: preview,
    })
    return { sent: true, devPreviewUrl: preview.match(/https?:\/\/\S+/)?.[0] }
  }

  const transport = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.port,
    secure: smtp.secure,
    auth: smtp.auth,
  })

  await transport.sendMail({
    from: smtp.from,
    to: input.to,
    subject: input.subject,
    html: input.html,
    text: input.text,
  })

  return { sent: true }
}
