'use client'

import { useState } from 'react'
import { Maximize2 } from 'lucide-react'
import type { SeedanceNodeData, WorkflowEdge, WorkflowNode } from '@/lib/types'
import SeedanceConfigPanelBody from './seedance-config-panel-body'
import SeedanceExpandModal from './seedance-expand-modal'

type SeedanceWideConfigPanelProps = {
  id: string
  data: SeedanceNodeData
  disabled: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export default function SeedanceWideConfigPanel({
  id,
  data,
  disabled,
  nodes,
  edges,
}: SeedanceWideConfigPanelProps) {
  const [expandModalOpen, setExpandModalOpen] = useState(false)

  return (
    <div
      className="nodrag relative"
      onPointerDown={e => e.stopPropagation()}
    >
      <button
        type="button"
        onClick={() => setExpandModalOpen(true)}
        className="nodrag absolute right-2 top-2 z-10 rounded-md p-1.5 text-muted transition hover:bg-foreground/5 hover:text-foreground dark:hover:bg-white/10"
        title="放大"
      >
        <Maximize2 className="h-4 w-4" />
      </button>

      <SeedanceConfigPanelBody
        id={id}
        data={data}
        disabled={disabled}
        nodes={nodes}
        edges={edges}
        variant="inline"
      />

      <SeedanceExpandModal
        open={expandModalOpen}
        onClose={() => setExpandModalOpen(false)}
        id={id}
        data={data}
        disabled={disabled}
        nodes={nodes}
        edges={edges}
      />
    </div>
  )
}
