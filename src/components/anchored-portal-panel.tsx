'use client'

import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/cn'

type AnchoredPortalPanelProps = {
  open: boolean
  onClose: () => void
  trigger: ReactNode
  children: ReactNode
  className?: string
  panelClassName?: string
  placement?: 'top-start' | 'bottom-start'
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max)
}

export default function AnchoredPortalPanel({
  open,
  onClose,
  trigger,
  children,
  className,
  panelClassName,
  placement = 'top-start',
}: AnchoredPortalPanelProps) {
  const triggerRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const [panelStyle, setPanelStyle] = useState<CSSProperties>({ visibility: 'hidden' })

  const updatePosition = () => {
    const triggerEl = triggerRef.current
    const panelEl = panelRef.current
    if (!triggerEl || !panelEl)
      return

    const triggerRect = triggerEl.getBoundingClientRect()
    const panelRect = panelEl.getBoundingClientRect()
    const gap = 6
    const padding = 8

    let top = placement === 'top-start'
      ? triggerRect.top - gap - panelRect.height
      : triggerRect.bottom + gap

    if (placement === 'top-start' && top < padding)
      top = triggerRect.bottom + gap

    top = clamp(top, padding, window.innerHeight - panelRect.height - padding)

    const left = clamp(
      triggerRect.left,
      padding,
      window.innerWidth - panelRect.width - padding,
    )

    setPanelStyle({
      position: 'fixed',
      top,
      left,
      zIndex: 250,
      visibility: 'visible',
    })
  }

  useLayoutEffect(() => {
    if (!open)
      return

    setPanelStyle({ visibility: 'hidden' })
    updatePosition()
    const frame = window.requestAnimationFrame(updatePosition)
    return () => window.cancelAnimationFrame(frame)
  }, [open, placement])

  useEffect(() => {
    if (!open)
      return

    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (triggerRef.current?.contains(target) || panelRef.current?.contains(target))
        return
      onClose()
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape')
        onClose()
    }

    const onReposition = () => updatePosition()

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
  }, [open, onClose])

  return (
    <div ref={triggerRef} className={cn('relative', className)}>
      {trigger}
      {open && typeof document !== 'undefined' && createPortal(
        <div
          ref={panelRef}
          style={panelStyle}
          className={cn(
            'nodrag max-h-[min(70vh,520px)] overflow-y-auto rounded-xl border border-border bg-surface shadow-xl',
            panelClassName,
          )}
          onPointerDown={e => e.stopPropagation()}
        >
          {children}
        </div>,
        document.body,
      )}
    </div>
  )
}
