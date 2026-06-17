'use client'

import { Sparkles } from 'lucide-react'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import type { SeedanceNodeData } from '@/lib/types'
import { NodeType } from '@/lib/types'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import {
  SeedanceGenerateButton,
  SeedanceNodeDetailPanel,
} from '@/components/canvas/seedance-node-panel'

export default function SeedanceConfigSidebar() {
  const activeSession = useActiveWorkflowSession()
  const selectedNodeId = activeSession?.selectedNodeId ?? null
  const nodes = activeSession?.nodes ?? []
  const edges = activeSession?.edges ?? []

  const selectedNode = selectedNodeId
    ? nodes.find(node => node.id === selectedNodeId)
    : null

  if (selectedNode?.data.type !== NodeType.Seedance || !selectedNodeId)
    return null

  const seedanceData = selectedNode.data as SeedanceNodeData
  const nodeDisabled = seedanceData.status === 'running'

  return (
    <aside className="flex h-full w-96 shrink-0 flex-col border-l border-border bg-surface">
      <div className="border-b border-border-subtle px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-orange-500" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">生成配置</h2>
            <p className="text-[10px] text-muted">
              <SeedanceBrandText text={selectedNode.data.title || 'Seedance 生成'} />
            </p>
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <SeedanceNodeDetailPanel
          id={selectedNodeId}
          data={seedanceData}
          disabled={nodeDisabled}
          nodes={nodes}
          edges={edges}
          variant="sidebar"
        />
      </div>

      <div className="shrink-0 border-t border-border-subtle bg-surface p-4">
        <SeedanceGenerateButton
          id={selectedNodeId}
          data={seedanceData}
          nodes={nodes}
          edges={edges}
        />
      </div>
    </aside>
  )
}
