import type { SeedanceNodeData, WorkflowNode } from './types'
import { NodeType } from './types'

function isActiveSeedanceTaskData(data: SeedanceNodeData): boolean {
  if (!data.taskId)
    return false

  if (data.status === 'running')
    return true

  return data.taskStatus === 'waiting'
    || data.taskStatus === 'submitting'
    || data.taskStatus === 'queued'
    || data.taskStatus === 'running'
}

/** 从服务端加载工作流时，确保带 error 的 Seedance 节点状态一致 */
export function normalizeSeedanceNodesOnLoad(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => {
    const data = node.data
    if (data.type !== NodeType.Seedance || !data.error)
      return node

    return {
      ...node,
      data: {
        ...data,
        status: 'failed',
        progress: undefined,
        progressStartedAt: undefined,
        taskStatus: undefined,
        queuePosition: undefined,
      },
    }
  })
}

export function sanitizeNodesForSave(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((node) => {
    const data = node.data

    if (data.type === NodeType.Seedance) {
      if (isActiveSeedanceTaskData(data)) {
        return {
          ...node,
          data: {
            ...data,
            status: 'running',
            progress: undefined,
            error: undefined,
          },
        }
      }

      const hasPersistedFailure = data.status === 'failed' || Boolean(data.error)

      return {
        ...node,
        data: {
          ...data,
          status: hasPersistedFailure ? 'failed' : 'idle',
          taskId: hasPersistedFailure ? data.taskId : undefined,
          taskStatus: undefined,
          queuePosition: undefined,
          error: hasPersistedFailure ? data.error : undefined,
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
