'use client'

import { useEffect, useRef } from 'react'
import { saveWorkflowToServer } from '@/lib/save-workflow-api'
import type { WorkflowSession } from '@/lib/workflow-session'
import { useWorkflowAutoSaveStore } from '@/store/workflow-auto-save-store'
import { useWorkflowStore } from '@/store/workflow-store'

const DEBOUNCE_MS = 800

function sessionSnapshot(session: WorkflowSession) {
  return JSON.stringify({
    workflowId: session.workflowId,
    name: session.name,
    nodes: session.nodes,
    edges: session.edges,
  })
}

export default function WorkflowAutoSave() {
  const sessions = useWorkflowStore(s => s.sessions)
  const activeSessionId = useWorkflowStore(s => s.activeSessionId)
  const hydrated = useRef(false)
  const lastSnapshots = useRef(new Map<string, string>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const inflight = useRef(new Map<string, boolean>())
  const dirty = useRef(new Map<string, boolean>())

  useEffect(() => {
    const finish = () => {
      hydrated.current = true
      lastSnapshots.current = new Map(
        useWorkflowStore.getState().sessions.map(session => [
          session.id,
          sessionSnapshot(session),
        ]),
      )
    }

    if (useWorkflowStore.persist.hasHydrated())
      finish()
    else
      useWorkflowStore.persist.onFinishHydration(finish)
  }, [])

  useEffect(() => {
    if (!hydrated.current)
      return

    const setSaveState = useWorkflowAutoSaveStore.getState().setSaveState

    const flushSave = async (sessionId: string) => {
      if (inflight.current.get(sessionId)) {
        dirty.current.set(sessionId, true)
        return
      }

      if (!dirty.current.get(sessionId))
        return

      dirty.current.set(sessionId, false)

      const session = useWorkflowStore.getState().sessions.find(s => s.id === sessionId)
      if (!session)
        return

      inflight.current.set(sessionId, true)

      if (sessionId === activeSessionId)
        setSaveState({ status: 'saving', message: null })

      try {
        const result = await saveWorkflowToServer(session.workflowId, {
          name: session.name,
          nodes: session.nodes,
          edges: session.edges,
        })

        const store = useWorkflowStore.getState()
        store.setSessionWorkflowMeta(sessionId, result.id, result.name)

        lastSnapshots.current.set(sessionId, sessionSnapshot({
          ...session,
          workflowId: result.id,
          name: result.name,
        }))

        if (sessionId === activeSessionId)
          setSaveState({
            status: 'saved',
            message: null,
            lastSavedAt: Date.now(),
          })
      }
      catch (error) {
        dirty.current.set(sessionId, true)
        const message = error instanceof Error ? error.message : '自动保存失败'
        if (sessionId === activeSessionId)
          setSaveState({ status: 'error', message })
      }
      finally {
        inflight.current.set(sessionId, false)
        if (dirty.current.get(sessionId))
          flushSave(sessionId)
      }
    }

    const scheduleSave = (sessionId: string) => {
      dirty.current.set(sessionId, true)
      if (sessionId === activeSessionId)
        setSaveState({ status: 'pending', message: null })

      const existing = timers.current.get(sessionId)
      if (existing)
        clearTimeout(existing)

      timers.current.set(
        sessionId,
        setTimeout(() => {
          timers.current.delete(sessionId)
          flushSave(sessionId)
        }, DEBOUNCE_MS),
      )
    }

    for (const session of sessions) {
      const snapshot = sessionSnapshot(session)
      const previous = lastSnapshots.current.get(session.id)

      if (previous === undefined) {
        lastSnapshots.current.set(session.id, snapshot)
        scheduleSave(session.id)
        continue
      }

      if (previous !== snapshot)
        scheduleSave(session.id)
    }

    for (const sessionId of lastSnapshots.current.keys()) {
      if (!sessions.some(session => session.id === sessionId)) {
        lastSnapshots.current.delete(sessionId)
        const timer = timers.current.get(sessionId)
        if (timer)
          clearTimeout(timer)
        timers.current.delete(sessionId)
        dirty.current.delete(sessionId)
        inflight.current.delete(sessionId)
      }
    }
  }, [sessions, activeSessionId])

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values())
        clearTimeout(timer)
    }
  }, [])

  return null
}
