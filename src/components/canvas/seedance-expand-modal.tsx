'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Minimize2 } from 'lucide-react'
import type { SeedanceNodeData, WorkflowEdge, WorkflowNode } from '@/lib/types'
import SeedanceConfigPanelBody from './seedance-config-panel-body'

type SeedanceExpandModalProps = {
  open: boolean
  onClose: () => void
  id: string
  data: SeedanceNodeData
  disabled: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export default function SeedanceExpandModal({
  open,
  onClose,
  id,
  data,
  disabled,
  nodes,
  edges,
}: SeedanceExpandModalProps) {
  useEffect(() => {
    if (!open)
      return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onClose()
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [open, onClose])

  if (!open || typeof document === 'undefined')
    return null

  return createPortal(
    <div
      className="fixed inset-0 z-[240] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-label="Seedance 生成配置"
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/55 backdrop-blur-sm"
        onClick={onClose}
        aria-label="关闭"
      />

      <div
        className="relative flex max-h-[min(920px,94vh)] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-2xl"
        onPointerDown={e => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="nodrag absolute right-3 top-3 z-10 rounded-md p-1.5 text-muted transition hover:bg-surface-muted hover:text-foreground"
          title="缩小"
        >
          <Minimize2 className="h-4 w-4" />
        </button>

        <div className="nodrag min-h-0 flex-1 overflow-y-auto px-5 pb-5 pt-4">
          <SeedanceConfigPanelBody
            id={id}
            data={data}
            disabled={disabled}
            nodes={nodes}
            edges={edges}
            variant="modal"
          />
        </div>
      </div>
    </div>,
    document.body,
  )
}
