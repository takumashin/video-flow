'use client'

import { useEffect, useRef } from 'react'
import { sanitizeNodesForSave } from '@/lib/sanitize-workflow'
import type { WorkflowRemoteSnapshot, WorkflowSyncClientMessage, WorkflowSyncServerMessage } from '@/lib/workflow-sync/protocol'
import { pickCollaboratorColor } from '@/lib/workflow-sync/protocol'
import { getActiveSession, useWorkflowStore } from '@/store/workflow-store'
import { useWorkflowCollaborationStore, EMPTY_COLLABORATORS } from '@/store/workflow-collaboration-store'
import WorkflowConflictDialog from '@/components/workflow-conflict-dialog'

const SYNC_DEBOUNCE_MS = 250
const TOKEN_REFRESH_MS = 10 * 60 * 1000
const RECONNECT_DELAY_MS = 3000

export default function WorkflowCollaboration() {
  const workflowId = useWorkflowStore(state => getActiveSession(state)?.workflowId ?? null)
  const sessionRevision = useWorkflowStore(state => getActiveSession(state)?.revision ?? null)
  const sessionName = useWorkflowStore(state => getActiveSession(state)?.name ?? '')
  const sessionNodes = useWorkflowStore(state => getActiveSession(state)?.nodes ?? [])
  const sessionEdges = useWorkflowStore(state => getActiveSession(state)?.edges ?? [])

  const wsRef = useRef<WebSocket | null>(null)
  const tokenRef = useRef<string | null>(null)
  const wsUrlRef = useRef<string | null>(null)
  const joinedWorkflowRef = useRef<string | null>(null)
  const syncTimerRef = useRef<number | null>(null)
  const reconnectTimerRef = useRef<number | null>(null)
  const lastBroadcastRef = useRef<string>('')
  const connectingRef = useRef(false)
  const unmountedRef = useRef(false)

  const sendMessage = (message: WorkflowSyncClientMessage) => {
    const socket = wsRef.current
    if (socket?.readyState === WebSocket.OPEN)
      socket.send(JSON.stringify(message))
  }

  const applyRemoteSnapshot = (snapshot: WorkflowRemoteSnapshot, reason: 'remote_edit' | 'save_conflict') => {
    const session = useWorkflowStore.getState().sessions.find(item => item.workflowId === snapshot.workflowId)
    if (!session)
      return

    const pending = useWorkflowCollaborationStore.getState().pendingLocalEditsByWorkflow[snapshot.workflowId]

    if (pending && reason === 'remote_edit') {
      useWorkflowCollaborationStore.getState().setConflict({
        workflowId: snapshot.workflowId,
        sessionId: session.id,
        reason: 'remote_edit',
        remote: snapshot,
      })
      return
    }

    useWorkflowCollaborationStore.getState().setApplyingRemote(true)
    useWorkflowStore.getState().applyRemoteWorkflowUpdate(snapshot.workflowId, {
      name: snapshot.name,
      nodes: snapshot.nodes,
      edges: snapshot.edges,
      revision: snapshot.revision,
    })
    useWorkflowCollaborationStore.getState().markLocalEdits(snapshot.workflowId, false)
    window.setTimeout(() => useWorkflowCollaborationStore.getState().setApplyingRemote(false), 0)
  }

  const handleServerMessage = (message: WorkflowSyncServerMessage) => {
    const store = useWorkflowCollaborationStore.getState()
    switch (message.type) {
      case 'auth_ok':
        store.setClientId(message.clientId)
        return
      case 'auth_error':
        store.setWsError(message.message)
        return
      case 'joined':
        store.setCollaborators(message.workflowId, message.collaborators)
        return
      case 'presence':
        store.setCollaborators(message.workflowId, message.collaborators)
        return
      case 'sync': {
        const selfClientId = store.clientId
        if (message.snapshot.sender.clientId === selfClientId)
          return
        applyRemoteSnapshot(message.snapshot, 'remote_edit')
        return
      }
      case 'error':
        store.setWsError(message.message)
        return
      default:
        return
    }
  }

  const fetchToken = async () => {
    const response = await fetch('/api/workflows/sync-token', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok)
      throw new Error(data.error || '协作认证失败')

    tokenRef.current = data.token
    wsUrlRef.current = data.wsUrl
    return data as { token: string, wsUrl: string }
  }

  const refreshAuth = () => {
    const token = tokenRef.current
    if (token && wsRef.current?.readyState === WebSocket.OPEN)
      sendMessage({ type: 'auth', token })
  }

  const scheduleReconnect = () => {
    if (unmountedRef.current || reconnectTimerRef.current)
      return

    reconnectTimerRef.current = window.setTimeout(() => {
      reconnectTimerRef.current = null
      void connect()
    }, RECONNECT_DELAY_MS)
  }

  const connect = async () => {
    if (unmountedRef.current || connectingRef.current)
      return

    const existing = wsRef.current
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING))
      return

    connectingRef.current = true

    try {
      const auth = await fetchToken()
      if (unmountedRef.current)
        return

      const socket = new WebSocket(auth.wsUrl)
      wsRef.current = socket

      socket.onopen = () => {
        connectingRef.current = false
        useWorkflowCollaborationStore.getState().setWsConnected(true)
        useWorkflowCollaborationStore.getState().setWsError(null)
        sendMessage({ type: 'auth', token: auth.token })

        const joinedWorkflowId = joinedWorkflowRef.current
        if (joinedWorkflowId)
          sendMessage({ type: 'join', workflowId: joinedWorkflowId })
      }

      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as WorkflowSyncServerMessage
          handleServerMessage(message)
        }
        catch {
          useWorkflowCollaborationStore.getState().setWsError('收到无效的协作消息')
        }
      }

      socket.onclose = () => {
        connectingRef.current = false
        if (wsRef.current === socket)
          wsRef.current = null
        useWorkflowCollaborationStore.getState().setWsConnected(false)
        if (!unmountedRef.current)
          scheduleReconnect()
      }

      socket.onerror = () => {
        useWorkflowCollaborationStore.getState().setWsError('协作连接异常')
      }
    }
    catch (error) {
      connectingRef.current = false
      useWorkflowCollaborationStore.getState().setWsError(
        error instanceof Error ? error.message : '协作连接失败',
      )
      scheduleReconnect()
    }
  }

  useEffect(() => {
    unmountedRef.current = false
    void connect()

    const tokenTimer = window.setInterval(() => {
      void fetchToken()
        .then(() => refreshAuth())
        .catch(() => {})
    }, TOKEN_REFRESH_MS)

    return () => {
      unmountedRef.current = true
      window.clearInterval(tokenTimer)
      if (syncTimerRef.current)
        window.clearTimeout(syncTimerRef.current)
      if (reconnectTimerRef.current)
        window.clearTimeout(reconnectTimerRef.current)
      wsRef.current?.close()
      wsRef.current = null
    }
  }, [])

  useEffect(() => {
    const previous = joinedWorkflowRef.current
    if (previous && previous !== workflowId) {
      sendMessage({ type: 'leave', workflowId: previous })
      useWorkflowCollaborationStore.getState().clearWorkflow(previous)
    }

    joinedWorkflowRef.current = workflowId

    if (!workflowId)
      return

    if (wsRef.current?.readyState === WebSocket.OPEN)
      sendMessage({ type: 'join', workflowId })
  }, [workflowId])

  useEffect(() => {
    if (!workflowId)
      return

    const snapshot = JSON.stringify({
      revision: sessionRevision,
      name: sessionName,
      nodes: sanitizeNodesForSave(sessionNodes),
      edges: sessionEdges,
    })

    if (snapshot === lastBroadcastRef.current)
      return

    if (useWorkflowCollaborationStore.getState().isApplyingRemote)
      return

    if (syncTimerRef.current)
      window.clearTimeout(syncTimerRef.current)

    syncTimerRef.current = window.setTimeout(() => {
      lastBroadcastRef.current = snapshot
      sendMessage({
        type: 'sync',
        workflowId,
        revision: sessionRevision,
        name: sessionName,
        nodes: sanitizeNodesForSave(sessionNodes),
        edges: sessionEdges,
        updatedAt: Date.now(),
      })
    }, SYNC_DEBOUNCE_MS)
  }, [workflowId, sessionRevision, sessionName, sessionNodes, sessionEdges])

  useEffect(() => {
    const onSaved = (event: Event) => {
      const detail = (event as CustomEvent<{ workflowId: string, revision: number }>).detail
      if (!detail?.workflowId)
        return

      const session = useWorkflowStore.getState().sessions.find(item => item.workflowId === detail.workflowId)
      if (session)
        useWorkflowStore.getState().syncSessionRevision(session.id, detail.revision)

      useWorkflowCollaborationStore.getState().markLocalEdits(detail.workflowId, false)
      lastBroadcastRef.current = ''
    }

    window.addEventListener('seedance:workflow-saved', onSaved)
    return () => window.removeEventListener('seedance:workflow-saved', onSaved)
  }, [])

  return <WorkflowConflictDialog />
}

export function CollaboratorBadge({
  name,
  image,
  color,
  compact = false,
}: {
  name: string
  image: string | null
  color: string
  compact?: boolean
}) {
  const initials = name.slice(0, 1).toUpperCase()
  return (
    <span
      className="inline-flex items-center justify-center rounded-full border-2 border-surface font-semibold text-white shadow-sm"
      style={{
        backgroundColor: color,
        width: compact ? 24 : 28,
        height: compact ? 24 : 28,
        fontSize: compact ? 10 : 11,
      }}
      title={name}
    >
      {image
        ? <img src={image} alt={name} className="h-full w-full rounded-full object-cover" />
        : initials}
    </span>
  )
}

export function useActiveWorkflowCollaborators() {
  const workflowId = useWorkflowStore(state => getActiveSession(state)?.workflowId ?? null)
  const collaborators = useWorkflowCollaborationStore(state => {
    if (!workflowId)
      return EMPTY_COLLABORATORS
    return state.collaboratorsByWorkflow[workflowId] ?? EMPTY_COLLABORATORS
  })
  const wsConnected = useWorkflowCollaborationStore(state => state.wsConnected)
  const clientId = useWorkflowCollaborationStore(state => state.clientId)
  const selfColor = clientId ? pickCollaboratorColor(clientId) : undefined
  return { workflowId, collaborators, wsConnected, selfColor }
}
