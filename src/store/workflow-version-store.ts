import { create } from 'zustand'
import type { WorkflowBranch, WorkflowBranchStatus, WorkflowDiffResult, WorkflowEdge, WorkflowNode, WorkflowVersionSummary } from '@/lib/types'
import {
  archiveWorkflowBranch,
  checkoutWorkflowBranch,
  createWorkflowBranch,
  fetchBranches,
  fetchVersionDiff,
  fetchWorkflowVersions,
  mergeWorkflowBranch,
  renameWorkflowBranch,
  restoreWorkflowBranch,
  restoreWorkflowVersion,
  saveNamedVersion,
} from '@/lib/workflow-version-api'

type WorkflowVersionStore = {
  versionPanelOpen: boolean
  branchesModalOpen: boolean
  mergeModalOpen: boolean
  mergeTargetBranch: string | null
  diffViewerOpen: boolean
  saveDialogOpen: boolean
  selectedForCompare: string | null
  activeBranch: string
  branchTab: 'active' | 'mine' | 'archived'

  versions: WorkflowVersionSummary[]
  branches: WorkflowBranch[]
  diffResult: WorkflowDiffResult | null
  versionsLoading: boolean
  diffLoading: boolean
  actionLoading: boolean
  error: string | null

  openVersionPanel: () => void
  closeVersionPanel: () => void
  openBranchesModal: () => void
  closeBranchesModal: () => void
  openMergeModal: (branchName: string) => void
  closeMergeModal: () => void
  openSaveDialog: () => void
  closeSaveDialog: () => void
  openDiffViewer: (versionA: string, versionB: string, workflowId: string) => Promise<void>
  closeDiffViewer: () => void
  selectForCompare: (versionId: string | null) => void
  setActiveBranch: (branch: string) => void
  setBranchTab: (tab: 'active' | 'mine' | 'archived') => void

  loadVersions: (workflowId: string) => Promise<void>
  loadBranches: (workflowId: string, options?: { status?: WorkflowBranchStatus | 'all'; mine?: boolean }) => Promise<void>
  loadDiff: (workflowId: string, v1: string, v2: string) => Promise<void>

  saveNamedVersion: (workflowId: string, label: string, description?: string) => Promise<void>
  restoreVersion: (workflowId: string, versionId: string) => Promise<boolean>
  createBranch: (workflowId: string, name: string, description?: string, sourceVersionId?: string) => Promise<WorkflowBranch | null>
  checkoutBranch: (
    workflowId: string,
    sessionId: string,
    targetBranch: string,
    currentState: { name: string; nodes: unknown[]; edges: unknown[]; revision: number },
  ) => Promise<boolean>
  mergeBranch: (workflowId: string, sessionId: string, branchName: string) => Promise<boolean>
  archiveBranch: (workflowId: string, branchName: string) => Promise<boolean>
  restoreBranch: (workflowId: string, branchName: string) => Promise<boolean>
  renameBranch: (workflowId: string, oldName: string, newName: string) => Promise<boolean>

  resetForWorkflow: (workflowId: string | null) => void
  clearError: () => void
  reset: () => void
}

export const useWorkflowVersionStore = create<WorkflowVersionStore>((set, get) => ({
  versionPanelOpen: false,
  branchesModalOpen: false,
  mergeModalOpen: false,
  mergeTargetBranch: null,
  diffViewerOpen: false,
  saveDialogOpen: false,
  selectedForCompare: null,
  activeBranch: 'main',
  branchTab: 'active',

  versions: [],
  branches: [],
  diffResult: null,
  versionsLoading: false,
  diffLoading: false,
  actionLoading: false,
  error: null,

  openVersionPanel: () => set({ versionPanelOpen: true, selectedForCompare: null }),
  closeVersionPanel: () => set({ versionPanelOpen: false, selectedForCompare: null }),
  openBranchesModal: () => set({ branchesModalOpen: true, error: null }),
  closeBranchesModal: () => set({ branchesModalOpen: false }),
  openMergeModal: branchName => set({ mergeModalOpen: true, mergeTargetBranch: branchName, error: null }),
  closeMergeModal: () => set({ mergeModalOpen: false, mergeTargetBranch: null }),
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
  setBranchTab: tab => set({ branchTab: tab }),

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

  loadBranches: async (workflowId, options) => {
    set({ error: null })
    try {
      const branches = await fetchBranches(workflowId, options)
      set({ branches })
    }
    catch (err) {
      set({ error: err instanceof Error ? err.message : '加载分支列表失败' })
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
      await saveNamedVersion(workflowId, label, description, get().activeBranch)
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

  createBranch: async (workflowId, name, description, sourceVersionId) => {
    set({ actionLoading: true, error: null })
    try {
      const branch = await createWorkflowBranch(workflowId, name, { description, sourceVersionId })
      await get().loadBranches(workflowId)
      set({ actionLoading: false })
      return branch
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '创建分支失败',
        actionLoading: false,
      })
      return null
    }
  },

  checkoutBranch: async (workflowId, sessionId, targetBranch, currentState) => {
    const fromBranch = get().activeBranch
    if (fromBranch === targetBranch)
      return true

    set({ actionLoading: true, error: null })
    try {
      const result = await checkoutWorkflowBranch(
        workflowId,
        targetBranch,
        fromBranch,
        currentState,
      )

      const { useWorkflowStore } = await import('@/store/workflow-store')
      useWorkflowStore.getState().applyWorkflow({
        id: result.id,
        name: result.name,
        nodes: result.nodes as WorkflowNode[],
        edges: result.edges as WorkflowEdge[],
        revision: result.revision,
      }, { newTab: false, branchName: result.branchName })

      set({ activeBranch: targetBranch, actionLoading: false })
      return true
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '切换分支失败',
        actionLoading: false,
      })
      return false
    }
  },

  mergeBranch: async (workflowId, sessionId, branchName) => {
    set({ actionLoading: true, error: null })
    try {
      const result = await mergeWorkflowBranch(workflowId, branchName)
      const { useWorkflowStore } = await import('@/store/workflow-store')
      useWorkflowStore.getState().applyWorkflow({
        id: result.workflow.id,
        name: result.workflow.name,
        nodes: result.workflow.nodes as WorkflowNode[],
        edges: result.workflow.edges as WorkflowEdge[],
        revision: result.workflow.revision,
      }, { newTab: false, branchName: 'main' })

      set({
        activeBranch: 'main',
        actionLoading: false,
        mergeModalOpen: false,
        mergeTargetBranch: null,
      })
      await get().loadBranches(workflowId)
      return true
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '合并分支失败',
        actionLoading: false,
      })
      return false
    }
  },

  archiveBranch: async (workflowId, branchName) => {
    set({ actionLoading: true, error: null })
    try {
      await archiveWorkflowBranch(workflowId, branchName)
      await get().loadBranches(workflowId)
      set({ actionLoading: false })
      return true
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '归档分支失败',
        actionLoading: false,
      })
      return false
    }
  },

  restoreBranch: async (workflowId, branchName) => {
    set({ actionLoading: true, error: null })
    try {
      await restoreWorkflowBranch(workflowId, branchName)
      await get().loadBranches(workflowId)
      set({ actionLoading: false })
      return true
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '恢复分支失败',
        actionLoading: false,
      })
      return false
    }
  },

  renameBranch: async (workflowId, oldName, newName) => {
    set({ actionLoading: true, error: null })
    try {
      await renameWorkflowBranch(workflowId, oldName, newName)
      if (get().activeBranch === oldName)
        set({ activeBranch: newName })
      await get().loadBranches(workflowId)
      set({ actionLoading: false })
      return true
    }
    catch (err) {
      set({
        error: err instanceof Error ? err.message : '重命名分支失败',
        actionLoading: false,
      })
      return false
    }
  },

  resetForWorkflow: () => {
    set({
      activeBranch: 'main',
      branchTab: 'active',
      versions: [],
      branches: [],
      selectedForCompare: null,
      error: null,
    })
  },

  clearError: () => set({ error: null }),
  reset: () => set({
    versionPanelOpen: false,
    branchesModalOpen: false,
    mergeModalOpen: false,
    mergeTargetBranch: null,
    diffViewerOpen: false,
    saveDialogOpen: false,
    selectedForCompare: null,
    activeBranch: 'main',
    branchTab: 'active',
    versions: [],
    branches: [],
    diffResult: null,
    error: null,
  }),
}))
