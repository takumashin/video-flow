'use client'

import { memo } from 'react'
import { MiniMap, Panel, useReactFlow } from 'reactflow'
import { Maximize2, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { CANVAS_FIT_VIEW_OPTIONS } from '@/lib/canvas-viewport'
import { useThemeStore } from '@/store/theme-store'

function ZoomInOut() {
  const { zoomIn, zoomOut, fitView } = useReactFlow()

  return (
    <div className="flex items-center gap-1 rounded-lg border border-border bg-surface p-1 shadow-sm">
      <button
        type="button"
        onClick={() => zoomOut({ duration: 200 })}
        className="rounded-md p-1.5 text-secondary hover:bg-surface-muted"
        aria-label="缩小"
      >
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => fitView({ duration: 300, ...CANVAS_FIT_VIEW_OPTIONS })}
        className="rounded-md p-1.5 text-secondary hover:bg-surface-muted"
        aria-label="适应画布"
      >
        <Maximize2 className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => zoomIn({ duration: 200 })}
        className="rounded-md p-1.5 text-secondary hover:bg-surface-muted"
        aria-label="放大"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  )
}

function CanvasOperator() {
  const resolvedTheme = useThemeStore(s => s.resolvedTheme)
  const isDark = resolvedTheme === 'dark'

  return (
    <Panel
      position="bottom-right"
      className="!m-3 flex flex-col items-end gap-2"
    >
      <ZoomInOut />
      <MiniMap
        pannable
        zoomable
        style={{ width: 102, height: 72 }}
        className={cn(
          'canvas-operator-minimap overflow-hidden rounded-lg border border-border shadow-md',
          '!m-0',
        )}
        maskColor={isDark ? 'rgba(10, 12, 16, 0.78)' : 'rgba(240, 244, 248, 0.72)'}
        nodeColor={isDark ? '#60a5fa' : '#528BFF'}
      />
    </Panel>
  )
}

export default memo(CanvasOperator)
