'use client'

import { useCallback, useEffect, useRef } from 'react'
import { flushAllWorkflowSessionSaves, registerWorkflowAutoSaveFlush } from '@/lib/workflow-auto-save-control'
import { saveWorkflowToServer, WorkflowSaveConflictError, broadcastWorkflowSaved } from '@/lib/save-workflow-api'
import { rememberLastWorkflow } from '@/lib/workflow-last'
import type { WorkflowSession } from '@/lib/workflow-session'
import { useWorkflowAutoSaveStore } from '@/store/workflow-auto-save-store'
import { useWorkflowCollaborationStore } from '@/store/workflow-collaboration-store'
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
  const serverHydrated = useWorkflowStore(s => s.serverHydrated)
  const isApplyingRemote = useWorkflowCollaborationStore(s => s.isApplyingRemote)
  const setConflict = useWorkflowCollaborationStore(s => s.setConflict)
  const lastSnapshots = useRef(new Map<string, string>())
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>())
  const inflight = useRef(new Map<string, boolean>())
  const dirty = useRef(new Map<string, boolean>())
  const activeSessionIdRef = useRef(activeSessionId)

  useEffect(() => {
    activeSessionIdRef.current = activeSessionId
  }, [activeSessionId])

  useEffect(() => {
    if (!serverHydrated)
      return

    lastSnapshots.current = new Map(
      useWorkflowStore.getState().sessions.map(session => [
        session.id,
        sessionSnapshot(session),
      ]),
    )
  }, [serverHydrated])

  const reportSaveConflict = useCallback((
    session: WorkflowSession,
    serverWorkflow: Awaited<ReturnType<typeof saveWorkflowToServer>>,
  ) => {
    if (!session.workflowId)
      return

    setConflict({
      workflowId: session.workflowId,
      sessionId: session.id,
      reason: 'save_conflict',
      remote: {
        workflowId: session.workflowId,
        revision: serverWorkflow.revision,
        name: serverWorkflow.name,
        nodes: serverWorkflow.nodes,
        edges: serverWorkflow.edges,
        updatedAt: serverWorkflow.updatedAt,
        sender: {
          clientId: 'server',
          userId: 'server',
          name: '服务器版本',
          image: null,
        },
      },
      serverWorkflow: {
        workflowId: session.workflowId,
        revision: serverWorkflow.revision,
        name: serverWorkflow.name,
        nodes: serverWorkflow.nodes,
        edges: serverWorkflow.edges,
        updatedAt: serverWorkflow.updatedAt,
        sender: {
          clientId: 'server',
          userId: 'server',
          name: '服务器版本',
          image: null,
        },
      },
    })
  }, [setConflict])

  useEffect(() => {
    if (!serverHydrated)
      return

    const setSaveState = useWorkflowAutoSaveStore.getState().setSaveState
    const markLocalEdits = useWorkflowCollaborationStore.getState().markLocalEdits

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

      if (sessionId === activeSessionIdRef.current)
        setSaveState({ status: 'saving', message: null })

      try {
        const result = await saveWorkflowToServer(session.workflowId, {
          name: session.name,
          nodes: session.nodes,
          edges: session.edges,
          expectedRevision: session.revision,
        })

        const latestSession = useWorkflowStore.getState().sessions.find(s => s.id === sessionId)
        const store = useWorkflowStore.getState()
        store.setSessionWorkflowMeta(sessionId, result.id, result.name, result.revision)

        lastSnapshots.current.set(sessionId, sessionSnapshot({
          ...(latestSession ?? session),
          workflowId: result.id,
          name: result.name,
          revision: result.revision,
        }))

        if (result.id)
          markLocalEdits(result.id, false)

        if (sessionId === activeSessionIdRef.current) {
          setSaveState({
            status: 'saved',
            message: null,
            lastSavedAt: Date.now(),
          })
          void rememberLastWorkflow(result.id)
        }

        if (result.id)
          broadcastWorkflowSaved(result.id, result.revision)
      }
      catch (error) {
        if (error instanceof WorkflowSaveConflictError) {
          // 更新 revision 以避免无限重试循环
          const store = useWorkflowStore.getState()
          store.setSessionWorkflowMeta(
            sessionId,
            error.serverWorkflow.id ?? session.workflowId,
            error.serverWorkflow.name,
            error.serverWorkflow.revision,
          )
          reportSaveConflict(session, error.serverWorkflow)
          const message = error.message
          if (sessionId === activeSessionIdRef.current)
            setSaveState({ status: 'error', message })
          return
        }

        // 非 409 错误才标记为 dirty 重试
        dirty.current.set(sessionId, true)
        const message = error instanceof Error ? error.message : '自动保存失败'
        if (sessionId === activeSessionIdRef.current)
          setSaveState({ status: 'error', message })
      }
      finally {
        inflight.current.set(sessionId, false)
        // 409 冲突不自动重试，等待用户处理
        // 其他错误才在 dirty 时重试
        if (dirty.current.get(sessionId)) {
          // 添加延迟避免过快重试
          setTimeout(() => {
            void flushSave(sessionId)
          }, 2000)
        }
      }
    }

    const scheduleSave = (sessionId: string, immediate = false) => {
      dirty.current.set(sessionId, true)
      if (sessionId === activeSessionIdRef.current)
        setSaveState({ status: 'pending', message: null })

      const existing = timers.current.get(sessionId)
      if (existing)
        clearTimeout(existing)

      if (immediate) {
        timers.current.delete(sessionId)
        void flushSave(sessionId)
        return
      }

      timers.current.set(
        sessionId,
        setTimeout(() => {
          timers.current.delete(sessionId)
          void flushSave(sessionId)
        }, DEBOUNCE_MS),
      )
    }

    registerWorkflowAutoSaveFlush((sessionId, immediate) => {
      scheduleSave(sessionId, immediate)
    })

    for (const session of sessions) {
      const snapshot = sessionSnapshot(session)
      const previous = lastSnapshots.current.get(session.id)

      if (previous === undefined) {
        lastSnapshots.current.set(session.id, snapshot)
        if (!isApplyingRemote)
          scheduleSave(session.id)
        continue
      }

      if (previous !== snapshot) {
        if (isApplyingRemote) {
          lastSnapshots.current.set(session.id, snapshot)
          continue
        }

        if (session.workflowId)
          markLocalEdits(session.workflowId, true)
        scheduleSave(session.id)
      }
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

    return () => {
      registerWorkflowAutoSaveFlush(null)
    }
  }, [sessions, serverHydrated, isApplyingRemote, reportSaveConflict])

  useEffect(() => {
    if (!serverHydrated)
      return

    const onPageHide = () => {
      const sessionIds = useWorkflowStore.getState().sessions.map(session => session.id)
      flushAllWorkflowSessionSaves(sessionIds)
    }

    window.addEventListener('pagehide', onPageHide)
    return () => window.removeEventListener('pagehide', onPageHide)
  }, [serverHydrated])

  useEffect(() => {
    return () => {
      for (const timer of timers.current.values())
        clearTimeout(timer)
    }
  }, [])

  return null
}
