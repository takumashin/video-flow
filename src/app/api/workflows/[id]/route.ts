import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { deleteWorkflow, getWorkflow, updateWorkflow } from '@/lib/workflow-storage'
import type { WorkflowEdge, WorkflowNode } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id } = await params
    const workflow = await getWorkflow(id, workspaceId)

    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id } = await params
    const body = await request.json()
    const { name, nodes, edges, expectedRevision, force } = body

    if (nodes !== undefined && !Array.isArray(nodes)) {
      return NextResponse.json({ error: '节点数据格式无效' }, { status: 400 })
    }

    if (edges !== undefined && !Array.isArray(edges)) {
      return NextResponse.json({ error: '连线数据格式无效' }, { status: 400 })
    }

    const result = await updateWorkflow(id, workspaceId, {
      name,
      nodes: nodes as WorkflowNode[] | undefined,
      edges: edges as WorkflowEdge[] | undefined,
      expectedRevision: typeof expectedRevision === 'number' ? expectedRevision : undefined,
      force: force === true,
    })

    if (!result) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    if (!result.ok) {
      return NextResponse.json({
        error: '工作流已被其他协作者更新，请处理冲突后再保存',
        code: 'WORKFLOW_REVISION_CONFLICT',
        workflow: result.workflow,
      }, { status: 409 })
    }

    return NextResponse.json(result.workflow)
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id } = await params
    const deleted = await deleteWorkflow(id, workspaceId)

    if (!deleted) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
