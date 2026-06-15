import { NextResponse } from 'next/server'
import { deleteWorkflow, getWorkflow, updateWorkflow } from '@/lib/workflow-storage'
import type { WorkflowEdge, WorkflowNode } from '@/lib/types'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const workflow = await getWorkflow(id)

    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, nodes, edges } = body

    if (nodes !== undefined && !Array.isArray(nodes)) {
      return NextResponse.json({ error: '节点数据格式无效' }, { status: 400 })
    }

    if (edges !== undefined && !Array.isArray(edges)) {
      return NextResponse.json({ error: '连线数据格式无效' }, { status: 400 })
    }

    const workflow = await updateWorkflow(id, {
      name,
      nodes: nodes as WorkflowNode[] | undefined,
      edges: edges as WorkflowEdge[] | undefined,
    })

    if (!workflow) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    return NextResponse.json(workflow)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '保存失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params
    const deleted = await deleteWorkflow(id)

    if (!deleted) {
      return NextResponse.json({ error: '工作流不存在' }, { status: 404 })
    }

    return NextResponse.json({ success: true })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '删除失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
