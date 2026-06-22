import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getWorkflow } from '@/lib/workflow-storage'
import { restoreVersion } from '@/lib/workflow-versions-storage'

// POST /api/workflows/[id]/versions/restore — restore from a version
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuth()
    const { id: workflowId } = await params

    // Verify workflow exists and belongs to workspace
    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    const body = await request.json()
    const { versionId } = body

    if (!versionId || typeof versionId !== 'string') {
      return NextResponse.json({ error: '请提供要恢复的版本 ID' }, { status: 400 })
    }

    const restored = await restoreVersion(workflowId, versionId, userId)

    return NextResponse.json({ workflow: restored })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
