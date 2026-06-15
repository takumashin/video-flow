import { NextResponse } from 'next/server'
import { getMimeTypeFromFilename, readUpload } from '@/lib/uploads'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const file = await readUpload(id)

    if (!file) {
      return NextResponse.json({ error: '文件不存在' }, { status: 404 })
    }

    const mimeType = getMimeTypeFromFilename(id)

    return new NextResponse(new Uint8Array(file.buffer), {
      headers: {
        'Content-Type': mimeType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
