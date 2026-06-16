let flushSessionSave: ((sessionId: string, immediate?: boolean) => void) | null = null

export function registerWorkflowAutoSaveFlush(
  fn: ((sessionId: string, immediate?: boolean) => void) | null,
) {
  flushSessionSave = fn
}

export function flushWorkflowSessionSave(sessionId: string) {
  flushSessionSave?.(sessionId, true)
}

export function flushAllWorkflowSessionSaves(sessionIds: string[]) {
  for (const sessionId of sessionIds)
    flushSessionSave?.(sessionId, true)
}
