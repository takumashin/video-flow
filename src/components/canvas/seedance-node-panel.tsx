'use client'

import { useState } from 'react'
import { History, Loader2, Play, Square } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { SeedanceNodeData, WorkflowEdge, WorkflowNode } from '@/lib/types'
import {
  getModelOption,
  getRecommendedModelForModeChange,
  shouldDisableAudio,
} from '@/lib/seedance-models'
import { getSeedanceUpstreamRefs, hasSeedancePromptContent } from '@/lib/seedance-upstream'
import { isSeedanceJobInflight } from '@/lib/seedance-generation-control'
import { SEEDANCE_MODE_OPTIONS } from '@/lib/seedance-modes'
import { getSeedanceTaskPhaseLabel, isSystemQueuedSeedanceTaskStatus } from '@/lib/seedance-progress'
import { useFakeSeedanceProgress } from '@/lib/use-fake-seedance-progress'
import { useWorkflowStore } from '@/store/workflow-store'
import VideoGenLoadingState from '@/components/video-gen-loading-state'
import VideoDownloadLink from '@/components/video-download-link'
import NodeVideoPlayer from '@/components/canvas/node-video-player'
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

function useSeedanceNodeProgress(data: SeedanceNodeData, isGenerating: boolean) {
  const progressStatus = isGenerating
    ? (data.taskStatus ?? 'running')
    : data.status

  return useFakeSeedanceProgress(
    data.progressStartedAt,
    progressStatus,
    data.progress,
  )
}

function getSeedanceNodeGeneratingLabel(
  data: SeedanceNodeData,
  displayProgress?: number,
  options?: { hasPreviousVideo?: boolean },
) {
  if (isSystemQueuedSeedanceTaskStatus(data.taskStatus)) {
    return getSeedanceTaskPhaseLabel({
      taskStatus: data.taskStatus,
      queuePosition: data.queuePosition,
    })
  }

  if (data.taskStatus === 'queued') {
    return getSeedanceTaskPhaseLabel({
      taskStatus: data.taskStatus,
      progress: displayProgress,
    })
  }

  if (options?.hasPreviousVideo)
    return displayProgress != null ? `正在生成新视频… ${displayProgress}%` : '正在生成新视频…'

  return getSeedanceTaskPhaseLabel({
    taskStatus: data.taskStatus ?? 'running',
    progress: displayProgress,
    generatingVideo: true,
  })
}

function SeedanceGenerateButton({
  id,
  data,
  nodes,
}: {
  id: string
  data: SeedanceNodeData
  nodes: WorkflowNode[]
}) {
  const activeSessionId = useWorkflowStore(s => s.activeSessionId)
  const cancelSeedanceNode = useWorkflowStore(s => s.cancelSeedanceNode)
  const isGenerating = data.status === 'running'
  const isJobActive = isSeedanceJobInflight(activeSessionId, id)
  const isStuckGenerating = isGenerating && !isJobActive
  const canCancel = isGenerating && !isStuckGenerating && (isJobActive || !!data.taskId)
  const seedanceNode = nodes.find(node => node.id === id)
  const hasPrompt = seedanceNode
    ? hasSeedancePromptContent(seedanceNode)
    : (data.prompt ?? '').trim().length > 0
  const canSubmit = hasPrompt || isStuckGenerating
  const displayProgress = useSeedanceNodeProgress(data, isGenerating)
  const generatingLabel = getSeedanceNodeGeneratingLabel(data, displayProgress)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)

  const handleCancel = async () => {
    setCancelling(true)
    setCancelError(null)
    try {
      await cancelSeedanceNode(id)
    }
    catch (error) {
      setCancelError(error instanceof Error ? error.message : '取消失败')
    }
    finally {
      setCancelling(false)
    }
  }

  return (
    <div className="space-y-2">
      {canCancel && (
        <button
          type="button"
          disabled={cancelling}
          onClick={() => void handleCancel()}
          className="nodrag inline-flex w-full items-center justify-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-500/15 disabled:opacity-60 dark:text-red-400"
        >
          {cancelling
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Square className="h-4 w-4 fill-current" />}
          {cancelling ? '正在取消…' : '取消生成'}
        </button>
      )}
      <button
        type="button"
        disabled={(isGenerating && isJobActive) || cancelling || !canSubmit}
        onClick={() => {
          const store = useWorkflowStore.getState()
          if (isStuckGenerating)
            void store.resumeSeedanceNode(id)
          else
            void store.runSeedanceNode(id)
        }}
        className="nodrag inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-[#104BD4] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isStuckGenerating
          ? <Play className="h-4 w-4" />
          : isGenerating
            ? <Loader2 className="h-4 w-4 animate-spin" />
            : <Play className="h-4 w-4" />}
        {isStuckGenerating
          ? '恢复进度'
          : isGenerating
            ? generatingLabel
            : '生成视频'}
      </button>
      {cancelError && (
        <p className="text-[11px] text-red-600 dark:text-red-400">{cancelError}</p>
      )}
      {!hasPrompt && !isGenerating && (
        <p className="text-[11px] text-amber-600 dark:text-amber-400">
          请先在右侧栏或节点内填写提示词后再生成视频
        </p>
      )}
    </div>
  )
}

function SeedanceLatestVideo({
  id,
  videoUrl,
  historyCount,
  taskId,
  previousLabel,
  embedded = false,
}: {
  id: string
  videoUrl: string
  historyCount: number
  taskId?: string
  previousLabel?: string
  embedded?: boolean
}) {
  return (
    <div className="space-y-2">
      {previousLabel && (
        <p className="text-[10px] font-medium text-muted">{previousLabel}</p>
      )}
      {!embedded && <NodeVideoPlayer src={videoUrl} />}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <button
          type="button"
          className="nodrag inline-flex items-center gap-1 text-[11px] font-medium text-primary-light hover:underline"
          onClick={() => useWorkflowStore.getState().openVideoHistoryModal(id)}
        >
          <History className="h-3 w-3" />
          生成历史 ({historyCount})
        </button>
        <VideoDownloadLink
          videoUrl={videoUrl}
          taskId={taskId}
          className="text-[11px] font-medium text-muted hover:text-primary-light hover:underline"
          showIcon={false}
        />
      </div>
    </div>
  )
}

function SeedanceNodeMediaSlot({
  id,
  data,
  isGenerating,
  isSystemQueue,
  displayProgress,
  generatingLabel,
  latestVideo,
  historyCount,
}: {
  id: string
  data: SeedanceNodeData
  isGenerating: boolean
  isSystemQueue: boolean
  displayProgress?: number
  generatingLabel: string
  latestVideo?: string
  historyCount: number
}) {
  const awaitingVideo = !latestVideo && data.status === 'succeeded' && Boolean(data.taskId)
  const showLoading = isGenerating || awaitingVideo
  const showSlot = showLoading || Boolean(latestVideo)

  if (!showSlot)
    return null

  return (
    <div className="space-y-2">
      <div className="relative aspect-video w-full overflow-hidden rounded-md bg-surface-muted">
        {latestVideo && (
          <div
            className={cn(
              'absolute inset-0',
              showLoading && 'pointer-events-none opacity-35',
            )}
          >
            <NodeVideoPlayer
              src={latestVideo}
              className="h-full min-h-0 rounded-none !aspect-auto"
            />
          </div>
        )}
        {showLoading && (
          <div className={cn('h-full w-full', latestVideo && 'absolute inset-0 z-[1]')}>
            <VideoGenLoadingState
              progress={isSystemQueue ? undefined : displayProgress}
              label={generatingLabel}
              maxWidth="100%"
              fill
              className="nodrag h-full"
            />
          </div>
        )}
      </div>
      {latestVideo && (
        <SeedanceLatestVideo
          id={id}
          videoUrl={latestVideo}
          historyCount={historyCount}
          taskId={isGenerating ? data.videoHistory?.[0]?.taskId ?? data.taskId : data.taskId}
          embedded
        />
      )}
    </div>
  )
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
  const upstreamRefs = getSeedanceUpstreamRefs(id, nodes, edges)
  const refCount = upstreamRefs.images.length + upstreamRefs.videos.length + upstreamRefs.audios.length
  const latestVideo = data.videoUrl ?? data.videoHistory?.[0]?.videoUrl
  const historyCount = data.videoHistory?.length ?? 0
  const isGenerating = data.status === 'running'
  const isSystemQueue = isSystemQueuedSeedanceTaskStatus(data.taskStatus)
  const displayProgress = useSeedanceNodeProgress(data, isGenerating)
  const generatingLabel = getSeedanceNodeGeneratingLabel(data, displayProgress, {
    hasPreviousVideo: Boolean(latestVideo || historyCount > 0),
  })

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

      <SeedanceNodeMediaSlot
        id={id}
        data={data}
        isGenerating={isGenerating}
        isSystemQueue={isSystemQueue}
        displayProgress={displayProgress}
        generatingLabel={generatingLabel}
        latestVideo={latestVideo}
        historyCount={historyCount}
      />

      {!latestVideo && historyCount > 0 && (
        <button
          type="button"
          className="nodrag flex w-full items-center justify-center gap-1.5 rounded-md border border-dashed border-border bg-surface-muted py-3 text-xs text-muted transition hover:border-border hover:bg-surface-muted/80"
          onClick={() => useWorkflowStore.getState().openVideoHistoryModal(id)}
        >
          <History className="h-3.5 w-3.5" />
          查看 {historyCount} 条生成历史
        </button>
      )}

      {!isGenerating && (data.status === 'failed' || data.error) && (
        <StatusBadge
          status="failed"
          error={data.error}
          taskId={data.taskId}
          progress={displayProgress}
        />
      )}

      <SeedanceGenerateButton id={id} data={data} nodes={nodes} />

      {!selected && !isGenerating && (
        <p className="text-[10px] text-muted/80">点击节点后在右侧栏编辑参数</p>
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
  variant = 'floating',
}: SeedancePanelProps & { className?: string; variant?: 'floating' | 'sidebar' }) {
  const updateNodeData = useWorkflowStore(s => s.updateNodeData)
  const pruneSeedanceEdgesForMode = useWorkflowStore(s => s.pruneSeedanceEdgesForMode)
  const upstreamRefs = getSeedanceUpstreamRefs(id, nodes, edges)
  const seedanceNode = nodes.find(node => node.id === id)
  const hasPrompt = seedanceNode
    ? hasSeedancePromptContent(seedanceNode)
    : (data.prompt ?? '').trim().length > 0

  return (
    <div
      className={cn(
        variant === 'sidebar'
          ? 'space-y-2.5'
          : 'nodrag rounded-xl border border-primary-light/40 bg-surface px-3 py-2.5 shadow-lg ring-2 ring-primary-light/15',
        className,
      )}
      onPointerDown={variant === 'floating' ? e => e.stopPropagation() : undefined}
    >
      {variant === 'floating' && (
        <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted">
          生成配置
        </p>
      )}

      <div className="space-y-2.5">
        <PromptWithMentions
          value={data.prompt ?? (data as { composedPrompt?: string }).composedPrompt ?? ''}
          onChange={prompt => updateNodeData(id, { prompt })}
          refs={upstreamRefs}
          mode={data.generationMode ?? 'text_to_video'}
          disabled={disabled}
        />
        {!hasPrompt && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400">
            请填写视频描述（提示词），未填写时无法提交生成
          </p>
        )}
        <SeedanceConnectedInputs
          seedanceNodeId={id}
          refs={upstreamRefs}
          mode={data.generationMode ?? 'text_to_video'}
          disabled={disabled}
          onRemoveImage={imageNodeId =>
            useWorkflowStore.getState().disconnectUpstreamImage(id, imageNodeId)}
          onRemoveVideo={videoNodeId =>
            useWorkflowStore.getState().disconnectUpstreamVideo(id, videoNodeId)}
          onRemoveAudio={audioNodeId =>
            useWorkflowStore.getState().disconnectUpstreamAudio(id, audioNodeId)}
          onUploadFrameImage={(role, imageUrl) =>
            useWorkflowStore.getState().setSeedanceFrameImage(id, role, imageUrl)}
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
      </div>
    </div>
  )
}
