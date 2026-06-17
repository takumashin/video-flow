import {
  countUpstreamAudioConnections,
  countUpstreamImageConnections,
  countUpstreamVideoConnections,
  getSeedanceModeInputRules,
  resolveSeedanceModeForConnection,
} from './seedance-connection-rules'
import type { SeedanceGenerationMode, WorkflowEdge, WorkflowNode } from './types'
import { NodeType } from './types'

export type ConnectHandleSide = 'source' | 'target'

export type ConnectMenuContext = {
  nodeId: string
  handleType: ConnectHandleSide
}

/** Seedance 上游菜单展示顺序（参考素材优先） */
export const SEEDANCE_UPSTREAM_NODE_ORDER: NodeType[] = [
  NodeType.ImageInput,
  NodeType.VideoInput,
  NodeType.AudioInput,
  NodeType.TextPrompt,
]

export function isSeedanceUpstreamConnectContext(
  context: ConnectMenuContext,
  nodes: WorkflowNode[],
): boolean {
  const node = nodes.find(item => item.id === context.nodeId)
  return node?.data.type === NodeType.Seedance && context.handleType === 'target'
}

export function shouldShowConnectNodeMenu(
  context: ConnectMenuContext,
  nodes: WorkflowNode[],
  connectableTypes: NodeType[],
): boolean {
  if (connectableTypes.length === 0)
    return false
  if (connectableTypes.length > 1)
    return true
  return isSeedanceUpstreamConnectContext(context, nodes)
}

function canConnectUpstreamType(
  seedanceNode: WorkflowNode,
  upstreamType: NodeType,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): boolean {
  const pseudoSource: WorkflowNode = {
    id: `__preview_${upstreamType}`,
    type: 'custom',
    position: { x: 0, y: 0 },
    data: upstreamType === NodeType.TextPrompt
      ? { type: NodeType.TextPrompt, title: '文本提示词', prompt: '' }
      : upstreamType === NodeType.ImageInput
        ? { type: NodeType.ImageInput, title: '参考图片', imageUrl: '', role: 'first_frame' }
        : upstreamType === NodeType.VideoInput
          ? { type: NodeType.VideoInput, title: '参考视频', mediaUrl: '' }
          : { type: NodeType.AudioInput, title: '参考音频', mediaUrl: '' },
  }

  if (seedanceNode.data.type !== NodeType.Seedance)
    return false

  const autoMode = resolveSeedanceModeForConnection(pseudoSource, seedanceNode, nodes, edges)
  const mode = autoMode ?? (seedanceNode.data.generationMode ?? 'text_to_video')
  const rules = getSeedanceModeInputRules(mode)

  if (upstreamType === NodeType.TextPrompt)
    return rules.allowTextUpstream

  if (upstreamType === NodeType.ImageInput) {
    if (!rules.allowImages)
      return false
    return countUpstreamImageConnections(seedanceNode.id, nodes, edges) < rules.maxImages
  }

  if (upstreamType === NodeType.VideoInput) {
    if (!rules.allowVideos)
      return false
    return countUpstreamVideoConnections(seedanceNode.id, nodes, edges) < rules.maxVideos
  }

  if (upstreamType === NodeType.AudioInput) {
    if (!rules.allowAudios)
      return false
    return countUpstreamAudioConnections(seedanceNode.id, nodes, edges) < rules.maxAudios
  }

  return false
}

function getSeedanceUpstreamOptions(
  seedanceNodeId: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): NodeType[] {
  const seedanceNode = nodes.find(node => node.id === seedanceNodeId)
  if (!seedanceNode || seedanceNode.data.type !== NodeType.Seedance)
    return []

  return SEEDANCE_UPSTREAM_NODE_ORDER.filter(type =>
    canConnectUpstreamType(seedanceNode, type, nodes, edges),
  )
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
        return []
      default:
        return []
    }
  }

  switch (node.data.type) {
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
