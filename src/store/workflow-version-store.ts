import { create } from 'zustand'
import type { WorkflowBranch, WorkflowDiffResult, WorkflowVersionSummary } from '@/lib/types'
import {
  createWorkflowBranch,
  fetchBranches,
  fetchVersionDiff,
  fetchWorkflowVersions,
  restoreWorkflowVersion,
  saveNamedVersion,
} from '@/lib/workflow-version-api'

type WorkflowVersionStore = {
  // Panel/dialog state
  versionPanelOpen: boolean
  diffViewerOpen: boolean
  saveDialogOpen: boolean
  selectedForCompare: string | null
  activeBranch: string

  // Data cache
  versions: WorkflowVersionSummary[]
  branches: WorkflowBranch[]
  diffResult: WorkflowDiffResult | null
  versionsLoading: boolean
  diffLoading: boolean
  actionLoading: boolean
  error: string | null

  // Actions
  openVersionPanel: () => void
  closeVersionPanel: () => void
  openSaveDialog: () => void
  closeSaveDialog: () => void
  openDiffViewer: (versionA: string, versionB: string, workflowId: string) => Promise<void>
  closeDiffViewer: () => void
  selectForCompare: (versionId: string | null) => void
  setActiveBranch: (branch: string) => void

  loadVersions: (workflowId: string) => Promise<void>
  loadBranches: (workflowId: string) => Promise<void>
  loadDiff: (workflowId: string, v1: string, v2: string) => Promise<void>

  saveNamedVersion: (workflowId: string, label: string, description?: string) => Promise<void>
  restoreVersion: (workflowId: string, versionId: string) => Promise<boolean>
  createBranch: (workflowId: string, name: string, sourceVersionId: string) => Promise<void>

  clearError: () => void
  reset: () => void
}

export const useWorkflowVersionStore = create<WorkflowVersionStore>((set, get) => ({
  versionPanelOpen: false,
  diffViewerOpen: false,
  saveDialogOpen: false,
  selectedForCompare: null,
  activeBranch: 'main',

  versions: [],
  branches: [],
  diffResult: null,
  versionsLoading: false,
  diffLoading: false,
  actionLoading: false,
  error: null,

  openVersionPanel: () => set({ versionPanelOpen: true, selectedForCompare: null }),
  closeVersionPanel: () => set({ versionPanelOpen: false, selectedForCompare: null }),
  openSaveDialog: () => set({ saveDialogOpen: true }),
  closeSaveDialog: () => set({ saveDialogOpen: false }),

  openDiffViewer: async (versionA, versionB, workflowId) => {
    set({ diffViewerOpen: true, diffLoading: true, error: null })
    try {
      const diff = await fetchVersionDiff(workflowId, versionA, versionB)
      set({ diffResult: diff, diffLoading: false })
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '加载差异失败',
        diffLoading: false,
      })
    }
  },
  closeDiffViewer: () => set({ diffViewerOpen: false, diffResult: null }),

  selectForCompare: versionId => set({ selectedForCompare: versionId }),

  setActiveBranch: branch => set({ activeBranch: branch }),

  loadVersions: async (workflowId) => {
    set({ versionsLoading: true, error: null })
    try {
      const branch = get().activeBranch
      const versions = await fetchWorkflowVersions(workflowId, { branch, limit: 20 })
      set({ versions, versionsLoading: false })
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '加载版本列表失败',
        versionsLoading: false,
      })
    }
  },

  loadBranches: async (workflowId) => {
    try {
      const branches = await fetchBranches(workflowId)
      set({ branches })
    }
    catch (_err) {
      // Branches are non-critical; silently fail
    }
  },

  loadDiff: async (workflowId, v1, v2) => {
    set({ diffLoading: true, error: null })
    try {
      const diff = await fetchVersionDiff(workflowId, v1, v2)
      set({ diffResult: diff, diffLoading: false })
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '加载差异失败',
        diffLoading: false,
      })
    }
  },

  saveNamedVersion: async (workflowId, label, description) => {
    set({ actionLoading: true, error: null })
    try {
      await saveNamedVersion(workflowId, label, description)
      // Reload versions after saving
      await get().loadVersions(workflowId)
      set({ actionLoading: false, saveDialogOpen: false })
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '保存版本失败',
        actionLoading: false,
      })
    }
  },

  restoreVersion: async (workflowId, versionId) => {
    set({ actionLoading: true, error: null })
    try {
      await restoreWorkflowVersion(workflowId, versionId)
      set({ actionLoading: false })
      return true
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '恢复版本失败',
        actionLoading: false,
      })
      return false
    }
  },

  createBranch: async (workflowId, name, sourceVersionId) => {
    set({ actionLoading: true, error: null })
    try {
      await createWorkflowBranch(workflowId, name, sourceVersionId)
      await get().loadBranches(workflowId)
      set({ actionLoading: false })
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '创建分支失败',
        actionLoading: false,
      })
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({
    versionPanelOpen: false,
    diffViewerOpen: false,
    saveDialogOpen: false,
    selectedForCompare: null,
    activeBranch: 'main',
    versions: [],
    branches: [],
    diffResult: null,
    error: null,
  }),
}))
