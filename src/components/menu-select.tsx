'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { dropdownAnchorClass, dropdownClass } from '@/lib/ui-classes'

export type MenuSelectOption = {
  value: string
  label: string
}

type MenuSelectProps = {
  value: string
  options: MenuSelectOption[]
  onChange: (value: string) => void
  disabled?: boolean
  loading?: boolean
  placeholder?: string
  menuPlacement?: 'above' | 'below'
  className?: string
  'aria-label'?: string
}

export default function MenuSelect({
  value,
  options,
  onChange,
  disabled = false,
  loading = false,
  placeholder = '请选择',
  menuPlacement = 'below',
  className,
  'aria-label': ariaLabel,
}: MenuSelectProps) {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const listboxId = useId()
  const selected = options.find(option => option.value === value)
  const label = selected?.label ?? placeholder

  useEffect(() => {
    if (!open)
      return

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node))
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
    <div ref={panelRef} className={cn('relative', className)}>
      <button
        type="button"
        disabled={disabled || loading}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listboxId}
        onClick={() => setOpen(v => !v)}
        className={cn(
          'flex w-full items-center justify-between gap-2 rounded-md border border-border bg-input px-2 py-1.5 text-xs text-foreground transition',
          'hover:bg-surface-muted focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light/30',
          'disabled:cursor-not-allowed disabled:opacity-50',
          open && 'border-primary-light ring-1 ring-primary-light/30',
        )}
      >
        <span className="min-w-0 truncate text-left">{label}</span>
        {loading
          ? <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin text-muted" />
          : <ChevronDown className={cn('h-3.5 w-3.5 shrink-0 text-muted transition', open && 'rotate-180')} />}
      </button>

      {open && (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            dropdownAnchorClass(menuPlacement, 'left'),
            'z-[130] w-full min-w-[8rem]',
            dropdownClass,
          )}
        >
          <div className="max-h-48 overflow-y-auto p-1">
            {options.map(option => {
              const isSelected = option.value === value
              return (
                <button
                  key={option.value || '__empty__'}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs transition',
                    isSelected
                      ? 'bg-primary/10 text-primary-light'
                      : 'text-foreground hover:bg-surface-muted',
                  )}
                >
                  <Check className={cn('h-3.5 w-3.5 shrink-0', isSelected ? 'opacity-100' : 'opacity-0')} />
                  <span className="min-w-0 flex-1 truncate">{option.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
