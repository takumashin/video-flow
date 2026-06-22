import { NextResponse } from 'next/server'
import { authErrorResponse, requireAuth } from '@/lib/auth/context'
import { getWorkflow } from '@/lib/workflow-storage'
import {
  createNamedVersion,
  listWorkflowVersions,
} from '@/lib/workflow-versions-storage'

// GET /api/workflows/[id]/versions — list versions
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
    const branchName = url.searchParams.get('branch') ?? 'main'
    const type = url.searchParams.get('type') as 'auto' | 'manual' | 'restore' | null
    const limit = Math.min(Number(url.searchParams.get('limit')) || 20, 100)
    const offset = Math.max(Number(url.searchParams.get('offset')) || 0, 0)

    const versions = await listWorkflowVersions(workflowId, {
      branchName,
      type: type || undefined,
      limit,
      offset,
    })

    return NextResponse.json({ versions })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}

// POST /api/workflows/[id]/versions — create named version
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
    const { label, description } = body

    if (!label || typeof label !== 'string' || !label.trim()) {
      return NextResponse.json({ error: '请提供版本标签' }, { status: 400 })
    }

    const version = await createNamedVersion(
      workflowId,
      userId,
      label.trim(),
      description?.trim() || undefined,
    )

    return NextResponse.json({ version }, { status: 201 })
  }
  catch (error) {
    return authErrorResponse(error)
  }
}
