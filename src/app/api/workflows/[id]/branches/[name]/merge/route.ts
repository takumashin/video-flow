import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { mergeBranchIntoMain } from '@/lib/workflow-branches-storage'
import { getWorkflow } from '@/lib/workflow-storage'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuth()
    const { id: workflowId, name: branchName } = await params

    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    const result = await mergeBranchIntoMain(workflowId, workspaceId, decodeURIComponent(branchName), userId)
    return NextResponse.json(result)
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
