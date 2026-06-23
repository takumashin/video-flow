import { create } from 'zustand'

export type WorkflowAutoSaveStatus = 'idle' | 'pending' | 'saving' | 'saved' | 'error'

type WorkflowAutoSaveStore = {
  status: WorkflowAutoSaveStatus
  message: string | null
  lastSavedAt: number | null
  setSaveState: (patch: {
    status?: WorkflowAutoSaveStatus
    message?: string | null
    lastSavedAt?: number | null
  }) => void
}

export const useWorkflowAutoSaveStore = create<WorkflowAutoSaveStore>(set => ({
  status: 'idle',
  message: null,
  lastSavedAt: null,
  setSaveState: patch => set(state => ({ ...state, ...patch })),
}))
