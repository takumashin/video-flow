'use client'

import { useCallback, useRef } from 'react'
import { Handle, type HandleProps } from 'reactflow'
import { cn } from '@/lib/cn'

/** 连接点视觉尺寸与挂接位置（与 React Flow 坐标计算对齐，避免 transform 导致连线偏移） */
const HANDLE_SIZE = 18
const HANDLE_CENTER_Y = 22
const MAGNET_STRENGTH = 0.45
const MAGNET_MAX_OFFSET = 7

function clampMagnetOffset(dx: number, dy: number) {
  const dist = Math.hypot(dx, dy)
  if (dist <= MAGNET_MAX_OFFSET || dist === 0) return { x: dx, y: dy }
  const scale = MAGNET_MAX_OFFSET / dist
  return { x: dx * scale, y: dy * scale }
}

type WorkflowNodeHandleProps = Pick<HandleProps, 'type' | 'position' | 'id'> & {
  centerY?: number
}

export default function WorkflowNodeHandle({ type, position, id, centerY = HANDLE_CENTER_Y }: WorkflowNodeHandleProps) {
  const visualRef = useRef<HTMLDivElement>(null)

  const resetVisual = useCallback(() => {
    const el = visualRef.current
    if (!el) return
    el.style.transition = 'transform 0.3s cubic-bezier(0.34, 1.2, 0.64, 1)'
    el.style.transform = 'translate(0px, 0px) scale(1)'
  }, [])

  const handleMouseMove = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const el = visualRef.current
    if (!el) return

    const rect = event.currentTarget.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const { x, y } = clampMagnetOffset(
      (event.clientX - cx) * MAGNET_STRENGTH,
      (event.clientY - cy) * MAGNET_STRENGTH,
    )

    el.style.transition = 'transform 0.06s ease-out'
    el.style.transform = `translate(${x.toFixed(2)}px, ${y.toFixed(2)}px) scale(1.1)`
  }, [])

  const handleMouseLeave = useCallback(() => {
    resetVisual()
  }, [resetVisual])

  const handleMouseDown = useCallback(() => {
    resetVisual()
  }, [resetVisual])

  return (
    <Handle
      id={id}
      type={type}
      position={position}
      style={{
        top: centerY - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
        zIndex: 30,
      }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      className={cn(
        'workflow-node-handle flex items-center justify-center !border-0 !bg-transparent !shadow-none',
        type === 'source' ? 'workflow-node-handle-source' : 'workflow-node-handle-target',
      )}
    >
      <div ref={visualRef} className="workflow-node-handle-visual" aria-hidden>
        <svg width="10" height="10" viewBox="0 0 10 10" fill="none" className="opacity-90">
          <line x1="5" y1="1.5" x2="5" y2="8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          <line x1="1.5" y1="5" x2="8.5" y2="5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
    </Handle>
  )
}
