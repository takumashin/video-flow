'use client'

import { useEffect, useRef, useState } from 'react'
import { Plus } from 'lucide-react'
import { btnSecondaryClass, dropdownClass } from '@/lib/ui-classes'
import { NodeType } from '@/lib/types'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'

const blocks = [
  { type: NodeType.TextPrompt, label: '文本提示词', desc: '描述你想生成的视频内容' },
  { type: NodeType.ImageInput, label: '参考图片', desc: '拖拽或点击上传，支持首尾帧 / 全能参考' },
  { type: NodeType.VideoInput, label: '参考视频', desc: '全能参考模式最多 3 个（MP4/WebM）' },
  { type: NodeType.AudioInput, label: '参考音频', desc: '全能参考模式最多 3 个（MP3/WAV）' },
  { type: NodeType.Seedance, label: 'Seedance 生成', desc: '调用火山引擎视频模型' },
  { type: NodeType.Output, label: '视频输出', desc: '预览与下载生成结果' },
]

export default function AddBlockPanel() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const addNode = useWorkflowStore(s => s.addNode)
  const isRunning = useActiveWorkflowSession()?.isRunning ?? false

  useEffect(() => {
    if (!open)
      return

    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node))
        setOpen(false)
    }

    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [open])

  return (
    <div ref={panelRef} className="relative">
      <button
        type="button"
        disabled={isRunning}
        onClick={() => setOpen(v => !v)}
        className={btnSecondaryClass}
      >
        <Plus className="h-4 w-4" />
        添加节点
      </button>

      {open && (
        <div className={`absolute left-0 top-full z-[110] mt-2 w-72 ${dropdownClass}`}>
          <div className="border-b border-border-subtle px-4 py-3">
            <p className="text-sm font-semibold text-foreground">节点库</p>
            <p className="text-xs text-muted">拖拽连接，构建 AI 视频生成流程</p>
          </div>
          <div className="p-2">
            {blocks.map(block => (
              <button
                key={block.type}
                type="button"
                onClick={() => {
                  addNode(block.type)
                  setOpen(false)
                }}
                className="flex w-full flex-col items-start rounded-lg px-3 py-2.5 text-left hover:bg-surface-muted"
              >
                <span className="text-sm font-medium text-foreground">{block.label}</span>
                <span className="text-xs text-muted">{block.desc}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
