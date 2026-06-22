import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getWorkflow } from '@/lib/workflow-storage'
import { createBranch, listBranches } from '@/lib/workflow-versions-storage'

// GET /api/workflows/[id]/branches — list branches
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { workspaceId } = await requireAuth()
    const { id: workflowId } = await params

    const workflow = await getWorkflow(workflowId, workspaceId)
    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    const branches = await listBranches(workflowId)
    return NextResponse.json({ branches })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

// POST /api/workflows/[id]/branches — create branch
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
    const { name, sourceVersionId } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '请提供分支名称' }, { status: 400 })
    }

    if (!sourceVersionId || typeof sourceVersionId !== 'string') {
      return NextResponse.json({ error: '请提供源版本 ID' }, { status: 400 })
    }

    const branch = await createBranch(
      workflowId,
      name.trim(),
      sourceVersionId,
      userId,
    )

    return NextResponse.json({ branch }, { status: 201 })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
