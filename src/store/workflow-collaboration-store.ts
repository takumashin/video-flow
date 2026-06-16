import { create } from 'zustand'
import type { WorkflowCollaborator, WorkflowRemoteSnapshot } from '@/lib/workflow-sync/protocol'

export const EMPTY_COLLABORATORS: WorkflowCollaborator[] = []

export type WorkflowConflictState = {
  workflowId: string
  sessionId: string
  remote: WorkflowRemoteSnapshot
  reason: 'remote_edit' | 'save_conflict'
  serverWorkflow?: WorkflowRemoteSnapshot
}

type WorkflowCollaborationStore = {
  clientId: string | null
  wsConnected: boolean
  hasConnectedOnce: boolean
  wsError: string | null
  collaboratorsByWorkflow: Record<string, WorkflowCollaborator[]>
  pendingLocalEditsByWorkflow: Record<string, boolean>
  conflict: WorkflowConflictState | null
  isApplyingRemote: boolean
  setClientId: (clientId: string | null) => void
  setWsConnected: (connected: boolean) => void
  setWsError: (error: string | null) => void
  setCollaborators: (workflowId: string, collaborators: WorkflowCollaborator[]) => void
  markLocalEdits: (workflowId: string, dirty: boolean) => void
  setConflict: (conflict: WorkflowConflictState | null) => void
  setApplyingRemote: (value: boolean) => void
  clearWorkflow: (workflowId: string) => void
}

export const useWorkflowCollaborationStore = create<WorkflowCollaborationStore>((set) => ({
  clientId: null,
  wsConnected: false,
  hasConnectedOnce: false,
  wsError: null,
  collaboratorsByWorkflow: {},
  pendingLocalEditsByWorkflow: {},
  conflict: null,
  isApplyingRemote: false,
  setClientId: clientId => set({ clientId }),
  setWsConnected: wsConnected => set(state => ({
    wsConnected,
    hasConnectedOnce: state.hasConnectedOnce || wsConnected,
  })),
  setWsError: wsError => set({ wsError }),
  setCollaborators: (workflowId, collaborators) => set(state => {
    const current = state.collaboratorsByWorkflow[workflowId]
    if (current === collaborators)
      return state
    if (current && current.length === collaborators.length) {
      const same = current.every((item, index) => {
        const next = collaborators[index]
        return next
          && item.clientId === next.clientId
          && item.userId === next.userId
          && item.name === next.name
      })
      if (same)
        return state
    }
    return {
      collaboratorsByWorkflow: {
        ...state.collaboratorsByWorkflow,
        [workflowId]: collaborators,
      },
    }
  }),
  markLocalEdits: (workflowId, dirty) => set(state => ({
    pendingLocalEditsByWorkflow: {
      ...state.pendingLocalEditsByWorkflow,
      [workflowId]: dirty,
    },
  })),
  setConflict: conflict => set({ conflict }),
  setApplyingRemote: isApplyingRemote => set({ isApplyingRemote }),
  clearWorkflow: workflowId => set((state) => {
    const collaboratorsByWorkflow = { ...state.collaboratorsByWorkflow }
    const pendingLocalEditsByWorkflow = { ...state.pendingLocalEditsByWorkflow }
    delete collaboratorsByWorkflow[workflowId]
    delete pendingLocalEditsByWorkflow[workflowId]
    return {
      collaboratorsByWorkflow,
      pendingLocalEditsByWorkflow,
      conflict: state.conflict?.workflowId === workflowId ? null : state.conflict,
    }
  }),
}))

export function getActiveCollaborators(workflowId: string | null | undefined): WorkflowCollaborator[] {
  if (!workflowId)
    return EMPTY_COLLABORATORS
  return useWorkflowCollaborationStore.getState().collaboratorsByWorkflow[workflowId] ?? EMPTY_COLLABORATORS
}

export function hasPendingLocalEdits(workflowId: string | null | undefined): boolean {
  if (!workflowId)
    return false
  return !!useWorkflowCollaborationStore.getState().pendingLocalEditsByWorkflow[workflowId]
}
