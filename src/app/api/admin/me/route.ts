import { NextResponse } from 'next/server'
import { isAdminEmail, requireAdmin } from '@/lib/admin/context'
import { auth } from '@/lib/auth/config'

export async function GET() {
  const session = await auth()
  if (!session?.user?.id)
    return NextResponse.json({ isAdmin: false })

  try {
    await requireAdmin()
    return NextResponse.json({ isAdmin: true })
  }
  catch {
    return NextResponse.json({ isAdmin: isAdminEmail(session.user.email) })
  }
}
