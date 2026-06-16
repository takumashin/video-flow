import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { WebSocketServer, type WebSocket } from 'ws'
import { getWorkflow } from '../src/lib/workflow-storage'
import { pickCollaboratorColor } from '../src/lib/workflow-sync/protocol'
import type {
  WorkflowCollaborator,
  WorkflowSyncClientMessage,
  WorkflowSyncServerMessage,
} from '../src/lib/workflow-sync/protocol'
import { getWorkflowWsPort, verifyWorkflowSyncToken } from '../src/lib/workflow-sync/token'

type ClientState = {
  id: string
  socket: WebSocket
  auth: {
    userId: string
    userName: string
    userImage: string | null
    workspaceId: string
  } | null
  workflowId: string | null
}

const clients = new Map<WebSocket, ClientState>()
const workflowRooms = new Map<string, Set<WebSocket>>()

function send(socket: WebSocket, message: WorkflowSyncServerMessage) {
  if (socket.readyState === socket.OPEN)
    socket.send(JSON.stringify(message))
}

function getCollaborators(workflowId: string, forSocket?: WebSocket): WorkflowCollaborator[] {
  const room = workflowRooms.get(workflowId)
  if (!room)
    return []

  const currentUserId = forSocket ? clients.get(forSocket)?.auth?.userId : undefined
  const seenUserIds = new Set<string>()
  const collaborators: WorkflowCollaborator[] = []

  for (const socket of room) {
    if (socket === forSocket)
      continue

    const state = clients.get(socket)
    if (!state?.auth)
      continue

    if (currentUserId && state.auth.userId === currentUserId)
      continue

    if (seenUserIds.has(state.auth.userId))
      continue

    seenUserIds.add(state.auth.userId)
    collaborators.push({
      clientId: state.id,
      userId: state.auth.userId,
      name: state.auth.userName,
      image: state.auth.userImage,
      color: pickCollaboratorColor(state.auth.userId),
      workflowId,
    })
  }

  return collaborators
}

function broadcastPresence(workflowId: string) {
  const room = workflowRooms.get(workflowId)
  if (!room)
    return

  for (const socket of room) {
    send(socket, {
      type: 'presence',
      workflowId,
      collaborators: getCollaborators(workflowId, socket),
    })
  }
}

function leaveRoom(socket: WebSocket) {
  const state = clients.get(socket)
  if (!state?.workflowId)
    return

  const workflowId = state.workflowId
  const room = workflowRooms.get(workflowId)
  room?.delete(socket)
  if (room && room.size === 0)
    workflowRooms.delete(workflowId)

  state.workflowId = null
  broadcastPresence(workflowId)
}

async function joinRoom(socket: WebSocket, workflowId: string) {
  const state = clients.get(socket)
  if (!state?.auth) {
    send(socket, { type: 'auth_error', message: '请先完成认证' })
    return
  }

  const workflow = await getWorkflow(workflowId, state.auth.workspaceId)
  if (!workflow) {
    send(socket, { type: 'error', message: '无权访问该工作流' })
    return
  }

  leaveRoom(socket)

  if (!workflowRooms.has(workflowId))
    workflowRooms.set(workflowId, new Set())

  workflowRooms.get(workflowId)!.add(socket)
  state.workflowId = workflowId

  send(socket, {
    type: 'joined',
    workflowId,
    collaborators: getCollaborators(workflowId, socket),
  })
  broadcastPresence(workflowId)
}

function relaySync(source: WebSocket, message: Extract<WorkflowSyncClientMessage, { type: 'sync' }>) {
  const state = clients.get(source)
  if (!state?.auth || state.workflowId !== message.workflowId)
    return

  const room = workflowRooms.get(message.workflowId)
  if (!room)
    return

  const payload: WorkflowSyncServerMessage = {
    type: 'sync',
    snapshot: {
      workflowId: message.workflowId,
      revision: message.revision ?? 0,
      name: message.name,
      nodes: message.nodes,
      edges: message.edges,
      updatedAt: message.updatedAt,
      sender: {
        clientId: state.id,
        userId: state.auth.userId,
        name: state.auth.userName,
        image: state.auth.userImage,
      },
    },
  }

  for (const socket of room) {
    if (socket !== source)
      send(socket, payload)
  }
}

function handleMessage(socket: WebSocket, raw: string) {
  let message: WorkflowSyncClientMessage
  try {
    message = JSON.parse(raw) as WorkflowSyncClientMessage
  }
  catch {
    send(socket, { type: 'error', message: '无效的消息格式' })
    return
  }

  switch (message.type) {
    case 'auth': {
      const payload = verifyWorkflowSyncToken(message.token)
      if (!payload) {
        send(socket, { type: 'auth_error', message: '认证失败或已过期' })
        return
      }
      const state = clients.get(socket)
      if (!state)
        return
      state.auth = {
        userId: payload.userId,
        userName: payload.userName,
        userImage: payload.userImage,
        workspaceId: payload.workspaceId,
      }
      send(socket, { type: 'auth_ok', clientId: state.id })
      return
    }
    case 'join':
      void joinRoom(socket, message.workflowId)
      return
    case 'leave':
      if (clients.get(socket)?.workflowId === message.workflowId)
        leaveRoom(socket)
      return
    case 'sync':
      relaySync(socket, message)
      return
    case 'ping':
      send(socket, { type: 'pong' })
      return
    default:
      send(socket, { type: 'error', message: '未知消息类型' })
  }
}

const port = getWorkflowWsPort()
const server = createServer()
const wss = new WebSocketServer({ server })

wss.on('connection', (socket) => {
  clients.set(socket, {
    id: randomUUID(),
    socket,
    auth: null,
    workflowId: null,
  })

  send(socket, { type: 'ready' })

  socket.on('message', (data) => {
    handleMessage(socket, data.toString())
  })

  socket.on('close', () => {
    leaveRoom(socket)
    clients.delete(socket)
  })
})

server.listen(port, () => {
  console.log(`[workflow-sync] WebSocket listening on ws://localhost:${port}`)
})
