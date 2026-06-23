import { NextResponse } from 'next/server'

export function createByteRangeResponse(
  buffer: Buffer | Uint8Array,
  request: Request,
  headers: Record<string, string> = {},
): Response {
  const size = buffer.byteLength
  const baseHeaders: Record<string, string> = {
    'Accept-Ranges': 'bytes',
    ...headers,
  }

  const range = request.headers.get('range')
  if (!range) {
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        ...baseHeaders,
        'Content-Length': String(size),
      },
    })
  }

  const match = /^bytes=(\d*)-(\d*)$/i.exec(range.trim())
  if (!match) {
    return new NextResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    })
  }

  let start = match[1] ? Number.parseInt(match[1], 10) : 0
  let end = match[2] ? Number.parseInt(match[2], 10) : size - 1

  if (!Number.isFinite(start) || !Number.isFinite(end) || start >= size || start > end) {
    return new NextResponse(null, {
      status: 416,
      headers: { 'Content-Range': `bytes */${size}` },
    })
  }

  end = Math.min(end, size - 1)
  const chunk = buffer.subarray(start, end + 1)

  return new NextResponse(new Uint8Array(chunk), {
    status: 206,
    headers: {
      ...baseHeaders,
      'Content-Range': `bytes ${start}-${end}/${size}`,
      'Content-Length': String(chunk.byteLength),
    },
  })
}
