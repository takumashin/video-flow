import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getLastWorkflowId, setLastWorkflowId } from '@/lib/workspace/workflow-state'
import { getWorkflow } from '@/lib/workflow-storage'

export async function GET() {
  try {
    const { userId, workspaceId } = await requireAuth()
    const lastWorkflowId = await getLastWorkflowId(userId, workspaceId)

    if (!lastWorkflowId)
      return NextResponse.json({ workflow: null })

    const workflow = await getWorkflow(lastWorkflowId, workspaceId)
    return NextResponse.json({ workflow })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(request: Request) {
  try {
    const { userId, workspaceId } = await requireAuth()
    const body = await request.json()
    const workflowId = typeof body.workflowId === 'string' ? body.workflowId : ''

    if (!workflowId)
      return NextResponse.json({ error: '缺少 workflowId' }, { status: 400 })

    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow)
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })

    await setLastWorkflowId(userId, workspaceId, workflowId)
    return NextResponse.json({ success: true })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
