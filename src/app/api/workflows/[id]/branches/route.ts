import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getWorkflow } from '@/lib/workflow-storage'
import { listBranches, createBranchFromCurrent } from '@/lib/workflow-branches-storage'

// GET /api/workflows/[id]/branches — list branches
export async function GET(
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

    const url = new URL(request.url)
    const status = url.searchParams.get('status') as 'active' | 'archived' | 'merged' | 'all' | null
    const mine = url.searchParams.get('mine') === 'true'

    const branches = await listBranches(workflowId, {
      userId: mine ? userId : undefined,
      status: status ?? 'all',
    })
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
    const { name, description, sourceVersionId } = body

    if (!name || typeof name !== 'string' || !name.trim()) {
      return NextResponse.json({ error: '请提供分支名称' }, { status: 400 })
    }

    const branch = await createBranchFromCurrent(
      workflowId,
      name.trim(),
      userId,
      {
        description: typeof description === 'string' ? description.trim() : undefined,
        sourceVersionId: typeof sourceVersionId === 'string' ? sourceVersionId : undefined,
      },
    )

    return NextResponse.json({ branch }, { status: 201 })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
