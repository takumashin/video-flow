'use client'

import { Handle, type HandleProps } from 'reactflow'
import { cn } from '@/lib/cn'

/** 连接点视觉尺寸与挂接位置（与 React Flow 坐标计算对齐，避免 transform 导致连线偏移） */
const HANDLE_SIZE = 18
const HANDLE_CENTER_Y = 22

type WorkflowNodeHandleProps = Pick<HandleProps, 'type' | 'position' | 'id'>

export default function WorkflowNodeHandle({ type, position, id }: WorkflowNodeHandleProps) {
  return (
    <Handle
      id={id}
      type={type}
      position={position}
      style={{
        top: HANDLE_CENTER_Y - HANDLE_SIZE / 2,
        width: HANDLE_SIZE,
        height: HANDLE_SIZE,
      }}
      className={cn(
        'workflow-node-handle',
        type === 'source' ? 'workflow-node-handle-source' : 'workflow-node-handle-target',
      )}
    />
  )
}
