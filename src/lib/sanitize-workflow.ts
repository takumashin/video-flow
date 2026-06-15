import type { WorkflowNode } from './types'
import { NodeType } from './types'

export function sanitizeNodesForSave(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map(node => {
    const data = node.data

    if (data.type === NodeType.Seedance) {
      return {
        ...node,
        data: {
          ...data,
          status: 'idle',
          taskId: undefined,
          error: undefined,
          progress: undefined,
          progressStartedAt: undefined,
        },
      }
    }

    if (data.type === NodeType.Output) {
      return {
        ...node,
        data: {
          ...data,
          status: data.videoUrl || data.videoHistory?.length ? 'succeeded' : 'idle',
        },
      }
    }

    return node
  })
}
