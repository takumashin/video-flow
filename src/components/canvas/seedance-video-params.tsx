'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { ChevronDown, Sparkles } from 'lucide-react'
import { cn } from '@/lib/cn'
import {
  DURATION_MAX,
  DURATION_MIN,
  DURATION_SMART,
  RATIO_OPTIONS,
  RESOLUTION_OPTIONS,
} from '@/lib/seedance-params'
import type { SeedanceVideoRatio, SeedanceVideoResolution } from '@/lib/types'
import { FieldLabel } from './node-fields'

const RESOLUTION_HINTS: Record<SeedanceVideoResolution, string> = {
  '480p': '标清 · 适合预览',
  '720p': '推荐 · 速度与画质平衡',
  '1080p': '高清 · 更清晰画面',
}

function RatioPreview({ ratio, className }: { ratio: SeedanceVideoRatio; className?: string }) {
  const max = 22
  let w = max
  let h = max

  switch (ratio) {
    case '16:9':
      w = max
      h = Math.round(max * 9 / 16)
      break
    case '9:16':
      w = Math.round(max * 9 / 16)
      h = max
      break
    case '1:1':
      w = max
      h = max
      break
    case '4:3':
      w = max
      h = Math.round(max * 3 / 4)
      break
    case '3:4':
      w = Math.round(max * 3 / 4)
      h = max
      break
    case '21:9':
      w = max
      h = Math.round(max * 9 / 21)
      break
    case 'adaptive':
      return (
        <div
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded border border-dashed border-current/50 text-[9px] font-semibold',
            className,
          )}
        >
          自
        </div>
      )
  }

  return (
    <div
      className={cn('rounded-sm border-2 border-current bg-current/15', className)}
      style={{ width: w, height: h }}
    />
  )
}

type ResolutionMenuProps = {
  value: SeedanceVideoResolution
  onChange: (value: SeedanceVideoResolution) => void
  disabled?: boolean
}

export function ResolutionMenu({ value, onChange, disabled }: ResolutionMenuProps) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open)
      return
    const onPointerDown = (e: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node))
        setOpen(false)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        disabled={disabled}
        onPointerDown={e => e.stopPropagation()}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'nodrag flex w-full items-center justify-between gap-2 rounded-md border border-border bg-input px-2.5 py-2 text-left transition',
          'hover:border-primary-light/40 hover:bg-surface-muted disabled:opacity-50',
          open && 'border-primary-light ring-1 ring-primary-light/25',
        )}
      >
        <div className="min-w-0">
          <p className="text-xs font-medium text-foreground">{value}</p>
          <p className="text-[10px] text-muted">{RESOLUTION_HINTS[value]}</p>
        </div>
        <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted transition', open && 'rotate-180')} />
      </button>

      {open && (
        <div
          className="nodrag absolute left-0 right-0 top-[calc(100%+4px)] z-50 overflow-hidden rounded-lg border border-border bg-surface shadow-lg"
          onPointerDown={e => e.stopPropagation()}
        >
          <ul className="py-1">
            {RESOLUTION_OPTIONS.map(option => {
              const active = option.value === value
              return (
                <li key={option.value}>
                  <button
                    type="button"
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
                    <span className="text-xs font-semibold tabular-nums">{option.value}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[11px] font-medium">{option.label}</span>
                      <span className="block text-[10px] text-muted">{RESOLUTION_HINTS[option.value]}</span>
                    </span>
                    {active && (
                      <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary-light" />
                    )}
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

type RatioPickerProps = {
  value: SeedanceVideoRatio
  onChange: (value: SeedanceVideoRatio) => void
  disabled?: boolean
}

export function RatioPicker({ value, onChange, disabled }: RatioPickerProps) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {RATIO_OPTIONS.map(option => {
        const active = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onPointerDown={e => e.stopPropagation()}
            onClick={() => onChange(option.value)}
            className={cn(
              'nodrag flex flex-col items-center gap-1 rounded-md border px-1 py-1.5 transition disabled:opacity-50',
              active
                ? 'border-primary-light bg-primary/10 text-primary-light ring-1 ring-primary-light/25'
                : 'border-border bg-input text-secondary hover:border-border hover:bg-surface-muted',
            )}
          >
            <div className="flex h-8 w-full items-center justify-center">
              <RatioPreview ratio={option.value} />
            </div>
            <span className="w-full truncate text-center text-[9px] font-medium leading-tight">
              {option.value === 'adaptive' ? '自适应' : option.value}
            </span>
          </button>
        )
      })}
    </div>
  )
}

type DurationSliderProps = {
  value: number
  onChange: (value: number) => void
  disabled?: boolean
}

export function DurationSlider({ value, onChange, disabled }: DurationSliderProps) {
  const isSmart = value === DURATION_SMART
  const clamped = Math.min(DURATION_MAX, Math.max(DURATION_MIN, value))

  const setFromSlider = useCallback((raw: number) => {
    onChange(Math.round(raw))
  }, [onChange])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          disabled={disabled}
          onPointerDown={e => e.stopPropagation()}
          onClick={() => onChange(isSmart ? DURATION_MIN : DURATION_SMART)}
          className={cn(
            'nodrag inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition disabled:opacity-50',
            isSmart
              ? 'border-primary-light bg-primary/10 text-primary-light'
              : 'border-border bg-input text-muted hover:bg-surface-muted',
          )}
        >
          <Sparkles className="h-3 w-3" />
          智能时长
        </button>
        <span className="text-xs font-medium tabular-nums text-foreground">
          {isSmart ? '自动' : `${clamped} 秒`}
        </span>
      </div>

      {isSmart
        ? (
            <p className="text-[10px] leading-relaxed text-muted">
              由模型根据提示词与素材自动决定视频长度
            </p>
          )
        : (
            <>
              <input
                type="range"
                min={DURATION_MIN}
                max={DURATION_MAX}
                step={1}
                value={clamped}
                disabled={disabled}
                onPointerDown={e => e.stopPropagation()}
                onChange={e => setFromSlider(Number(e.target.value))}
                className="nodrag nowheel h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary-light disabled:opacity-50 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-primary-light [&::-webkit-slider-thumb]:shadow-sm"
              />
              <div className="flex justify-between text-[10px] tabular-nums text-muted">
                <span>{DURATION_MIN}s</span>
                <span>{DURATION_MAX}s</span>
              </div>
            </>
          )}
    </div>
  )
}

type SeedanceVideoParamsProps = {
  resolution: SeedanceVideoResolution
  ratio: SeedanceVideoRatio
  duration: number
  onResolutionChange: (value: SeedanceVideoResolution) => void
  onRatioChange: (value: SeedanceVideoRatio) => void
  onDurationChange: (value: number) => void
  disabled?: boolean
}

export function SeedanceVideoParams({
  resolution,
  ratio,
  duration,
  onResolutionChange,
  onRatioChange,
  onDurationChange,
  disabled,
}: SeedanceVideoParamsProps) {
  return (
    <div className="space-y-2.5">
      <div>
        <FieldLabel>分辨率</FieldLabel>
        <ResolutionMenu
          value={resolution}
          onChange={onResolutionChange}
          disabled={disabled}
        />
      </div>
      <div>
        <FieldLabel>宽高比</FieldLabel>
        <RatioPicker
          value={ratio}
          onChange={onRatioChange}
          disabled={disabled}
        />
      </div>
      <div>
        <FieldLabel>时长</FieldLabel>
        <DurationSlider
          value={duration}
          onChange={onDurationChange}
          disabled={disabled}
        />
      </div>
    </div>
  )
}
