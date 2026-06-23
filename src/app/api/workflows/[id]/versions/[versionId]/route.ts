import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getWorkflow } from '@/lib/workflow-storage'
import { getWorkflowVersion } from '@/lib/workflow-versions-storage'

// GET /api/workflows/[id]/versions/[versionId] — get single version detail
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string; versionId: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id: workflowId, versionId } = await params

    // Verify workflow exists and belongs to workspace
    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    const version = await getWorkflowVersion(versionId)
    if (!version || version.workflowId !== workflowId) {
      return NextResponse.json({ error: '版本不存在' }, { status: 404 })
    }

    return NextResponse.json({ version })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
