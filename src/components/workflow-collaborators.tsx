'use client'

import { Users } from 'lucide-react'
import { CollaboratorBadge, useActiveWorkflowCollaborators } from '@/components/workflow-collaboration'

export default function WorkflowCollaborators() {
  const { workflowId, collaborators, wsConnected } = useActiveWorkflowCollaborators()

  if (!workflowId)
    return null

  const visible = collaborators.slice(0, 5)
  const overflow = collaborators.length - visible.length

  return (
    <div
      className={`flex items-center gap-1.5 rounded-lg border border-border bg-input px-2 py-1 text-xs text-muted ${wsConnected ? '' : 'opacity-60'}`}
      title={collaborators.length > 0
        ? `${collaborators.map(item => item.name).join('、')} 正在协作`
        : '当前仅你在此工作流中'}
    >
      <Users className="h-3.5 w-3.5 shrink-0" />
      {visible.length > 0
        ? (
            <>
              <div className="flex -space-x-1.5">
                {visible.map(item => (
                  <CollaboratorBadge
                    key={item.clientId}
                    name={item.name}
                    image={item.image}
                    color={item.color}
                    compact
                  />
                ))}
              </div>
              <span className="hidden sm:inline">
                {collaborators.length}
                人在线
              </span>
              {overflow > 0 && (
                <span className="text-[10px]">
                  +
                  {overflow}
                </span>
              )}
            </>
          )
        : (
            <span className="hidden sm:inline">仅你在线</span>
          )}
    </div>
  )
}
