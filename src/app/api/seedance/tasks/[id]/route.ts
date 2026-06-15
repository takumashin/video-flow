import { NextResponse } from 'next/server'
import { extractSeedanceTaskProgress, getSeedanceTask } from '@/lib/seedance'

type RouteParams = {
  params: Promise<{ id: string }>
}

export async function GET(_request: Request, { params }: RouteParams) {
  try {
    const { id } = await params
    const task = await getSeedanceTask(id)
    const progress = extractSeedanceTaskProgress(task)

    return NextResponse.json({
      taskId: task.id,
      status: task.status,
      progress,
      videoUrl: task.content?.video_url,
      error: task.error?.message,
      createdAt: task.created_at,
      updatedAt: task.updated_at,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '未知错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
