const controllers = new Map<string, AbortController>()
const inflight = new Set<string>()

export function getSeedanceJobKey(sessionId: string, nodeId: string) {
  return `${sessionId}:${nodeId}`
}

export function beginSeedanceJob(sessionId: string, nodeId: string): AbortSignal {
  const key = getSeedanceJobKey(sessionId, nodeId)
  controllers.get(key)?.abort()
  const controller = new AbortController()
  controllers.set(key, controller)
  inflight.add(key)
  return controller.signal
}

export function endSeedanceJob(sessionId: string, nodeId: string) {
  const key = getSeedanceJobKey(sessionId, nodeId)
  controllers.delete(key)
  inflight.delete(key)
}

export function abortSeedanceJob(sessionId: string, nodeId: string) {
  const key = getSeedanceJobKey(sessionId, nodeId)
  controllers.get(key)?.abort()
  controllers.delete(key)
  inflight.delete(key)
}

export function isSeedanceJobInflight(sessionId: string, nodeId: string) {
  return inflight.has(getSeedanceJobKey(sessionId, nodeId))
}

export function isAbortError(error: unknown): error is DOMException {
  return error instanceof DOMException && error.name === 'AbortError'
}
