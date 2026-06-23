import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getWorkflow } from '@/lib/workflow-storage'
import { getVersionDiff } from '@/lib/workflow-versions-storage'

// GET /api/workflows/[id]/versions/diff?v1=...&v2=... — diff two versions
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id: workflowId } = await params

    // Verify workflow exists and belongs to workspace
    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    const url = new URL(request.url)
    const v1 = url.searchParams.get('v1')
    const v2 = url.searchParams.get('v2')

    if (!v1 || !v2) {
      return NextResponse.json({ error: '请提供 v1 和 v2 两个版本 ID' }, { status: 400 })
    }

    const diff = await getVersionDiff(workflowId, v1, v2)
    if (!diff) {
      return NextResponse.json({ error: '版本不存在或不属于该工作流' }, { status: 404 })
    }

    return NextResponse.json({ diff })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
