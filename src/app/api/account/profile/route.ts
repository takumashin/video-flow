import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth/config'
import { authErrorResponse } from '@/lib/auth/context'
import { getUserProfile, updateUserProfile } from '@/lib/auth/user-profile'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const profile = await getUserProfile(session.user.id)
    if (!profile)
      return NextResponse.json({ error: '用户不存在' }, { status: 404 })

    return NextResponse.json({ profile })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await auth()
    if (!session?.user?.id)
      return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name : undefined
    const image = body.image === null || typeof body.image === 'string' ? body.image : undefined

    const profile = await updateUserProfile(session.user.id, { name, image })
    return NextResponse.json({ profile })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
