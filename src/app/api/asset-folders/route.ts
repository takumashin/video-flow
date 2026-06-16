import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import {
  countUncategorizedAssets,
  createAssetFolder,
  listAssetFolders,
} from '@/lib/asset-folders/service'

export async function GET() {
  try {
    const { workspaceId } = await requireAuth()
    const [folders, uncategorizedCount] = await Promise.all([
      listAssetFolders(workspaceId),
      countUncategorizedAssets(workspaceId),
    ])

    return NextResponse.json({ folders, uncategorizedCount })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId } = await requireAuth()
    const body = await request.json()
    const name = typeof body.name === 'string' ? body.name.trim() : ''

    if (!name)
      return NextResponse.json({ error: '请填写文件夹名称' }, { status: 400 })

    const folder = await createAssetFolder(workspaceId, name)
    return NextResponse.json({
      folder: {
        id: folder.id,
        name: folder.name,
        assetCount: 0,
        createdAt: folder.createdAt.getTime(),
        updatedAt: folder.updatedAt.getTime(),
      },
    })
  }
  catch (error) {
    if (error instanceof Error && error.message.includes('unique')) {
      return NextResponse.json({ error: '该文件夹名称已存在' }, { status: 409 })
    }
    return authErrorResponse(error)
  }
}
