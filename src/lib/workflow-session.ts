import { v4 as uuidv4 } from 'uuid'
import type { RunLogEntry, WorkflowEdge, WorkflowNode } from './types'
import { NodeType } from './types'

export type WorkflowSession = {
  id: string
  workflowId: string | null
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  revision: number | null
  isRunning: boolean
  runLogs: RunLogEntry[]
  selectedNodeId: string | null
  videoHistoryModalNodeId: string | null
  runLogPanelOpen: boolean
}

export const DEFAULT_WORKFLOW_NODES: WorkflowNode[] = [
  {
    id: 'seedance-1',
    type: 'custom',
    position: { x: 280, y: 200 },
    data: {
      type: NodeType.Seedance,
      title: 'Seedance 生成',
      prompt: '无人机以极快速度穿越复杂障碍，带来沉浸式飞行体验',
      generationMode: 'text_to_video',
      model: 'doubao-seedance-1-5-pro-251215',
      resolution: '720p',
      ratio: '16:9',
      duration: 5,
      seed: -1,
      generateAudio: false,
      watermark: false,
      cameraFixed: false,
      status: 'idle',
      videoHistory: [],
    },
  },
]

export const DEFAULT_WORKFLOW_EDGES: WorkflowEdge[] = []

export function createWorkflowSession(options?: {
  name?: string
  workflowId?: string | null
  nodes?: WorkflowNode[]
  edges?: WorkflowEdge[]
  revision?: number | null
}): WorkflowSession {
  return {
    id: uuidv4(),
    workflowId: options?.workflowId ?? null,
    name: options?.name ?? '未命名工作流',
    nodes: structuredClone(options?.nodes ?? DEFAULT_WORKFLOW_NODES),
    edges: structuredClone(options?.edges ?? DEFAULT_WORKFLOW_EDGES),
    revision: options?.revision ?? null,
    isRunning: false,
    runLogs: [],
    selectedNodeId: null,
    videoHistoryModalNodeId: null,
    runLogPanelOpen: false,
  }
}

export function patchWorkflowSession(
  sessions: WorkflowSession[],
  sessionId: string,
  updater: (session: WorkflowSession) => WorkflowSession,
): WorkflowSession[] {
  return sessions.map(session =>
    session.id === sessionId ? updater(session) : session,
  )
}
