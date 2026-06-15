'use client'

import { Handle, Position, type NodeProps } from 'reactflow'
import {
  Film,
  History,
  ImageIcon,
  Music,
  Play,
  Sparkles,
  Trash2,
  Type,
  Video,
} from 'lucide-react'
import { cn } from '@/lib/cn'
import type { WorkflowEdge, WorkflowNode, WorkflowNodeData } from '@/lib/types'
import { NodeType } from '@/lib/types'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'
import { getConnectedSeedanceModeForImageNode } from '@/lib/seedance-upstream'
import VideoDownloadLink from '@/components/video-download-link'
import VideoGenLoadingState from '@/components/video-gen-loading-state'
import ImageUploadZone from './image-upload-zone'
import MediaUploadZone from './media-upload-zone'
import { SeedanceNodeDetailPanel, SeedanceNodeSummary } from './seedance-node-panel'
import {
  FieldLabel,
  IMAGE_ROLE_OPTIONS,
  NodeSelect,
  NodeTextArea,
  StatusBadge,
} from './node-fields'

const nodeMeta: Record<NodeType, { icon: typeof Play; color: string; bg: string }> = {
  [NodeType.Start]: { icon: Play, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' },
  [NodeType.TextPrompt]: { icon: Type, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 border-blue-200 dark:bg-blue-950/40 dark:border-blue-800' },
  [NodeType.ImageInput]: { icon: ImageIcon, color: 'text-violet-600 dark:text-violet-400', bg: 'bg-violet-50 border-violet-200 dark:bg-violet-950/40 dark:border-violet-800' },
  [NodeType.VideoInput]: { icon: Video, color: 'text-sky-600 dark:text-sky-400', bg: 'bg-sky-50 border-sky-200 dark:bg-sky-950/40 dark:border-sky-800' },
  [NodeType.AudioInput]: { icon: Music, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 border-emerald-200 dark:bg-emerald-950/40 dark:border-emerald-800' },
  [NodeType.Seedance]: { icon: Sparkles, color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 border-orange-200 dark:bg-orange-950/40 dark:border-orange-800' },
  [NodeType.Output]: { icon: Film, color: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-50 border-rose-200 dark:bg-rose-950/40 dark:border-rose-800' },
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
          历史工作流入口节点。请在「Seedance 生成」节点上点击「生成视频」。
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

    case NodeType.ImageInput:
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
              <NodeSelect
                value={data.role}
                onChange={role => updateNodeData(id, { role })}
                options={firstLastRoleOptions}
                disabled={disabled}
              />
            </div>
          )}
        </div>
      )

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

    case NodeType.Output:
      const latestVideo = data.videoUrl ?? data.videoHistory?.[0]?.videoUrl
      const historyCount = data.videoHistory?.length ?? 0
      const upstreamSeedance = nodes.find(
        n => n.data.type === NodeType.Seedance
          && n.data.status === 'running'
          && edges.some(e => e.source === n.id && e.target === id),
      )
      const isOutputGenerating = data.status === 'running' || upstreamSeedance != null

      const upstreamProgress = upstreamSeedance?.data.type === NodeType.Seedance
        ? upstreamSeedance.data.progress
        : undefined

      return (
        <div className="space-y-2">
          {!isOutputGenerating && <StatusBadge status={data.status} />}
          {isOutputGenerating && !latestVideo
            ? (
                <VideoGenLoadingState
                  progress={upstreamProgress}
                  label="正在生成视频…"
                  maxWidth="100%"
                  aspectRatio="video"
                  className="nodrag"
                />
              )
            : latestVideo
            ? (
                <div
                  className="overflow-hidden rounded-md border border-border"
                  onPointerDown={e => e.stopPropagation()}
                  onClick={e => e.stopPropagation()}
                >
                  <video
                    key={latestVideo}
                    src={latestVideo}
                    controls
                    playsInline
                    className="aspect-video w-full bg-black"
                  />
                  <div className="flex items-center justify-between gap-2 border-t border-border-subtle px-2 py-1.5">
                    <button
                      type="button"
                      className="nodrag inline-flex items-center gap-1 text-[11px] font-medium text-primary-light hover:underline"
                      onClick={() => useWorkflowStore.getState().openVideoHistoryModal(id)}
                    >
                      <History className="h-3 w-3" />
                      查看历史 ({historyCount})
                    </button>
                    <VideoDownloadLink
                      videoUrl={latestVideo}
                      className="text-[11px] font-medium text-muted hover:text-primary-light hover:underline"
                      showIcon={false}
                    />
                  </div>
                </div>
              )
            : (
                <button
                  type="button"
                  className="nodrag flex w-full flex-col items-center gap-1.5 rounded-md border border-dashed border-border bg-surface-muted py-4 text-center transition hover:border-border hover:bg-surface-muted/80"
                  onClick={() => useWorkflowStore.getState().openVideoHistoryModal(id)}
                >
                  <Film className="h-5 w-5 text-muted" />
                  <p className="text-xs text-muted">等待生成结果...</p>
                  <p className="text-[11px] text-muted/80">点击可查看历史记录</p>
                </button>
              )}
        </div>
      )
  }
}

export default function CustomNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const updateNodeData = useWorkflowStore(s => s.updateNodeData)
  const deleteNode = useWorkflowStore(s => s.deleteNode)
  const nodes = useActiveWorkflowSession()?.nodes ?? []
  const edges = useActiveWorkflowSession()?.edges ?? []
  const meta = nodeMeta[data.type]
  const Icon = meta.icon
  const showTarget = data.type !== NodeType.Start
  const showSource = data.type !== NodeType.Output
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
        meta.bg,
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', meta.color)} />
      <input
        value={data.title}
        onChange={e => updateNodeData(id, { title: e.target.value })}
        disabled={nodeDisabled}
        className="nodrag nokey min-w-0 flex-1 cursor-text bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted disabled:cursor-not-allowed disabled:opacity-50"
        placeholder="节点名称"
      />
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
      <div className={cn('relative', selected && 'z-10')}>
        <div className={cn('w-[300px]', cardClass)}>
          {showTarget && (
            <Handle
              type="target"
              position={Position.Left}
              className="!h-3 !w-3 !border-2 !border-surface !bg-primary-light"
            />
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

          {showSource && (
            <Handle
              type="source"
              position={Position.Right}
              className="!h-3 !w-3 !border-2 !border-surface !bg-primary-light"
            />
          )}
        </div>

        {selected && (
          <SeedanceNodeDetailPanel
            id={id}
            data={data}
            disabled={nodeDisabled}
            nodes={nodes}
            edges={edges}
            className="absolute left-0 top-full z-10 mt-2 w-[400px]"
          />
        )}
      </div>
    )
  }

  return (
    <div className={cn('w-[300px]', cardClass)}>
      {showTarget && (
        <Handle
          type="target"
          position={Position.Left}
          className="!h-3 !w-3 !border-2 !border-surface !bg-primary-light"
        />
      )}

      {header}

      <div className="px-3 py-2.5">
        <NodeBody id={id} data={data} disabled={nodeDisabled} nodes={nodes} edges={edges} />
      </div>

      {showSource && (
        <Handle
          type="source"
          position={Position.Right}
          className="!h-3 !w-3 !border-2 !border-surface !bg-primary-light"
        />
      )}
    </div>
  )
}
