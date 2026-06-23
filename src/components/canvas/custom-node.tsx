'use client'

import { Position, NodeToolbar, type NodeProps } from 'reactflow'
import { GripHorizontal, Link2, Loader2, Play, Trash2, Type } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { WorkflowNodeData } from '@/lib/types'
import { NodeType } from '@/lib/types'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'
import VideoDownloadLink from '@/components/video-download-link'
import WorkflowNodeHandle from './workflow-node-handle'
import SeedanceWideConfigPanel from './seedance-wide-config-panel'
import CanvasMediaNode, {
  getMediaUrlFromNode,
  isCanvasMediaNodeData,
  mediaKindFromNodeType,
} from './canvas-media-node'
import { NodeTextArea } from './node-fields'
import NodeVideoPlayer from './node-video-player'

const SEEDANCE_NODE_W = 356
const SEEDANCE_VIDEO_H = 200

export default function CustomNode({ id, data, selected }: NodeProps<WorkflowNodeData>) {
  const deleteNode = useWorkflowStore(s => s.deleteNode)
  const updateNodeData = useWorkflowStore(s => s.updateNodeData)
  const nodes = useActiveWorkflowSession()?.nodes ?? []
  const edges = useActiveWorkflowSession()?.edges ?? []
  const nodeDisabled = data.type === NodeType.Seedance && data.status === 'running'
  const canDelete = data.type !== NodeType.Start

  if (isCanvasMediaNodeData(data)) {
    const kind = mediaKindFromNodeType(data.type)
    const mediaUrl = getMediaUrlFromNode(data)

    return (
      <CanvasMediaNode
        kind={kind}
        title={data.title}
        mediaUrl={mediaUrl}
        disabled={nodeDisabled}
        selected={selected}
        onMediaChange={(url) => {
          if (data.type === NodeType.ImageInput)
            updateNodeData(id, { imageUrl: url })
          else
            updateNodeData(id, { mediaUrl: url })
        }}
        onTitleChange={title => updateNodeData(id, { title })}
      />
    )
  }

  if (data.type === NodeType.TextPrompt) {
    const handleY = 52

    return (
      <div className="canvas-node canvas-node-text relative w-[356px] overflow-visible">
        <WorkflowNodeHandle type="target" position={Position.Left} centerY={handleY} />
        <WorkflowNodeHandle type="source" position={Position.Right} centerY={handleY} />

        <div
          className={cn(
            'overflow-hidden rounded-xl border bg-surface shadow-sm transition-shadow',
            selected ? 'border-primary-light ring-2 ring-primary-light/25' : 'border-border',
          )}
        >
          <div className="node-drag-header canvas-node-type-label flex items-center gap-1 border-b border-border px-2.5 py-1.5 text-xs font-medium text-foreground">
            <Type className="h-3 w-3 shrink-0 text-blue-500" strokeWidth={2} />
            <span className="min-w-0 flex-1 truncate">文本</span>
            {canDelete && (
              <button
                type="button"
                disabled={nodeDisabled}
                onClick={() => deleteNode(id)}
                onPointerDown={e => e.stopPropagation()}
                className="nodrag shrink-0 rounded p-0.5 text-muted hover:text-red-500"
                aria-label="删除"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>

          <div className="px-2.5 py-2">
            <NodeTextArea
              value={data.prompt}
              onChange={prompt => updateNodeData(id, { prompt })}
              placeholder="描述镜头、动作、氛围…"
              rows={3}
              disabled={nodeDisabled}
            />
          </div>
        </div>
      </div>
    )
  }

  if (data.type === NodeType.Seedance) {
    const seedanceData = data
    const latestVideo = seedanceData.videoUrl ?? seedanceData.videoHistory?.[0]?.videoUrl
    const isGenerating = seedanceData.status === 'running'
    const previewError = seedanceData.status === 'failed' ? seedanceData.error : undefined

    return (
      <>
        {/* 节点本体仅 356×200 视频预览，不含配置面板 */}
        <div
          className={cn(
            'canvas-node canvas-node-seedance group/canvas-node relative overflow-visible transition-shadow',
          )}
          style={{ width: SEEDANCE_NODE_W, height: SEEDANCE_VIDEO_H }}
        >
          <WorkflowNodeHandle type="target" position={Position.Left} centerY={SEEDANCE_VIDEO_H / 2} />
          <WorkflowNodeHandle type="source" position={Position.Right} centerY={SEEDANCE_VIDEO_H / 2} />

          <div
            className={cn(
              'absolute inset-0 overflow-hidden rounded-xl border bg-surface shadow-sm',
              selected ? 'border-primary-light ring-2 ring-primary-light/25' : 'border-border',
            )}
          >
            <div className="canvas-node-type-label absolute left-2 top-1.5 z-20 flex max-w-[calc(100%-3rem)] items-center gap-1 rounded-md bg-black/45 px-1.5 py-0.5 text-xs font-medium text-white backdrop-blur-sm">
              <svg width="12" height="12" viewBox="0 0 20 20" fill="none" className="shrink-0 text-white/90" aria-hidden>
                <path
                  d="M15.5 2.58301C17.0187 2.58301 18.2498 3.81437 18.25 5.33301V14.666C18.25 16.1848 17.0188 17.416 15.5 17.416H4.5C2.98122 17.416 1.75 16.1848 1.75 14.666V5.33301C1.75018 3.81437 2.98133 2.58301 4.5 2.58301H15.5ZM4.5 4.08301C3.80975 4.08301 3.25018 4.6428 3.25 5.33301V14.666C3.25 15.3564 3.80964 15.916 4.5 15.916H15.5C16.1904 15.916 16.75 15.3564 16.75 14.666V5.33301C16.7498 4.6428 16.1902 4.08301 15.5 4.08301H4.5ZM7.96387 6.84766C8.19879 6.71472 8.48719 6.71777 8.71875 6.85645L12.8857 9.35645C13.1116 9.49199 13.25 9.73655 13.25 10C13.25 10.2634 13.1116 10.508 12.8857 10.6436L8.71875 13.1436C8.48719 13.2822 8.19879 13.2853 7.96387 13.1523C7.72888 13.0192 7.58301 12.7701 7.58301 12.5V7.5C7.58301 7.22989 7.72888 6.98082 7.96387 6.84766ZM9.08301 11.1748L11.041 10L9.08301 8.82422V11.1748Z"
                  fill="currentColor"
                />
              </svg>
              <span className="truncate">视频</span>
            </div>

            <div className="canvas-node-drag-pill node-drag-header absolute left-1/2 top-1 z-20 -translate-x-1/2" aria-hidden>
              <GripHorizontal className="h-3.5 w-3.5 text-muted" strokeWidth={2} />
            </div>

            <div
              className={cn(
                'canvas-node-inner absolute inset-0 overflow-hidden bg-black',
                latestVideo && !isGenerating && 'cursor-grab active:cursor-grabbing',
              )}
            >
              {latestVideo
                ? (
                    <NodeVideoPlayer
                      src={latestVideo}
                      previewTitle={seedanceData.title ?? '视频预览'}
                      variant="node"
                      showExpand={false}
                      showScreenshot
                      className="!min-h-0 h-full !rounded-none"
                    />
                  )
                : isGenerating
                  ? (
                      <div className="flex h-full w-full items-center justify-center">
                        <Loader2 className="h-8 w-8 animate-spin text-white/60" />
                      </div>
                    )
                  : previewError
                    ? (
                        <div className="flex h-full w-full items-center justify-center px-4 py-3">
                          <p className="max-h-full overflow-y-auto text-center text-xs leading-relaxed text-red-400">
                            {previewError}
                          </p>
                        </div>
                      )
                    : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-white/40">
                        <svg width="24" height="24" viewBox="0 0 20 20" fill="none" className="opacity-60" aria-hidden>
                          <path
                            d="M15.5 2.58301C17.0187 2.58301 18.2498 3.81437 18.25 5.33301V14.666C18.25 16.1848 17.0188 17.416 15.5 17.416H4.5C2.98122 17.416 1.75 16.1848 1.75 14.666V5.33301C1.75018 3.81437 2.98133 2.58301 4.5 2.58301H15.5ZM4.5 4.08301C3.80975 4.08301 3.25018 4.6428 3.25 5.33301V14.666C3.25 15.3564 3.80964 15.916 4.5 15.916H15.5C16.1904 15.916 16.75 15.3564 16.75 14.666V5.33301C16.7498 4.6428 16.1902 4.08301 15.5 4.08301H4.5ZM7.96387 6.84766C8.19879 6.71472 8.48719 6.71777 8.71875 6.85645L12.8857 9.35645C13.1116 9.49199 13.25 9.73655 13.25 10C13.25 10.2634 13.1116 10.508 12.8857 10.6436L8.71875 13.1436C8.48719 13.2822 8.19879 13.2853 7.96387 13.1523C7.72888 13.0192 7.58301 12.7701 7.58301 12.5V7.5C7.58301 7.22989 7.72888 6.98082 7.96387 6.84766ZM9.08301 11.1748L11.041 10L9.08301 8.82422V11.1748Z"
                            fill="currentColor"
                          />
                        </svg>
                        <span className="text-xs">等待生成</span>
                      </div>
                    )}
            </div>

            {latestVideo && !isGenerating && (
              <div className="absolute right-1.5 top-1.5 z-20 flex items-center gap-1">
                <button
                  type="button"
                  className="nodrag flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm hover:bg-black/75"
                  title="设为参考视频"
                  onClick={() => useWorkflowStore.getState().useSeedanceVideoAsReference(id, latestVideo)}
                >
                  <Link2 className="h-2.5 w-2.5" />
                  参考
                </button>
                {seedanceData.videoHistory && seedanceData.videoHistory.length > 0 && (
                  <button
                    type="button"
                    className="nodrag flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm hover:bg-black/75"
                    onClick={() => useWorkflowStore.getState().openVideoHistoryModal(id)}
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="13" height="11" rx="2" />
                      <path d="M16 9l5-3v12l-5-3" />
                    </svg>
                    {seedanceData.videoHistory.length}
                  </button>
                )}
              </div>
            )}

            {latestVideo && !isGenerating && (
              <VideoDownloadLink
                videoUrl={latestVideo}
                taskId={seedanceData.taskId}
                className="nodrag absolute bottom-1.5 left-1.5 z-20 flex items-center gap-1 rounded bg-black/60 px-1.5 py-0.5 text-[10px] text-white backdrop-blur-sm hover:bg-black/75"
                showIcon
              />
            )}
          </div>
        </div>

        {/* 配置面板：通过 NodeToolbar portal 渲染在预览区下方，不在 200px 容器内 */}
        <NodeToolbar
          nodeId={id}
          isVisible={selected}
          position={Position.Bottom}
          offset={8}
          align="center"
          className="nodrag seedance-config-glass w-[min(720px,calc(100vw-3rem))] overflow-hidden rounded-2xl border shadow-xl"
        >
          <SeedanceWideConfigPanel
            id={id}
            data={seedanceData}
            disabled={nodeDisabled}
            nodes={nodes}
            edges={edges}
          />
        </NodeToolbar>
      </>
    )
  }

  // Start node — minimal
  return (
    <div
      className={cn(
        'w-[240px] rounded-xl border bg-surface px-3 py-2.5 shadow-sm',
        selected ? 'border-primary-light ring-2 ring-primary-light/20' : 'border-border',
      )}
    >
      <WorkflowNodeHandle type="source" position={Position.Right} centerY={20} />
      <div className="flex items-center gap-2 text-xs text-muted">
        <Play className="h-3.5 w-3.5 text-emerald-500" />
        <span>开始</span>
      </div>
    </div>
  )
}
