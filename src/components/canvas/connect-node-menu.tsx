'use client'

import { useEffect, useRef } from 'react'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import { cn } from '@/lib/cn'
import { getConnectableNodeTypes, type ConnectHandleSide } from '@/lib/connect-node-options'
import { WORKFLOW_NODE_BLOCKS } from '@/lib/node-blocks'
import { dropdownClass } from '@/lib/ui-classes'
import type { WorkflowEdge, WorkflowNode } from '@/lib/types'
import { NodeType } from '@/lib/types'

export type ConnectNodeMenuState = {
  anchorNodeId: string
  handleType: ConnectHandleSide
  screenX: number
  screenY: number
  flowPosition: { x: number; y: number }
}

type ConnectNodeMenuProps = {
  menu: ConnectNodeMenuState | null
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  onSelect: (type: NodeType, menu: ConnectNodeMenuState) => void
  onClose: () => void
}

export default function ConnectNodeMenu({
  menu,
  nodes,
  edges,
  onSelect,
  onClose,
}: ConnectNodeMenuProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu)
      return

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node))
        onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onClose()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [menu, onClose])

  if (!menu)
    return null

  const connectableTypes = getConnectableNodeTypes(
    { nodeId: menu.anchorNodeId, handleType: menu.handleType },
    nodes,
    edges,
  )

  const options = WORKFLOW_NODE_BLOCKS.filter(block => connectableTypes.includes(block.type))

  const anchorNode = nodes.find(node => node.id === menu.anchorNodeId)
  const anchorTitle = anchorNode?.data.title ?? '节点'

  if (options.length === 0) {
    return (
      <div
        ref={panelRef}
        className={cn('absolute z-[120] w-72', dropdownClass)}
        style={{
          left: menu.screenX,
          top: menu.screenY,
          transform: 'translate(-50%, 12px)',
        }}
      >
        <div className="px-4 py-3">
          <p className="text-sm font-semibold text-foreground">暂无可连接节点</p>
          <p className="mt-1 text-xs text-muted">
            「<SeedanceBrandText text={anchorTitle} />」在当前方向没有可新建的节点类型
          </p>
        </div>
      </div>
    )
  }

  return (
    <div
      ref={panelRef}
      className={cn('absolute z-[120] w-72', dropdownClass)}
      style={{
        left: menu.screenX,
        top: menu.screenY,
        transform: 'translate(-50%, 12px)',
      }}
    >
      <div className="border-b border-border-subtle px-4 py-3">
        <p className="text-sm font-semibold text-foreground">选择要连接的节点</p>
        <p className="text-xs text-muted">
          从「<SeedanceBrandText text={anchorTitle} />」{menu.handleType === 'source' ? '继续向右' : '补充上游输入'}
        </p>
      </div>
      <div className="max-h-80 overflow-y-auto p-2">
        {options.map(option => (
          <button
            key={option.type}
            type="button"
            onClick={() => onSelect(option.type, menu)}
            className="flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted"
          >
            <span className="text-sm font-medium text-foreground">
              <SeedanceBrandText text={option.label} />
            </span>
            <span className="text-xs text-muted">{option.desc}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

export function resolveConnectNodePosition(
  menu: ConnectNodeMenuState,
  nodeType: NodeType,
): { x: number; y: number } {
  const width = nodeType === NodeType.Seedance ? 360 : 300
  const xOffset = menu.handleType === 'source' ? 24 : -width - 24

  return {
    x: menu.flowPosition.x + xOffset,
    y: menu.flowPosition.y - 48,
  }
}
