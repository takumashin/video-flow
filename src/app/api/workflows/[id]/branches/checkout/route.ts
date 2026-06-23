import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { checkoutWorkflowBranch } from '@/lib/workflow-branches-storage'
import { getWorkflow } from '@/lib/workflow-storage'
import type { WorkflowEdge, WorkflowNode } from '@/lib/types'

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { userId, workspaceId } = await requireAuth()
    const { id: workflowId } = await params

    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    const body = await request.json()
    const {
      targetBranch,
      fromBranch,
      name,
      nodes,
      edges,
      revision,
    } = body

    if (!targetBranch || typeof targetBranch !== 'string') {
      return NextResponse.json({ error: '请提供目标分支' }, { status: 400 })
    }

    if (!fromBranch || typeof fromBranch !== 'string') {
      return NextResponse.json({ error: '请提供当前分支' }, { status: 400 })
    }

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return NextResponse.json({ error: '工作流数据无效' }, { status: 400 })
    }

    const result = await checkoutWorkflowBranch(
      workflowId,
      workspaceId,
      targetBranch,
      fromBranch,
      {
        name: typeof name === 'string' ? name : workflow.name,
        nodes: nodes as WorkflowNode[],
        edges: edges as WorkflowEdge[],
        revision: typeof revision === 'number' ? revision : workflow.revision,
      },
      userId,
    )

    return NextResponse.json({ workflow: result })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
