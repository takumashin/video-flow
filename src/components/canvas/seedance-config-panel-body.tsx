'use client'

import { cn } from '@/lib/cn'
import type { ImageRole, SeedanceNodeData, WorkflowEdge, WorkflowNode } from '@/lib/types'
import {
  getRecommendedModelForModeChange,
  shouldDisableAudio,
} from '@/lib/seedance-models'
import { getSeedanceUpstreamRefs } from '@/lib/seedance-upstream'
import { getSeedanceModeInputRules } from '@/lib/seedance-connection-rules'
import { validateSeedanceNode } from '@/lib/workflow-engine'
import { useWorkflowStore } from '@/store/workflow-store'
import PromptWithMentions from './prompt-with-mentions'
import SeedanceConnectedInputs, { SeedanceConnectedTextHint } from './seedance-connected-inputs'
import { CompactSeedanceModelSelect } from './seedance-model-select'
import { CompactVideoParamsTrigger } from './seedance-video-params'
import { SeedanceGenerateButton } from './seedance-node-panel'
import { SeedanceModeSwitcher } from './node-fields'

type SeedanceConfigPanelBodyProps = {
  id: string
  data: SeedanceNodeData
  disabled: boolean
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  variant?: 'inline' | 'modal'
}

export default function SeedanceConfigPanelBody({
  id,
  data,
  disabled,
  nodes,
  edges,
  variant = 'inline',
}: SeedanceConfigPanelBodyProps) {
  const updateNodeData = useWorkflowStore(s => s.updateNodeData)
  const pruneSeedanceEdgesForMode = useWorkflowStore(s => s.pruneSeedanceEdgesForMode)
  const upstreamRefs = getSeedanceUpstreamRefs(id, nodes, edges)
  const validationError = validateSeedanceNode(id, nodes, edges)
  const mode = data.generationMode ?? 'text_to_video'
  const rules = getSeedanceModeInputRules(mode)
  const isModal = variant === 'modal'
  const promptValue = data.prompt ?? (data as { composedPrompt?: string }).composedPrompt ?? ''

  const handleModeChange = (generationMode: typeof mode) => {
    const nextModel = getRecommendedModelForModeChange(generationMode, data.model)
    updateNodeData(id, {
      generationMode,
      model: nextModel,
      generateAudio: shouldDisableAudio(nextModel) ? false : data.generateAudio,
    })
    pruneSeedanceEdgesForMode(id, generationMode)
  }

  const connectedInputProps = {
    seedanceNodeId: id,
    refs: upstreamRefs,
    mode,
    disabled,
    layout: 'row' as const,
    onRemoveImage: (imageNodeId: string) =>
      useWorkflowStore.getState().disconnectUpstreamImage(id, imageNodeId),
    onRemoveVideo: (videoNodeId: string) =>
      useWorkflowStore.getState().disconnectUpstreamVideo(id, videoNodeId),
    onRemoveAudio: (audioNodeId: string) =>
      useWorkflowStore.getState().disconnectUpstreamAudio(id, audioNodeId),
    onUploadFrameImage: (role: ImageRole, imageUrl: string) =>
      useWorkflowStore.getState().setSeedanceFrameImage(id, role, imageUrl),
  }

  const showConnectedInputs = mode === 'omni_reference'
    || mode !== 'text_to_video'
    || upstreamRefs.images.length > 0
    || upstreamRefs.videos.length > 0
    || upstreamRefs.audios.length > 0

  return (
    <div className={cn(isModal ? 'space-y-4' : 'p-3 pt-2')}>
      <SeedanceModeSwitcher
        value={mode}
        onChange={handleModeChange}
        disabled={disabled}
        layout="row"
      />

      {mode === 'omni_reference' && isModal && (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-border-subtle bg-surface-muted/70 px-3 py-2.5">
          <p className="text-xs leading-relaxed text-muted">
            全能参考模式：可上传或连接图片、视频、音频作为参考素材，在下方描述中通过 @ 引用
          </p>
        </div>
      )}

      {showConnectedInputs && (
        <>
          <div className="h-px bg-border" />
          <SeedanceConnectedInputs {...connectedInputProps} />
          {!upstreamRefs.images.length
            && !upstreamRefs.videos.length
            && !upstreamRefs.audios.length
            && mode !== 'text_to_video'
            && mode !== 'first_last_frame'
            && mode !== 'omni_reference' && (
            <p className={cn('text-muted', isModal ? 'text-xs' : 'mt-1.5 text-[10px]')}>{rules.hint}</p>
          )}
        </>
      )}

      {!validationError && upstreamRefs.texts.length > 0 && (
        <div className={isModal ? undefined : 'mt-2'}>
          <SeedanceConnectedTextHint refs={upstreamRefs} />
        </div>
      )}

      <div className="h-px bg-border" />

      <div className="relative">
        <PromptWithMentions
          value={promptValue}
          onChange={prompt => updateNodeData(id, { prompt })}
          refs={upstreamRefs}
          mode={mode}
          disabled={disabled}
          variant={isModal ? 'modal' : 'wide'}
          showCharCount
        />
      </div>

      {validationError && (
        <p className={cn('text-red-600 dark:text-red-400', isModal ? 'text-xs' : 'mt-2 text-[11px]')}>
          {validationError}
        </p>
      )}

      <div className={cn(
        'flex items-center justify-between gap-3 border-border',
        isModal ? 'border-t pt-4' : 'mt-2 border-t pt-2',
      )}
      >
        <div className="flex min-w-0 flex-wrap items-center gap-1">
          <CompactSeedanceModelSelect
            mode={mode}
            model={data.model}
            resolution={data.resolution ?? '720p'}
            onModelChange={(model, supportsAudio) => updateNodeData(id, {
              model,
              generateAudio: supportsAudio ? data.generateAudio : false,
            })}
            disabled={disabled}
          />
          <CompactVideoParamsTrigger
            resolution={data.resolution ?? '720p'}
            ratio={data.ratio}
            duration={data.duration ?? 5}
            onResolutionChange={resolution => updateNodeData(id, { resolution })}
            onRatioChange={ratio => updateNodeData(id, { ratio })}
            onDurationChange={duration => updateNodeData(id, { duration })}
            disabled={disabled}
            generateAudio={data.generateAudio}
            cameraFixed={data.cameraFixed}
            watermark={data.watermark}
            seed={data.seed ?? -1}
            model={data.model}
            onGenerateAudioChange={generateAudio => updateNodeData(id, { generateAudio })}
            onCameraFixedChange={cameraFixed => updateNodeData(id, { cameraFixed })}
            onWatermarkChange={watermark => updateNodeData(id, { watermark })}
            onSeedChange={seed => updateNodeData(id, { seed })}
          />
        </div>

        <div className="shrink-0">
          <SeedanceGenerateButton
            id={id}
            data={data}
            nodes={nodes}
            edges={edges}
            layout="compact"
          />
        </div>
      </div>
    </div>
  )
}
