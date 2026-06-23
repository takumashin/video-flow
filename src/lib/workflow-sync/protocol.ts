import type { WorkflowEdge, WorkflowNode } from '@/lib/types'

export type WorkflowCollaborator = {
  clientId: string
  userId: string
  name: string
  image: string | null
  color: string
  workflowId: string | null
}

export type WorkflowRemoteSnapshot = {
  workflowId: string
  revision: number
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  updatedAt: number
  sender: Pick<WorkflowCollaborator, 'clientId' | 'userId' | 'name' | 'image'>
}

export type WorkflowSyncClientMessage =
  | { type: 'auth', token: string }
  | { type: 'join', workflowId: string }
  | { type: 'leave', workflowId: string }
  | { type: 'sync', workflowId: string, revision: number | null, name: string, nodes: WorkflowNode[], edges: WorkflowEdge[], updatedAt: number }
  | { type: 'ping' }

export type WorkflowSyncServerMessage =
  | { type: 'ready' }
  | { type: 'auth_ok', clientId: string }
  | { type: 'auth_error', message: string }
  | { type: 'joined', workflowId: string, collaborators: WorkflowCollaborator[] }
  | { type: 'left', workflowId: string }
  | { type: 'presence', workflowId: string, collaborators: WorkflowCollaborator[] }
  | { type: 'sync', snapshot: WorkflowRemoteSnapshot }
  | { type: 'saved', workflowId: string, revision: number, updatedAt: number, sender: WorkflowRemoteSnapshot['sender'] }
  | { type: 'error', message: string }
  | { type: 'pong' }

export const COLLABORATOR_COLORS = [
  '#f97316',
  '#22c55e',
  '#3b82f6',
  '#a855f7',
  '#ec4899',
  '#14b8a6',
  '#eab308',
  '#ef4444',
] as const

export function pickCollaboratorColor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++)
    hash = (hash + seed.charCodeAt(i) * (i + 1)) % COLLABORATOR_COLORS.length
  return COLLABORATOR_COLORS[hash] ?? COLLABORATOR_COLORS[0]
}
