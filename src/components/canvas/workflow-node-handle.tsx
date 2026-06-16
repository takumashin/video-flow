'use client'

import { Handle, type HandleProps } from 'reactflow'
import { cn } from '@/lib/cn'

/** 与节点标题栏垂直居中对齐，便于连线挂接 */
const HANDLE_TOP = 22

type WorkflowNodeHandleProps = Pick<HandleProps, 'type' | 'position' | 'id'>

export default function WorkflowNodeHandle({ type, position, id }: WorkflowNodeHandleProps) {
  return (
    <Handle
      id={id}
      type={type}
      position={position}
      style={{ top: HANDLE_TOP }}
      className={cn(
        'workflow-node-handle',
        type === 'source' ? 'workflow-node-handle-source' : 'workflow-node-handle-target',
      )}
    />
  )
}
