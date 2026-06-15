'use client'

import { cn } from '@/lib/cn'
import { useImeSafeTextValue } from '@/lib/use-ime-safe-text'
import { inputClass } from '@/lib/ui-classes'
import { SEEDANCE_MODE_OPTIONS } from '@/lib/seedance-modes'
import type { ImageRole, SeedanceGenerationMode } from '@/lib/types'

export const IMAGE_ROLE_OPTIONS: Array<{ value: ImageRole; label: string }> = [
  { value: 'first_frame', label: '首帧' },
  { value: 'last_frame', label: '尾帧' },
  { value: 'reference_image', label: '全能参考' },
]

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-[11px] font-medium text-muted">{children}</label>
}

export function NodeTextInput({
  value,
  onChange,
  placeholder,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}) {
  const { bind } = useImeSafeTextValue(value, onChange)

  return (
    <input
      {...bind}
      placeholder={placeholder}
      disabled={disabled}
      className={inputClass}
    />
  )
}

export function NodeTextArea({
  value,
  onChange,
  placeholder,
  rows = 3,
  disabled,
}: {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  disabled?: boolean
}) {
  const { bind } = useImeSafeTextValue(value, onChange)

  return (
    <textarea
      {...bind}
      placeholder={placeholder}
      rows={rows}
      disabled={disabled}
      className={cn(inputClass, 'resize-none')}
    />
  )
}

export function NodeSelect<T extends string>({
  value,
  onChange,
  options,
  disabled,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  disabled?: boolean
}) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value as T)}
      disabled={disabled}
      className={cn(inputClass, 'nowheel')}
    >
      {options.map(option => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  )
}

export function NodeToggle({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string
  checked: boolean
  onChange: (checked: boolean) => void
  disabled?: boolean
}) {
  return (
    <label className="nodrag flex cursor-pointer items-center justify-between rounded-md border border-border bg-input px-2.5 py-1.5">
      <span className="text-xs text-foreground/90">{label}</span>
      <input
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        disabled={disabled}
        className="h-3.5 w-3.5 rounded border-border text-primary-light focus:ring-primary-light disabled:opacity-50"
      />
    </label>
  )
}

export function SeedanceModeSwitcher({
  value,
  onChange,
  disabled,
}: {
  value: SeedanceGenerationMode
  onChange: (mode: SeedanceGenerationMode) => void
  disabled?: boolean
}) {
  return (
    <div className="space-y-2">
      <FieldLabel>生成模式</FieldLabel>
      <div className="nodrag grid grid-cols-2 gap-1.5">
        {SEEDANCE_MODE_OPTIONS.map(option => (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'rounded-md border px-2 py-1.5 text-left transition disabled:opacity-50',
              value === option.value
                ? 'border-primary-light bg-primary/10 text-primary-light ring-1 ring-primary-light/25'
                : 'border-border bg-input text-secondary hover:border-border hover:bg-surface-muted',
            )}
          >
            <span className="text-xs font-medium">{option.label}</span>
          </button>
        ))}
      </div>
      <p className="text-[10px] leading-relaxed text-muted">
        {SEEDANCE_MODE_OPTIONS.find(o => o.value === value)?.description}
      </p>
    </div>
  )
}

export function TaskProgressBar({ progress, className }: { progress: number; className?: string }) {
  const value = Math.min(100, Math.max(0, progress))
  return (
    <div className={cn('space-y-1', className)}>
      <div className="flex items-center justify-between gap-2 text-[10px]">
        <span className="text-muted">生成进度</span>
        <span className="font-medium tabular-nums text-foreground">{value}%</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-surface-muted">
        <div
          className="task-progress-bar-fill h-full rounded-full transition-[width] duration-500 ease-out"
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  )
}

export function StatusBadge({
  status,
  error,
  taskId,
  progress,
}: {
  status: 'idle' | 'running' | 'succeeded' | 'failed'
  error?: string
  taskId?: string
  progress?: number
}) {
  const styles = {
    idle: 'bg-surface-muted text-secondary',
    running: 'bg-primary/15 text-primary-light',
    succeeded: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
    failed: 'bg-red-500/15 text-red-600 dark:text-red-400',
  }

  const progressValue = progress != null ? Math.min(100, Math.max(0, progress)) : null
  const showProgress = progressValue != null && (status === 'running' || (progressValue > 0 && progressValue < 100))

  const labels = {
    idle: '待运行',
    running: progressValue != null ? `生成中 ${progressValue}%` : '生成中...',
    succeeded: progressValue === 100 ? '已完成 100%' : '已完成',
    failed: '失败',
  }

  return (
    <div className="space-y-1.5">
      <span className={cn('inline-flex rounded-full px-2 py-0.5 text-[11px] font-medium', styles[status])}>
        {labels[status]}
      </span>
      {showProgress && progressValue != null && (
        <TaskProgressBar progress={progressValue} />
      )}
      {taskId && (
        <p className="break-all text-[10px] text-muted">
          任务 ID: {taskId}
        </p>
      )}
      {error && (
        <p className="rounded-md bg-red-500/10 p-2 text-[11px] text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  )
}
