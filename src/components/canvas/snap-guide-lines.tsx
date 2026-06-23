'use client'

import { Panel, useStore } from 'reactflow'
import type { SnapGuide } from '@/lib/node-snap'

const transformSelector = (state: { transform: [number, number, number] }) => state.transform

const LINE_EXTENT = 100000

export default function SnapGuideLines({ guides }: { guides: SnapGuide[] }) {
  const transform = useStore(transformSelector)
  const [tx, ty, zoom] = transform

  if (guides.length === 0)
    return null

  return (
    <Panel
      position="top-left"
      className="!pointer-events-none !m-0 !p-0"
      style={{ width: '100%', height: '100%', pointerEvents: 'none' }}
    >
      <svg
        className="pointer-events-none h-full w-full overflow-visible"
        aria-hidden
      >
        <g transform={`translate(${tx},${ty}) scale(${zoom})`}>
          {guides.map((guide, index) =>
            guide.orientation === 'vertical'
              ? (
                  <line
                    key={index}
                    x1={guide.position}
                    y1={-LINE_EXTENT}
                    x2={guide.position}
                    y2={LINE_EXTENT}
                    stroke="var(--color-primary-light, #528BFF)"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  />
                )
              : (
                  <line
                    key={index}
                    x1={-LINE_EXTENT}
                    y1={guide.position}
                    x2={LINE_EXTENT}
                    y2={guide.position}
                    stroke="var(--color-primary-light, #528BFF)"
                    strokeWidth={1 / zoom}
                    strokeDasharray={`${6 / zoom} ${4 / zoom}`}
                  />
                ),
          )}
        </g>
      </svg>
    </Panel>
  )
}
