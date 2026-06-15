'use client'

import { memo, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { getBezierPath, type EdgeProps } from 'reactflow'
import { cn } from '@/lib/cn'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'

/** 沿连线方向的五彩渐变，用于溜光描边 */
function RainbowFlowGradient({
  id,
  x1,
  y1,
  x2,
  y2,
}: {
  id: string
  x1: number
  y1: number
  x2: number
  y2: number
}) {
  return (
    <linearGradient
      id={id}
      gradientUnits="userSpaceOnUse"
      x1={x1}
      y1={y1}
      x2={x2}
      y2={y2}
    >
      <stop offset="0%" stopColor="#f472b6" stopOpacity={0} />
      <stop offset="18%" stopColor="#e879f9" stopOpacity={0.35} />
      <stop offset="38%" stopColor="#818cf8" stopOpacity={0.75} />
      <stop offset="58%" stopColor="#38bdf8" stopOpacity={0.95} />
      <stop offset="78%" stopColor="#34d399" stopOpacity={1} />
      <stop offset="100%" stopColor="#fde047" stopOpacity={1} />
    </linearGradient>
  )
}

function CustomEdge({
  id,
  source,
  target,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  selected,
}: EdgeProps) {
  const activeSession = useActiveWorkflowSession()
  const isRunning = activeSession?.isRunning ?? false
  const selectedNodeId = activeSession?.selectedNodeId ?? null

  const isLinkedToSelectedNode = selectedNodeId != null
    && (source === selectedNodeId || target === selectedNodeId)

  const isHighlighted = selected || isLinkedToSelectedNode
  const showFlow = isHighlighted || isRunning

  const [edgePath] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  })

  const pathRef = useRef<SVGPathElement>(null)
  const [pathLength, setPathLength] = useState(0)
  const gradientId = useMemo(() => `edge-flow-${id.replace(/[^a-zA-Z0-9_-]/g, '')}`, [id])

  useLayoutEffect(() => {
    if (pathRef.current)
      setPathLength(pathRef.current.getTotalLength())
  }, [edgePath])

  const cometDash = pathLength > 0 ? `${pathLength * 0.2}, 9999` : '72, 9999'

  return (
    <g className={cn(showFlow && 'workflow-edge-group-flow')}>
      <path
        d={edgePath}
        fill="none"
        stroke="transparent"
        strokeWidth={20}
        className="workflow-edge-hitarea"
      />
      <path
        ref={pathRef}
        d={edgePath}
        fill="none"
        strokeLinecap="round"
        className={cn(
          'workflow-edge-path',
          showFlow && 'workflow-edge-path-active',
        )}
        pointerEvents="none"
      />
      {showFlow && (
        <>
          <defs>
            <RainbowFlowGradient
              id={gradientId}
              x1={sourceX}
              y1={sourceY}
              x2={targetX}
              y2={targetY}
            />
          </defs>
          <path
            d={edgePath}
            fill="none"
            stroke={`url(#${gradientId})`}
            strokeWidth={2.5}
            strokeLinecap="round"
            className="workflow-edge-flow"
            style={{ strokeDasharray: cometDash }}
            pointerEvents="none"
          />
        </>
      )}
    </g>
  )
}

export default memo(CustomEdge)
