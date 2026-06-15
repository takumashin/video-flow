'use client'

import { cn } from '@/lib/cn'
import {
  CUSTOM_MODEL_VALUE,
  getDefaultModelForMode,
  getModelOption,
  getModelsForMode,
  isKnownModelId,
  shouldDisableAudio,
} from '@/lib/seedance-models'
import type { SeedanceGenerationMode } from '@/lib/types'
import { FieldLabel, NodeSelect, NodeTextInput } from './node-fields'

type SeedanceModelSelectProps = {
  mode: SeedanceGenerationMode
  model: string
  onModelChange: (model: string, supportsAudio: boolean) => void
  disabled?: boolean
}

export function SeedanceModelSelect({
  mode,
  model,
  onModelChange,
  disabled,
}: SeedanceModelSelectProps) {
  const availableModels = getModelsForMode(mode)
  const isCustom = model && !isKnownModelId(model)
  const selectValue = isCustom ? CUSTOM_MODEL_VALUE : (model || getDefaultModelForMode(mode))
  const activeModel = isCustom ? undefined : getModelOption(model)

  const handleSelectChange = (value: string) => {
    if (value === CUSTOM_MODEL_VALUE) {
      if (!isCustom)
        onModelChange('', !shouldDisableAudio(''))
      return
    }

    const option = getModelOption(value)
    onModelChange(value, option?.supportsAudio ?? false)
  }

  return (
    <div className="space-y-2">
      <div>
        <FieldLabel>模型（官方 Model ID）</FieldLabel>
        <NodeSelect
          value={selectValue}
          onChange={handleSelectChange}
          options={[
            ...availableModels.map(item => ({
              value: item.id,
              label: `${item.label} · ${item.id}`,
            })),
            { value: CUSTOM_MODEL_VALUE, label: '自定义 Endpoint ID（ep-）' },
          ]}
          disabled={disabled}
        />
      </div>

      {isCustom && (
        <div>
          <FieldLabel>Endpoint ID</FieldLabel>
          <NodeTextInput
            value={model}
            onChange={value => onModelChange(value, !shouldDisableAudio(value))}
            placeholder="ep-xxxxxxxx"
            disabled={disabled}
          />
        </div>
      )}

      <p className="text-[10px] leading-relaxed text-muted">
        {activeModel?.description ?? (isCustom
          ? '火山方舟控制台创建的推理接入点 ID，格式 ep- 开头'
          : '根据当前生成模式筛选可用官方模型')}
        {activeModel?.docUrl && (
          <>
            {' · '}
            <a
              href={activeModel.docUrl}
              target="_blank"
              rel="noreferrer"
              className={cn('text-primary-light hover:underline')}
            >
              官方文档
            </a>
          </>
        )}
      </p>
    </div>
  )
}
