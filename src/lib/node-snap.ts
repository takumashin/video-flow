import type { WorkflowNode } from './types'

export const NODE_SNAP_DEFAULT_WIDTH = 300
export const NODE_SNAP_DEFAULT_HEIGHT = 200
/** 吸附距离阈值（画布坐标） */
export const NODE_SNAP_THRESHOLD = 8

export type SnapGuide = {
  orientation: 'vertical' | 'horizontal'
  position: number
}

export type SnapResult = {
  position: { x: number; y: number }
  guides: SnapGuide[]
}

function getNodeSize(node: WorkflowNode) {
  return {
    width: node.width ?? NODE_SNAP_DEFAULT_WIDTH,
    height: node.height ?? NODE_SNAP_DEFAULT_HEIGHT,
  }
}

function collectAlignmentTargets(nodes: WorkflowNode[]) {
  const x: number[] = []
  const y: number[] = []

  for (const node of nodes) {
    const { width, height } = getNodeSize(node)
    const left = node.position.x
    const top = node.position.y
    x.push(left, left + width / 2, left + width)
    y.push(top, top + height / 2, top + height)
  }

  return { x, y }
}

function snapAxis(
  position: number,
  size: number,
  targets: number[],
  threshold: number,
): { snapped: number; guide: number | null } {
  const offsets = [0, size / 2, size]
  let bestDist = threshold + 1
  let bestAdjust = 0
  let bestGuide: number | null = null

  for (const target of targets) {
    for (const offset of offsets) {
      const dragValue = position + offset
      const dist = target - dragValue
      if (Math.abs(dist) <= threshold && Math.abs(dist) < Math.abs(bestDist)) {
        bestDist = dist
        bestAdjust = dist
        bestGuide = target
      }
    }
  }

  if (bestGuide === null)
    return { snapped: position, guide: null }

  return { snapped: position + bestAdjust, guide: bestGuide }
}

/** 拖拽节点时按其他节点的边/中心进行水平、竖直对齐吸附 */
export function snapNodePosition(
  draggedNode: WorkflowNode,
  position: { x: number; y: number },
  allNodes: WorkflowNode[],
): SnapResult {
  const others = allNodes.filter(node => node.id !== draggedNode.id)
  if (others.length === 0)
    return { position, guides: [] }

  const { width, height } = getNodeSize(draggedNode)
  const { x: xTargets, y: yTargets } = collectAlignmentTargets(others)

  const guides: SnapGuide[] = []

  const xSnap = snapAxis(position.x, width, xTargets, NODE_SNAP_THRESHOLD)
  if (xSnap.guide !== null)
    guides.push({ orientation: 'vertical', position: xSnap.guide })

  const ySnap = snapAxis(position.y, height, yTargets, NODE_SNAP_THRESHOLD)
  if (ySnap.guide !== null)
    guides.push({ orientation: 'horizontal', position: ySnap.guide })

  return {
    position: { x: xSnap.snapped, y: ySnap.snapped },
    guides,
  }
}
