import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { renameBranch } from '@/lib/workflow-branches-storage'
import { getWorkflow } from '@/lib/workflow-storage'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string; name: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id: workflowId, name: oldName } = await params

    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    const body = await request.json()
    const { newName } = body

    if (!newName || typeof newName !== 'string' || !newName.trim()) {
      return NextResponse.json({ error: '请提供新分支名称' }, { status: 400 })
    }

    await renameBranch(workflowId, decodeURIComponent(oldName), newName.trim())
    return NextResponse.json({ success: true, name: newName.trim() })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
