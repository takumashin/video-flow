'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { WORKFLOW_NODE_BLOCKS } from '@/lib/node-blocks'
import { btnSecondaryClass, dropdownClass } from '@/lib/ui-classes'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'

export default function AddBlockPanel() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const addNode = useWorkflowStore(s => s.addNode)
  const isRunning = useActiveWorkflowSession()?.isRunning ?? false

  useEffect(() => {
    if (!open)
      return

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node))
        setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        disabled={isRunning}
        onClick={() => setOpen(v => !v)}
        className={btnSecondaryClass}
      >
        <Plus className="h-4 w-4" />
        添加节点
      </button>

      {open && (
        <div className={`absolute left-0 top-full z-[110] mt-2 w-72 ${dropdownClass}`}>
          <div className="border-b border-border-subtle px-4 py-3">
            <p className="text-sm font-semibold text-foreground">节点库</p>
            <p className="text-xs text-muted">拖拽连接，构建 AI 视频生成流程</p>
          </div>
          <div className="p-2">
            {WORKFLOW_NODE_BLOCKS.map(block => (
              <button
                key={block.type}
                type="button"
                onClick={() => {
                  addNode(block.type)
                  setOpen(false)
                }}
                className="flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted"
              >
                <span className="text-sm font-medium text-foreground">{block.label}</span>
                <span className="text-xs text-muted">{block.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
