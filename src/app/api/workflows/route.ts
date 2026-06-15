import { NextResponse } from 'next/server'
import { createWorkflow, listWorkflows } from '@/lib/workflow-storage'
import type { WorkflowEdge, WorkflowNode } from '@/lib/types'

export async function GET() {
  try {
    const workflows = await listWorkflows()
    return NextResponse.json({ workflows })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '读取失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { name, nodes, edges } = body

    if (!Array.isArray(nodes) || !Array.isArray(edges)) {
      return NextResponse.json({ error: '工作流数据格式无效' }, { status: 400 })
    }

    const workflow = await createWorkflow(
      name || '未命名工作流',
      nodes as WorkflowNode[],
      edges as WorkflowEdge[],
    )

    return NextResponse.json(workflow)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : '保存失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
