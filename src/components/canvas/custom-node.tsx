'use client'

import { Position, type NodeProps } from 'reactflow'
import {
  ImageIcon,
  Music,
  Play,
  Trash2,
  Type,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { WorkflowEdge, WorkflowNode, WorkflowNodeData } from '@/lib/types'
import { NodeType } from '@/lib/types'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { SeedanceBrandText } from '@/components/seedance-brand-text'
import { SiteLogo } from '@/components/site-logo'
import { useWorkflowStore } from '@/store/workflow-store'
import { getConnectedSeedanceModeForImageNode } from '@/lib/seedance-upstream'
import ImageUploadZone from './image-upload-zone'
import MediaUploadZone from './media-upload-zone'
import WorkflowNodeHandle from './workflow-node-handle'
import { SeedanceNodeSummary } from './seedance-node-panel'
import {
  FieldLabel,
  IMAGE_ROLE_OPTIONS,
  NodeOptionGroup,
  NodeTextArea,
} from './node-fields'

const nodeMeta: Record<Exclude<NodeType, NodeType.Output>, { icon: typeof Play; color: string; bg: string }> = {
  [NodeType.Start]: { icon: Play, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' },
  [NodeType.TextPrompt]: { icon: Type, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800' },
  [NodeType.ImageInput]: { icon: ImageIcon, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800' },
  [NodeType.VideoInput]: { icon: Video, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800' },
  [NodeType.AudioInput]: { icon: Music, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' },
  [NodeType.Seedance]: { icon: Play, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800' },
}

function NodeBody({
  id,
  data,
  disabled,
  nodes,
  edges,
}: {
  id: string
  data: WorkflowNodeData
  disabled: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}) {
  const updateNodeData = useWorkflowStore(s => s.updateNodeData)

  switch (data.type) {
    case NodeType.Start:
      return (
        <p className="text-xs leading-relaxed text-muted">
          历史工作流入口节点。请在「<SeedanceBrandText text="Seedance 生成" />」节点上点击「生成视频」。
        </p>
      )

    case NodeType.TextPrompt:
      return (
        <div>
          <FieldLabel>视频描述</FieldLabel>
          <NodeTextArea
            value={data.prompt}
            onChange={prompt => updateNodeData(id, { prompt })}
            placeholder="例如：日落时分的城市航拍，镜头缓慢推进..."
            rows={4}
            disabled={disabled}
          />
        </div>
      )

    case NodeType.ImageInput: {
      const connectedSeedanceMode = getConnectedSeedanceModeForImageNode(id, nodes, edges)
      const showImageRoleField = connectedSeedanceMode === 'first_last_frame'
      const firstLastRoleOptions = IMAGE_ROLE_OPTIONS.filter(
        option => option.value === 'first_frame' || option.value === 'last_frame',
      )

      return (
        <div className="space-y-2.5">
          <div>
            <FieldLabel>参考图片</FieldLabel>
            <ImageUploadZone
              value={data.imageUrl}
              onChange={imageUrl => updateNodeData(id, { imageUrl })}
              disabled={disabled}
            />
          </div>
          {showImageRoleField && (
            <div>
              <FieldLabel>图片角色</FieldLabel>
              <NodeOptionGroup
                value={data.role}
                onChange={role => updateNodeData(id, { role })}
                options={firstLastRoleOptions}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )
    }

    case NodeType.VideoInput:
      return (
        <div className="space-y-2.5">
          <div>
            <FieldLabel>参考视频</FieldLabel>
            <MediaUploadZone
              kind="video"
              value={data.mediaUrl}
              onChange={mediaUrl => updateNodeData(id, { mediaUrl })}
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-muted">全能参考模式最多连接 3 个，单文件最大 5MB</p>
        </div>
      )

    case NodeType.AudioInput:
      return (
        <div className="space-y-2.5">
          <div>
            <FieldLabel>参考音频</FieldLabel>
            <MediaUploadZone
              kind="audio"
              value={data.mediaUrl}
              onChange={mediaUrl => updateNodeData(id, { mediaUrl })}
              disabled={disabled}
            />
          </div>
          <p className="text-[10px] text-muted">全能参考模式最多连接 3 个，单文件最大 10MB</p>
        </div>
      )

    case NodeType.Seedance:
    case NodeType.Output:
      return null
  }
}

export default function CustomNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const deleteNode = useWorkflowStore(s => s.deleteNode)
  const nodes = useActiveWorkflowSession()?.nodes ?? []
  const edges = useActiveWorkflowSession()?.edges ?? []
  const meta = nodeMeta[data.type as Exclude<NodeType, NodeType.Output>]
  const Icon = meta?.icon ?? Play
  const showTarget = data.type !== NodeType.Start
    && data.type !== NodeType.ImageInput
    && data.type !== NodeType.VideoInput
    && data.type !== NodeType.AudioInput
  const showSource = data.type !== NodeType.Seedance && data.type !== NodeType.Output
  const canDelete = data.type !== NodeType.Start
  const nodeDisabled = data.type === NodeType.Seedance && data.status === 'running'

  const cardClass = cn(
    'rounded-xl border bg-surface shadow-sm transition-shadow',
    selected ? 'border-primary-light shadow-md ring-2 ring-primary-light/20' : 'border-border',
  )

  const header = (
    <div
      className={cn(
        'node-drag-header flex cursor-grab items-center gap-2 rounded-t-xl border-b px-3 py-2 active:cursor-grabbing',
        meta?.bg,
      )}
    >
      {data.type === NodeType.Seedance
        ? <SiteLogo size={16} className="h-4 w-4 shrink-0 rounded-sm" />
        : <Icon className={cn('h-4 w-4 shrink-0', meta?.color)} />}
      <span className="min-w-0 flex-1 select-none truncate text-sm font-medium text-foreground">
        <SeedanceBrandText text={data.title} />
      </span>
      {canDelete && (
        <button
          type="button"
          disabled={nodeDisabled}
          onClick={() => deleteNode(id)}
          className="nodrag shrink-0 cursor-pointer rounded p-1 text-muted hover:bg-surface-muted hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="删除节点"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  )

  if (data.type === NodeType.Seedance) {
    return (
      <div className={cn('w-[360px]', cardClass)}>
        {showTarget && (
          <WorkflowNodeHandle type="target" position={Position.Left} />
        )}

        {header}

        <div className="px-3 py-2.5">
          <SeedanceNodeSummary
            id={id}
            data={data}
            disabled={nodeDisabled}
            nodes={nodes}
            edges={edges}
            selected={selected}
          />
        </div>
      </div>
    )
  }

  return (
    <div className={cn('w-[300px]', cardClass)}>
      {showTarget && (
        <WorkflowNodeHandle type="target" position={Position.Left} />
      )}

      {header}

      <div className="px-3 py-2.5">
        <NodeBody id={id} data={data} disabled={nodeDisabled} nodes={nodes} edges={edges} />
      </div>

      {showSource && (
        <WorkflowNodeHandle type="source" position={Position.Right} />
      )}
    </div>
  )
}
