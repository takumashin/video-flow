import type { WorkflowDiffEntry, WorkflowDiffResult, WorkflowNode, WorkflowEdge } from './types'

function getNodeTitle(node: WorkflowNode): string {
  const data = node.data as Record<string, unknown> | undefined
  return (data?.title as string) || node.type || node.id
}

function getNodeTypeLabel(node: WorkflowNode): string {
  return node.type || 'unknown'
}

function deepDiff<T extends Record<string, unknown>>(
  a: T,
  b: T,
  excludeKeys: Set<string> = new Set(),
): Array<{ field: string; before: unknown; after: unknown }> {
  const changes: Array<{ field: string; before: unknown; after: unknown }> = []
  const allKeys = new Set([...Object.keys(a), ...Object.keys(b)])

  for (const key of allKeys) {
    if (excludeKeys.has(key)) continue

    const va = a[key]
    const vb = b[key]

    if (JSON.stringify(va) !== JSON.stringify(vb)) {
      changes.push({ field: key, before: va, after: vb })
    }
  }

  return changes
}

/**
 * Compute the diff between two sets of workflow nodes.
 */
function computeNodeDiff(
  nodesA: WorkflowNode[],
  nodesB: WorkflowNode[],
): WorkflowDiffEntry[] {
  const mapA = new Map(nodesA.map(n => [n.id, n]))
  const mapB = new Map(nodesB.map(n => [n.id, n]))
  const entries: WorkflowDiffEntry[] = []

  // Find added nodes (in B but not A)
  for (const [id, node] of mapB) {
    if (!mapA.has(id)) {
      entries.push({
        type: 'added',
        id,
        title: getNodeTitle(node),
        nodeType: getNodeTypeLabel(node),
      })
    }
  }

  // Find removed nodes (in A but not B)
  for (const [id, node] of mapA) {
    if (!mapB.has(id)) {
      entries.push({
        type: 'removed',
        id,
        title: getNodeTitle(node),
        nodeType: getNodeTypeLabel(node),
      })
    }
  }

  // Find modified nodes (in both, but different)
  for (const [id, nodeA] of mapA) {
    const nodeB = mapB.get(id)
    if (!nodeB) continue

    // Compare positions
    const positionChanged
      = nodeA.position.x !== nodeB.position.x
      || nodeA.position.y !== nodeB.position.y

    // Compare data (exclude UI-only fields)
    const dataA = (nodeA.data || {}) as Record<string, unknown>
    const dataB = (nodeB.data || {}) as Record<string, unknown>
    const dataChanges = deepDiff(dataA, dataB, new Set(['selected']))

    const allChanges: Array<{ field: string; before: unknown; after: unknown }> = []

    if (positionChanged) {
      allChanges.push({
        field: 'position',
        before: nodeA.position,
        after: nodeB.position,
      })
    }

    for (const c of dataChanges) {
      allChanges.push(c)
    }

    if (allChanges.length > 0) {
      entries.push({
        type: 'modified',
        id,
        title: getNodeTitle(nodeB),
        nodeType: getNodeTypeLabel(nodeB),
        changes: allChanges,
      })
    }
  }

  return entries
}

/**
 * Compute the diff between two sets of workflow edges.
 */
function computeEdgeDiff(
  edgesA: WorkflowEdge[],
  edgesB: WorkflowEdge[],
): WorkflowDiffEntry[] {
  const mapA = new Map(edgesA.map(e => [e.id, e]))
  const mapB = new Map(edgesB.map(e => [e.id, e]))
  const entries: WorkflowDiffEntry[] = []

  // Added edges
  for (const [id, edge] of mapB) {
    if (!mapA.has(id)) {
      entries.push({
        type: 'added',
        id,
        source: edge.source,
        target: edge.target,
      })
    }
  }

  // Removed edges
  for (const [id, edge] of mapA) {
    if (!mapB.has(id)) {
      entries.push({
        type: 'removed',
        id,
        source: edge.source,
        target: edge.target,
      })
    }
  }

  // Modified edges
  for (const [id, edgeA] of mapA) {
    const edgeB = mapB.get(id)
    if (!edgeB) continue

    const changes: Array<{ field: string; before: unknown; after: unknown }> = []

    if (edgeA.source !== edgeB.source) {
      changes.push({ field: 'source', before: edgeA.source, after: edgeB.source })
    }
    if (edgeA.target !== edgeB.target) {
      changes.push({ field: 'target', before: edgeA.target, after: edgeB.target })
    }
    if (edgeA.sourceHandle !== edgeB.sourceHandle) {
      changes.push({ field: 'sourceHandle', before: edgeA.sourceHandle, after: edgeB.sourceHandle })
    }
    if (edgeA.targetHandle !== edgeB.targetHandle) {
      changes.push({ field: 'targetHandle', before: edgeA.targetHandle, after: edgeB.targetHandle })
    }

    if (changes.length > 0) {
      entries.push({
        type: 'modified',
        id,
        source: edgeB.source,
        target: edgeB.target,
        changes,
      })
    }
  }

  return entries
}

/**
 * Compute the full diff between two workflow versions (nodes + edges).
 */
export function computeWorkflowDiff(
  nodesA: WorkflowNode[],
  edgesA: WorkflowEdge[],
  nodesB: WorkflowNode[],
  edgesB: WorkflowEdge[],
): { nodeChanges: WorkflowDiffEntry[]; edgeChanges: WorkflowDiffEntry[] } {
  return {
    nodeChanges: computeNodeDiff(nodesA, nodesB),
    edgeChanges: computeEdgeDiff(edgesA, edgesB),
  }
}

/**
 * Compute a complete WorkflowDiffResult (without version metadata — caller fills that in).
 */
export function computeWorkflowDiffBetweenSnapshots(
  nodesA: WorkflowNode[],
  edgesA: WorkflowEdge[],
  nodesB: WorkflowNode[],
  edgesB: WorkflowEdge[],
): Pick<WorkflowDiffResult, 'nodeChanges' | 'edgeChanges'> {
  return computeWorkflowDiff(nodesA, edgesA, nodesB, edgesB)
}
