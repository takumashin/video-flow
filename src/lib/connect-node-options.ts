import {
  countUpstreamAudioConnections,
  countUpstreamImageConnections,
  countUpstreamVideoConnections,
  getSeedanceModeInputRules,
} from './seedance-connection-rules'
import type { SeedanceGenerationMode, WorkflowEdge, WorkflowNode } from './types'
import { NodeType } from './types'

export type ConnectHandleSide = 'source' | 'target'

export type ConnectMenuContext = {
  nodeId: string
  handleType: ConnectHandleSide
}

function getSeedanceUpstreamOptions(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): NodeType[] {
  const seedanceNode = nodes.find(node => node.id === seedanceNodeId)
  if (!seedanceNode || seedanceNode.data.type !== NodeType.Seedance)
    return []

  const mode = seedanceNode.data.generationMode ?? 'text_to_video'
  const rules = getSeedanceModeInputRules(mode)
  const options: NodeType[] = []

  if (rules.allowTextUpstream)
    options.push(NodeType.TextPrompt)

  if (rules.allowImages && countUpstreamImageConnections(seedanceNodeId, nodes, edges) < rules.maxImages)
    options.push(NodeType.ImageInput)

  if (rules.allowVideos && countUpstreamVideoConnections(seedanceNodeId, nodes, edges) < rules.maxVideos)
    options.push(NodeType.VideoInput)

  if (rules.allowAudios && countUpstreamAudioConnections(seedanceNodeId, nodes, edges) < rules.maxAudios)
    options.push(NodeType.AudioInput)

  return options
}

/** 拖线新建 Seedance 时，根据锚点节点推断默认生成模式 */
export function inferSeedanceGenerationModeForNewNode(
  anchorNode: WorkflowNode,
  handleType: ConnectHandleSide,
): SeedanceGenerationMode {
  if (handleType === 'source') {
    switch (anchorNode.data.type) {
      case NodeType.ImageInput:
        return 'image_to_video'
      case NodeType.VideoInput:
      case NodeType.AudioInput:
        return 'omni_reference'
      case NodeType.TextPrompt:
      case NodeType.Start:
      default:
        return 'text_to_video'
    }
  }

  return 'text_to_video'
}

export function getConnectableNodeTypes(
  context: ConnectMenuContext,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): NodeType[] {
  const node = nodes.find(item => item.id === context.nodeId)
  if (!node)
    return []

  if (context.handleType === 'source') {
    switch (node.data.type) {
      case NodeType.Start:
      case NodeType.TextPrompt:
      case NodeType.ImageInput:
      case NodeType.VideoInput:
      case NodeType.AudioInput:
        return [NodeType.Seedance]
      case NodeType.Seedance:
        return [NodeType.Output]
      default:
        return []
    }
  }

  switch (node.data.type) {
    case NodeType.Output:
      return [NodeType.Seedance]
    case NodeType.Seedance:
      return getSeedanceUpstreamOptions(node.id, nodes, edges)
    default:
      return []
  }
}

export function buildConnectionForNewNode(
  anchorNodeId: string,
  newNodeId: string,
  handleType: ConnectHandleSide,
): { source: string; target: string } {
  if (handleType === 'source')
    return { source: anchorNodeId, target: newNodeId }

  return { source: newNodeId, target: anchorNodeId }
}
