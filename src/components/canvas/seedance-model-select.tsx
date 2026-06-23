'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'
import AnchoredPortalPanel from '@/components/anchored-portal-panel'
import { cn } from '@/lib/cn'
import {
  CUSTOM_MODEL_VALUE,
  getDefaultModelForMode,
  getModelOption,
  getModelsForMode,
  getSeedanceGenerationCreditCost,
  isKnownModelId,
  shouldDisableAudio,
} from '@/lib/seedance-models'
import type { SeedanceGenerationMode, SeedanceVideoResolution } from '@/lib/types'
import { FieldLabel, NodeTextInput } from './node-fields'

type ModelMenuOption = {
  value: string
  label: string
  description?: string
  creditCost?: number
}

type SeedanceModelMenuProps = {
  value: string
  options: ModelMenuOption[]
  onChange: (value: string) => void
  disabled?: boolean
}

export function SeedanceModelMenu({
  value,
  options,
  onChange,
  disabled,
}: SeedanceModelMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selected = options.find(option => option.value === value)

  useEffect(() => {
    if (!open)
      return

    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node))
        setOpen(false)
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onPointerDown={event => event.stopPropagation()}
        onClick={() => setOpen(current => !current)}
        className={cn(
          'nodrag flex w-full items-center justify-between gap-2 rounded-md border border-border bg-input px-2.5 py-2 text-left transition',
          'hover:border-primary-light/40 hover:bg-surface-muted disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-primary-light ring-1 ring-primary-light/25',
        )}
      >
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-foreground">
            {selected?.label ?? '请选择模型'}
          </p>
          {selected?.description && (
            <p className="line-clamp-1 text-[10px] text-muted">{selected.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {selected?.creditCost != null && (
            <span className="rounded-md bg-surface-muted px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-foreground">
              {selected.creditCost} 点
            </span>
          )}
          <ChevronDown className={cn('h-3.5 w-3.5 text-muted transition', open && 'rotate-180')} />
        </div>
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className="nodrag absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          onPointerDown={event => event.stopPropagation()}
        >
          <ul className="max-h-64 overflow-y-auto py-1">
            {options.map(option => {
              const active = option.value === value
              return (
                <li key={option.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    className={cn(
                      'flex w-full items-start gap-2 px-2.5 py-2 text-left transition',
                      active
                        ? 'bg-primary/10 text-primary-light'
                        : 'text-foreground hover:bg-surface-muted',
                    )}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                  >
                    <Check className={cn('mt-0.5 h-3.5 w-3.5 shrink-0', active ? 'opacity-100' : 'opacity-0')} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-xs font-semibold">{option.label}</span>
                        {option.creditCost != null && (
                          <span className={cn(
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium tabular-nums',
                            active ? 'bg-primary/15 text-primary-light' : 'bg-surface-muted text-muted',
                          )}
                          >
                            {option.creditCost} 点
                          </span>
                        )}
                      </span>
                      {option.description && (
                        <span className="mt-0.5 block text-[10px] leading-relaxed text-muted">
                          {option.description}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}

type SeedanceModelSelectProps = {
  mode: SeedanceGenerationMode
  model: string
  resolution?: SeedanceVideoResolution
  onModelChange: (model: string, supportsAudio: boolean) => void
  disabled?: boolean
}

export function SeedanceModelSelect({
  mode,
  model,
  resolution = '720p',
  onModelChange,
  disabled,
}: SeedanceModelSelectProps) {
  const availableModels = getModelsForMode(mode)
  const isCustom = model && !isKnownModelId(model)
  const selectValue = isCustom ? CUSTOM_MODEL_VALUE : (model || getDefaultModelForMode(mode))
  const activeModel = isCustom ? undefined : getModelOption(model)
  const activeCost = isCustom
    ? (model
        ? getSeedanceGenerationCreditCost(model, resolution)
        : getSeedanceGenerationCreditCost('', resolution))
    : getSeedanceGenerationCreditCost(model || getDefaultModelForMode(mode), resolution)

  const menuOptions: ModelMenuOption[] = [
    ...availableModels.map(item => ({
      value: item.id,
      label: item.label,
      description: item.description,
      creditCost: getSeedanceGenerationCreditCost(item.id, resolution),
    })),
    {
      value: CUSTOM_MODEL_VALUE,
      label: '自定义 Endpoint ID',
      description: '火山方舟控制台创建的推理接入点（ep- 开头）',
    },
  ]

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
        <SeedanceModelMenu
          value={selectValue}
          onChange={handleSelectChange}
          options={menuOptions}
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
        {' · '}
        <span className="font-medium text-foreground">
          每次生成消耗 {activeCost} 点（{resolution}）
        </span>
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

export function CompactSeedanceModelSelect({
  mode,
  model,
  resolution = '720p',
  onModelChange,
  disabled,
}: SeedanceModelSelectProps) {
  const availableModels = getModelsForMode(mode)
  const isCustom = model && !isKnownModelId(model)
  const selectValue = isCustom ? CUSTOM_MODEL_VALUE : (model || getDefaultModelForMode(mode))

  const menuOptions: ModelMenuOption[] = [
    ...availableModels.map(item => ({
      value: item.id,
      label: item.label,
      description: item.description,
      creditCost: getSeedanceGenerationCreditCost(item.id, resolution),
    })),
    {
      value: CUSTOM_MODEL_VALUE,
      label: '自定义 Endpoint ID',
      description: '火山方舟控制台创建的推理接入点（ep- 开头）',
    },
  ]

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
    <div className="min-w-[8rem] shrink-0">
      <CompactModelTrigger
        value={selectValue}
        options={menuOptions}
        onChange={handleSelectChange}
        disabled={disabled}
      />
      {isCustom && (
        <div className="mt-1.5 w-40">
          <NodeTextInput
            value={model}
            onChange={value => onModelChange(value, !shouldDisableAudio(value))}
            placeholder="ep-xxxxxxxx"
            disabled={disabled}
          />
        </div>
      )}
    </div>
  )
}

function CompactModelTrigger({
  value,
  options,
  onChange,
  disabled,
}: {
  value: string
  options: ModelMenuOption[]
  onChange: (value: string) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const selected = options.find(option => option.value === value)

  return (
    <AnchoredPortalPanel
      open={open}
      onClose={() => setOpen(false)}
      panelClassName="w-64 overflow-hidden p-0"
      trigger={(
        <button
          type="button"
          disabled={disabled}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => setOpen(v => !v)}
          className={cn(
            'nodrag inline-flex h-8 max-w-[10rem] items-center gap-1 rounded-lg px-2.5 text-xs font-medium text-foreground transition',
            'hover:bg-surface-muted disabled:opacity-50',
            open && 'bg-surface-muted',
          )}
          title="模型"
        >
          <span className="truncate">{selected?.label ?? '选择模型'}</span>
          <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 opacity-50', open && 'rotate-180')} />
        </button>
      )}
    >
      <ul className="max-h-56 overflow-y-auto py-1">
        {options.map(option => {
          const active = option.value === value
          return (
            <li key={option.value}>
              <button
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 px-2.5 py-2 text-left text-xs transition',
                  active ? 'bg-primary/10 text-primary-light' : 'hover:bg-surface-muted',
                )}
                onClick={() => {
                  onChange(option.value)
                  setOpen(false)
                }}
              >
                <span className="min-w-0 flex-1 font-medium">{option.label}</span>
                {option.creditCost != null && (
                  <span className="shrink-0 text-[10px] text-muted">{option.creditCost} 点</span>
                )}
              </button>
            </li>
          )
        })}
      </ul>
    </AnchoredPortalPanel>
  )
}
