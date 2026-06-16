import type { SavedWorkflow } from './types'

export class WorkflowRevisionConflictError extends Error {
  readonly serverWorkflow: SavedWorkflow

  constructor(serverWorkflow: SavedWorkflow) {
    super('工作流已被其他协作者更新，请处理冲突后再保存')
    this.name = 'WorkflowRevisionConflictError'
    this.serverWorkflow = serverWorkflow
  }
}

export type WorkflowUpdateResult =
  | { ok: true, workflow: SavedWorkflow }
  | { ok: false, conflict: true, workflow: SavedWorkflow }
