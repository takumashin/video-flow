import type {
  WorkflowBranch,
  WorkflowBranchStatus,
  WorkflowDiffResult,
  WorkflowVersionDetail,
  WorkflowVersionSummary,
} from './types'

// ---- Versions ----

export async function fetchWorkflowVersions(
  workflowId: string,
  options?: {
    branch?: string
    type?: string
    limit?: number
    offset?: number
  },
): Promise<WorkflowVersionSummary[]> {
  const params = new URLSearchParams()
  if (options?.branch) params.set('branch', options.branch)
  if (options?.type) params.set('type', options.type)
  if (options?.limit) params.set('limit', String(options.limit))
  if (options?.offset) params.set('offset', String(options.offset))

  const url = `/api/workflows/${workflowId}/versions${params.size > 0 ? `?${params.toString()}` : ''}`
  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '加载版本列表失败')
  }

  return data.versions as WorkflowVersionSummary[]
}

export async function fetchWorkflowVersion(
  workflowId: string,
  versionId: string,
): Promise<WorkflowVersionDetail> {
  const response = await fetch(`/api/workflows/${workflowId}/versions/${versionId}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '加载版本详情失败')
  }

  return data.version as WorkflowVersionDetail
}

export async function saveNamedVersion(
  workflowId: string,
  label: string,
  description?: string,
  branchName?: string,
): Promise<WorkflowVersionSummary> {
  const response = await fetch(`/api/workflows/${workflowId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ label, description, branchName }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '保存版本失败')
  }

  return data.version as WorkflowVersionSummary
}

export async function restoreWorkflowVersion(
  workflowId: string,
  versionId: string,
) {
  const response = await fetch(`/api/workflows/${workflowId}/versions/restore`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ versionId }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '恢复版本失败')
  }

  return data.workflow as {
    id: string
    name: string
    nodes: unknown[]
    edges: unknown[]
    revision: number
    updatedAt: number
  }
}

export async function fetchVersionDiff(
  workflowId: string,
  versionIdA: string,
  versionIdB: string,
): Promise<WorkflowDiffResult> {
  const params = new URLSearchParams({ v1: versionIdA, v2: versionIdB })
  const response = await fetch(`/api/workflows/${workflowId}/versions/diff?${params.toString()}`)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '加载版本差异失败')
  }

  return data.diff as WorkflowDiffResult
}

// ---- Branches ----

export async function fetchBranches(
  workflowId: string,
  options?: { status?: WorkflowBranchStatus | 'all'; mine?: boolean },
): Promise<WorkflowBranch[]> {
  const params = new URLSearchParams()
  if (options?.status && options.status !== 'all') params.set('status', options.status)
  if (options?.mine) params.set('mine', 'true')

  const url = `/api/workflows/${workflowId}/branches${params.size > 0 ? `?${params.toString()}` : ''}`
  const response = await fetch(url)
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '加载分支列表失败')
  }

  return data.branches as WorkflowBranch[]
}

export async function createWorkflowBranch(
  workflowId: string,
  name: string,
  options?: { description?: string; sourceVersionId?: string },
): Promise<WorkflowBranch> {
  const response = await fetch(`/api/workflows/${workflowId}/branches`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, ...options }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '创建分支失败')
  }

  return data.branch as WorkflowBranch
}

export async function checkoutWorkflowBranch(
  workflowId: string,
  targetBranch: string,
  fromBranch: string,
  currentState: {
    name: string
    nodes: unknown[]
    edges: unknown[]
    revision: number
  },
): Promise<{
  id: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  revision: number
  branchName: string
  branchRevision: number
}> {
  const response = await fetch(`/api/workflows/${workflowId}/branches/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      targetBranch,
      fromBranch,
      ...currentState,
    }),
  })

  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '切换分支失败')
  }

  return data.workflow
}

export async function mergeWorkflowBranch(
  workflowId: string,
  branchName: string,
): Promise<{
  workflow: {
    id: string
    name: string
    nodes: unknown[]
    edges: unknown[]
    revision: number
  }
}> {
  const response = await fetch(
    `/api/workflows/${workflowId}/branches/${encodeURIComponent(branchName)}/merge`,
    { method: 'POST' },
  )
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '合并分支失败')
  }

  return data
}

export async function archiveWorkflowBranch(
  workflowId: string,
  branchName: string,
): Promise<void> {
  const response = await fetch(
    `/api/workflows/${workflowId}/branches/${encodeURIComponent(branchName)}/archive`,
    { method: 'POST' },
  )
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '归档分支失败')
  }
}

export async function restoreWorkflowBranch(
  workflowId: string,
  branchName: string,
): Promise<void> {
  const response = await fetch(
    `/api/workflows/${workflowId}/branches/${encodeURIComponent(branchName)}/restore`,
    { method: 'POST' },
  )
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '恢复分支失败')
  }
}

export async function renameWorkflowBranch(
  workflowId: string,
  oldName: string,
  newName: string,
): Promise<void> {
  const response = await fetch(
    `/api/workflows/${workflowId}/branches/${encodeURIComponent(oldName)}`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newName }),
    },
  )
  const data = await response.json()

  if (!response.ok) {
    throw new Error(typeof data.error === 'string' ? data.error : '重命名分支失败')
  }
}
