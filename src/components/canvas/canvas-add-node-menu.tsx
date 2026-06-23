'use client'

import { useEffect, useRef } from 'react'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import { cn } from '@/lib/cn'
import { WORKFLOW_NODE_BLOCKS } from '@/lib/node-blocks'
import { NodeType } from '@/lib/types'

export type CanvasAddNodeMenuState = {
  screenX: number
  screenY: number
  flowPosition: { x: number; y: number }
}

type CanvasAddNodeMenuProps = {
  menu: CanvasAddNodeMenuState | null
  disabled?: boolean
  onSelect: (type: NodeType, menu: CanvasAddNodeMenuState) => void
  onClose: () => void
}

export default function CanvasAddNodeMenu({
  menu,
  disabled = false,
  onSelect,
  onClose,
}: CanvasAddNodeMenuProps) {
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

  if (!menu || disabled)
    return null

  return (
    <div
      ref={panelRef}
      className={cn(
        'absolute z-[120] min-w-[8.5rem] overflow-hidden rounded-md border border-border',
        'bg-surface py-0.5 shadow-md',
      )}
      style={{
        left: menu.screenX,
        top: menu.screenY,
        transform: 'translate(4px, 4px)',
      }}
    >
      <p className="px-2 py-0.5 text-[10px] text-muted">添加节点</p>
      <div className="my-0.5 h-px bg-border-subtle" />
      <div className="max-h-64 overflow-y-auto">
        {WORKFLOW_NODE_BLOCKS.map(block => (
          <button
            key={block.type}
            type="button"
            title={block.desc}
            onClick={() => onSelect(block.type, menu)}
            className="flex w-full items-center px-2 py-1 text-left text-[11px] text-foreground hover:bg-surface-muted"
          >
            <SeedanceBrandText text={block.label} />
          </button>
        ))}
      </div>
    </div>
  )
}

export function resolveCanvasAddNodePosition(
  menu: CanvasAddNodeMenuState,
  nodeType: NodeType,
): { x: number; y: number } {
  const width = nodeType === NodeType.Seedance ? 360 : 300
  return {
    x: menu.flowPosition.x - width / 2,
    y: menu.flowPosition.y - 48,
  }
}
