import type { OutputNodeData, VideoHistoryItem, WorkflowEdge, WorkflowNode } from './types'
import { NodeType } from './types'

function mergeVideoHistory(
  seedanceHistory: VideoHistoryItem[] | undefined,
  outputHistory: VideoHistoryItem[] | undefined,
): VideoHistoryItem[] {
  const merged = [...(outputHistory ?? []), ...(seedanceHistory ?? [])]
  const seen = new Set<string>()
  const unique: VideoHistoryItem[] = []

  for (const item of merged) {
    const key = item.id || `${item.videoUrl}-${item.createdAt}`
    if (seen.has(key))
      continue
    seen.add(key)
    unique.push(item)
  }

  return unique.sort((a, b) => b.createdAt - a.createdAt)
}

/** 将旧版「视频输出」节点合并进上游 Seedance 节点，并移除多余连线 */
export function migrateOutputNodesIntoSeedance(
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } {
  const outputNodes = nodes.filter(node => node.data.type === NodeType.Output)
  if (outputNodes.length === 0)
    return { nodes, edges }

  let nextNodes = nodes.map(node => ({ ...node, data: { ...node.data } }))
  let nextEdges = [...edges]

  for (const outputNode of outputNodes) {
    const outputData = outputNode.data as OutputNodeData
    const upstreamEdge = nextEdges.find(edge => edge.target === outputNode.id)
    const seedanceNode = upstreamEdge
      ? nextNodes.find(node => node.id === upstreamEdge.source && node.data.type === NodeType.Seedance)
      : undefined

    if (seedanceNode && seedanceNode.data.type === NodeType.Seedance) {
      const videoHistory = mergeVideoHistory(seedanceNode.data.videoHistory, outputData.videoHistory)
      const videoUrl = outputData.videoUrl ?? videoHistory[0]?.videoUrl ?? seedanceNode.data.videoUrl

      nextNodes = nextNodes.map(node =>
        node.id === seedanceNode.id && node.data.type === NodeType.Seedance
          ? {
              ...node,
              data: {
                ...node.data,
                videoUrl,
                videoHistory,
                status: videoUrl ? 'succeeded' : node.data.status,
              },
            }
          : node,
      )
    }

    nextEdges = nextEdges.filter(
      edge => edge.source !== outputNode.id && edge.target !== outputNode.id,
    )
  }

  nextNodes = nextNodes.filter(node => node.data.type !== NodeType.Output)

  return { nodes: nextNodes, edges: nextEdges }
}
