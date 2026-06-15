import fs from 'node:fs/promises'
import path from 'node:path'
import { v4 as uuidv4 } from 'uuid'
import type { SavedWorkflow, WorkflowEdge, WorkflowNode, WorkflowSummary } from './types'

const WORKFLOW_DIR = path.join(process.cwd(), 'data', 'workflows')
const WORKFLOW_ID_PATTERN = /^[a-f0-9-]{36}$/

export async function ensureWorkflowDir() {
  await fs.mkdir(WORKFLOW_DIR, { recursive: true })
}

function getWorkflowFilePath(id: string) {
  if (!WORKFLOW_ID_PATTERN.test(id))
    throw new Error('无效的工作流 ID')
  return path.join(WORKFLOW_DIR, `${id}.json`)
}

async function readWorkflowFile(id: string): Promise<SavedWorkflow | null> {
  try {
    const raw = await fs.readFile(getWorkflowFilePath(id), 'utf-8')
    return JSON.parse(raw) as SavedWorkflow
  }
  catch {
    return null
  }
}

async function writeWorkflowFile(workflow: SavedWorkflow) {
  await ensureWorkflowDir()
  await fs.writeFile(getWorkflowFilePath(workflow.id), JSON.stringify(workflow, null, 2), 'utf-8')
}

export async function listWorkflows(): Promise<WorkflowSummary[]> {
  await ensureWorkflowDir()
  const files = await fs.readdir(WORKFLOW_DIR)
  const workflows: WorkflowSummary[] = []

  for (const file of files) {
    if (!file.endsWith('.json'))
      continue
    const id = file.replace(/\.json$/, '')
    const workflow = await readWorkflowFile(id)
    if (!workflow)
      continue
    workflows.push({
      id: workflow.id,
      name: workflow.name,
      createdAt: workflow.createdAt,
      updatedAt: workflow.updatedAt,
    })
  }

  return workflows.sort((a, b) => b.updatedAt - a.updatedAt)
}

export async function getWorkflow(id: string): Promise<SavedWorkflow | null> {
  return readWorkflowFile(id)
}

export async function createWorkflow(
  name: string,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
): Promise<SavedWorkflow> {
  const now = Date.now()
  const workflow: SavedWorkflow = {
    id: uuidv4(),
    name: name.trim() || '未命名工作流',
    nodes,
    edges,
    createdAt: now,
    updatedAt: now,
  }
  await writeWorkflowFile(workflow)
  return workflow
}

export async function updateWorkflow(
  id: string,
  payload: {
    name?: string
    nodes?: WorkflowNode[]
    edges?: WorkflowEdge[]
  },
): Promise<SavedWorkflow | null> {
  const existing = await readWorkflowFile(id)
  if (!existing)
    return null

  const workflow: SavedWorkflow = {
    ...existing,
    name: payload.name?.trim() || existing.name,
    nodes: payload.nodes ?? existing.nodes,
    edges: payload.edges ?? existing.edges,
    updatedAt: Date.now(),
  }

  await writeWorkflowFile(workflow)
  return workflow
}

export async function deleteWorkflow(id: string): Promise<boolean> {
  try {
    await fs.unlink(getWorkflowFilePath(id))
    return true
  }
  catch {
    return false
  }
}
