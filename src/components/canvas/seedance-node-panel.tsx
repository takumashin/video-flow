'use client'

import { Loader2, Play } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SeedanceNodeData, WorkflowEdge, WorkflowNode } from '@/lib/types'
import {
  getModelOption,
  getRecommendedModelForModeChange,
  shouldDisableAudio,
} from '@/lib/seedance-models'
import { getSeedanceUpstreamRefs } from '@/lib/seedance-upstream'
import { SEEDANCE_MODE_OPTIONS } from '@/lib/seedance-modes'
import { useWorkflowStore } from '@/store/workflow-store'
import VideoGenLoadingState from '@/components/video-gen-loading-state'
import PromptWithMentions from './prompt-with-mentions'
import SeedanceConnectedInputs, { SeedanceConnectedTextHint } from './seedance-connected-inputs'
import { SeedanceModelSelect } from './seedance-model-select'
import { SeedanceVideoParams } from './seedance-video-params'
import {
  FieldLabel,
  NodeTextInput,
  NodeToggle,
  SeedanceModeSwitcher,
  StatusBadge,
} from './node-fields'

type SeedancePanelProps = {
  id: string
  data: SeedanceNodeData
  disabled: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export function SeedanceNodeSummary({
  id,
  data,
  nodes,
  edges,
  selected,
}: SeedancePanelProps & { selected: boolean }) {
  const mode = data.generationMode ?? 'text_to_video'
  const modeLabel = SEEDANCE_MODE_OPTIONS.find(o => o.value === mode)?.label ?? mode
  const modelLabel = getModelOption(data.model)?.label ?? data.model
  const prompt = (data.prompt ?? (data as { composedPrompt?: string }).composedPrompt ?? '').trim()
  const isGenerating = data.status === 'running'
  const upstreamRefs = getSeedanceUpstreamRefs(id, nodes, edges)
  const refCount = upstreamRefs.images.length + upstreamRefs.videos.length + upstreamRefs.audios.length

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="rounded-md border border-border bg-input px-2 py-0.5 text-[10px] font-medium text-foreground">
          {modeLabel}
        </span>
        <span className="rounded-md border border-border bg-input px-2 py-0.5 text-[10px] text-muted">
          {modelLabel}
        </span>
        {refCount > 0 && (
          <span className="rounded-md border border-border bg-input px-2 py-0.5 text-[10px] text-muted">
            {refCount} 个参考
          </span>
        )}
      </div>

      {prompt
        ? (
            <p className="line-clamp-2 text-xs leading-relaxed text-secondary">{prompt}</p>
          )
        : (
            <p className="text-xs text-muted">尚未填写提示词</p>
          )}

      {isGenerating && (
        <VideoGenLoadingState
          progress={data.progress}
          label="正在生成视频…"
          maxWidth="100%"
          aspectRatio="video"
          className="nodrag"
        />
      )}

      {!isGenerating && (data.status !== 'idle' || data.progress != null) && (
        <StatusBadge
          status={data.status}
          error={data.error}
          taskId={data.taskId}
          progress={data.progress}
        />
      )}

      {!selected && !isGenerating && (
        <p className="text-[10px] text-muted/80">选中节点以展开详细配置</p>
      )}
    </div>
  )
}

export function SeedanceNodeDetailPanel({
  id,
  data,
  disabled,
  nodes,
  edges,
  className,
}: SeedancePanelProps & { className?: string }) {
  const updateNodeData = useWorkflowStore(s => s.updateNodeData)
  const pruneSeedanceEdgesForMode = useWorkflowStore(s => s.pruneSeedanceEdgesForMode)
  const upstreamRefs = getSeedanceUpstreamRefs(id, nodes, edges)
  const isGenerating = data.status === 'running'

  return (
    <div
      className={cn(
        'nodrag rounded-xl border border-primary-light/40 bg-surface px-3 py-2.5 shadow-lg ring-2 ring-primary-light/15',
        className,
      )}
      onPointerDown={e => e.stopPropagation()}
    >
      <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">
        生成配置
      </p>

      <div className="space-y-2.5">
        <PromptWithMentions
          value={data.prompt ?? (data as { composedPrompt?: string }).composedPrompt ?? ''}
          onChange={prompt => updateNodeData(id, { prompt })}
          refs={upstreamRefs}
          mode={data.generationMode ?? 'text_to_video'}
          disabled={disabled}
        />
        <SeedanceConnectedInputs
          refs={upstreamRefs}
          mode={data.generationMode ?? 'text_to_video'}
          disabled={disabled}
          onRemoveImage={imageNodeId =>
            useWorkflowStore.getState().disconnectUpstreamImage(id, imageNodeId)}
          onRemoveVideo={videoNodeId =>
            useWorkflowStore.getState().disconnectUpstreamVideo(id, videoNodeId)}
          onRemoveAudio={audioNodeId =>
            useWorkflowStore.getState().disconnectUpstreamAudio(id, audioNodeId)}
        />
        <SeedanceConnectedTextHint refs={upstreamRefs} />
        <SeedanceModeSwitcher
          value={data.generationMode ?? 'text_to_video'}
          onChange={generationMode => {
            const nextModel = getRecommendedModelForModeChange(generationMode, data.model)
            updateNodeData(id, {
              generationMode,
              model: nextModel,
              generateAudio: shouldDisableAudio(nextModel) ? false : data.generateAudio,
            })
            pruneSeedanceEdgesForMode(id, generationMode)
          }}
          disabled={disabled}
        />
        <SeedanceModelSelect
          mode={data.generationMode ?? 'text_to_video'}
          model={data.model}
          onModelChange={(model, supportsAudio) => updateNodeData(id, {
            model,
            generateAudio: supportsAudio ? data.generateAudio : false,
          })}
          disabled={disabled}
        />
        <SeedanceVideoParams
          resolution={data.resolution ?? '720p'}
          ratio={data.ratio}
          duration={data.duration ?? 5}
          onResolutionChange={resolution => updateNodeData(id, { resolution })}
          onRatioChange={ratio => updateNodeData(id, { ratio })}
          onDurationChange={duration => updateNodeData(id, { duration })}
          disabled={disabled}
        />
        <div>
          <FieldLabel>随机种子</FieldLabel>
          <NodeTextInput
            value={data.seed != null && data.seed >= 0 ? String(data.seed) : ''}
            onChange={v => {
              const trimmed = v.trim()
              updateNodeData(id, {
                seed: trimmed === '' ? -1 : Math.max(0, Math.floor(Number(trimmed) || 0)),
              })
            }}
            placeholder="留空为随机"
            disabled={disabled}
          />
        </div>
        <p className="text-[10px] leading-relaxed text-muted">
          参数按火山方舟 API 提交：resolution、ratio、duration、seed、camera_fixed、watermark
        </p>
        <div className="space-y-1.5">
          <NodeToggle
            label="生成音频"
            checked={data.generateAudio}
            onChange={generateAudio => updateNodeData(id, { generateAudio })}
            disabled={disabled || shouldDisableAudio(data.model)}
          />
          <NodeToggle
            label="固定镜头"
            checked={data.cameraFixed}
            onChange={cameraFixed => updateNodeData(id, { cameraFixed })}
            disabled={disabled}
          />
          <NodeToggle
            label="添加水印"
            checked={data.watermark}
            onChange={watermark => updateNodeData(id, { watermark })}
            disabled={disabled}
          />
        </div>
        <button
          type="button"
          disabled={disabled || isGenerating}
          onClick={() => useWorkflowStore.getState().runSeedanceNode(id)}
          className="nodrag inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#104BD4] disabled:opacity-60"
        >
          {isGenerating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Play className="h-4 w-4" />}
          {isGenerating
            ? (data.progress != null ? `生成中 ${data.progress}%` : '生成中...')
            : '生成视频'}
        </button>
      </div>
    </div>
  )
}
