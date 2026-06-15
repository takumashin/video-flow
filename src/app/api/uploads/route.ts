import { NextResponse } from 'next/server'
import {
  getMaxSizeForKind,
  getUploadKind,
} from '@/lib/media-upload-shared'
import { saveUpload } from '@/lib/uploads'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')

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
    const { id, url } = await saveUpload(buffer, mimeType)

    return NextResponse.json({
      id,
      url,
      filename: file.name,
      size: file.size,
      kind,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '上传失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
