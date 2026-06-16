import { NextResponse } from 'next/server'
import {
  getMaxSizeForKind,
  getUploadKind,
} from '@/lib/media-upload-shared'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { listUploads, saveUpload, type UploadFolderFilter } from '@/lib/uploads'

function parseFolderFilter(value: string | null): UploadFolderFilter {
  if (!value || value === 'all')
    return 'all'
  if (value === 'uncategorized')
    return 'uncategorized'
  return value
}

export async function GET(request: Request) {
  try {
    const { workspaceId } = await requireAuth()
    const folder = parseFolderFilter(new URL(request.url).searchParams.get('folderId'))
    const uploads = await listUploads(workspaceId, folder)
    return NextResponse.json({ uploads })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function POST(request: Request) {
  try {
    const { workspaceId, userId } = await requireAuth()
    const formData = await request.formData()
    const file = formData.get('file')
    const folderIdRaw = formData.get('folderId')
    const folderId = typeof folderIdRaw === 'string' && folderIdRaw.trim()
      ? folderIdRaw.trim()
      : null

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: '请上传文件' }, { status: 400 })
    }

    const kind = getUploadKind(file)
    if (!kind) {
      return NextResponse.json({
        error: '请上传图片、视频或音频文件（JPG/PNG/WebP、MP4/WebM、MP3/WAV 等）',
      }, { status: 400 })
    }

    const maxSize = getMaxSizeForKind(kind)
    if (file.size > maxSize) {
      const limitLabel = kind === 'image' ? '10MB' : kind === 'video' ? '5MB' : '10MB'
      return NextResponse.json({ error: `文件大小不能超过 ${limitLabel}` }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const mimeType = file.type || (kind === 'image' ? 'image/jpeg' : kind === 'video' ? 'video/mp4' : 'audio/mpeg')
    const { id, url } = await saveUpload(buffer, mimeType, workspaceId, userId, file.name, folderId)

    return NextResponse.json({
      id,
      url,
      filename: file.name,
      size: file.size,
      kind,
      folderId,
    })
  }
  catch (error) {
    if (error instanceof Error && error.message === '文件夹不存在') {
      return NextResponse.json({ error: error.message }, { status: 400 })
    }
    return authErrorResponse(error)
  }
}
