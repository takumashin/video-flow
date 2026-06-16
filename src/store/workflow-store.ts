import { create } from 'zustand'
import type { Connection, EdgeChange, NodeChange } from 'reactflow'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow'
import { v4 as uuidv4 } from 'uuid'
import type { ImageRole, RunLogEntry, SeedanceGenerationMode, SeedanceTaskListItem, VideoHistoryItem, WorkflowEdge, WorkflowNode, WorkflowNodeData } from '@/lib/types'
import { NodeType } from '@/lib/types'
import { pruneSeedanceUpstreamEdges, validateSeedanceConnection, applySeedanceImageRolesForMode, normalizeWorkflowImageRoles, resolveSeedanceModeForConnection } from '@/lib/seedance-connection-rules'
import { buildConnectionForNewNode, inferSeedanceGenerationModeForNewNode, type ConnectHandleSide } from '@/lib/connect-node-options'
import { getRecommendedModelForModeChange, shouldDisableAudio } from '@/lib/seedance-models'
import {
  readSeedanceNodePrompt,
  updatePromptAfterAudioRemoval,
  updatePromptAfterImageRemoval,
  updatePromptAfterVideoRemoval,
  getSeedanceUpstreamRefs,
} from '@/lib/seedance-upstream'
import { getOrderedUpstreamImageNodes } from '@/lib/workflow-engine'
import { migrateOutputNodesIntoSeedance } from '@/lib/migrate-workflow'
import { normalizeSeedanceNodesOnLoad } from '@/lib/sanitize-workflow'
import { runSeedanceNodeSession, resumeSeedanceNodeSession, handleSeedanceSessionError, finalizeSeedanceSessionJob } from '@/lib/run-workflow-session'
import {
  beginSeedanceJob,
  abortSeedanceJob,
  isSeedanceJobInflight,
} from '@/lib/seedance-generation-control'
import {
  createWorkflowSession,
  patchWorkflowSession,
  type WorkflowSession,
} from '@/lib/workflow-session'
import { rememberLastWorkflow } from '@/lib/workflow-last'
import { flushWorkflowSessionSave } from '@/lib/workflow-auto-save-control'
import { formatSeedanceUserError } from '@/lib/seedance-error-messages'
import { useTaskQueueStore } from '@/store/task-queue-store'

export type { WorkflowSession }

const initialSession = createWorkflowSession({ name: '示例工作流' })

export function getActiveSession(state: {
  sessions: WorkflowSession[]
  activeSessionId: string
}): WorkflowSession | undefined {
  return state.sessions.find(s => s.id === state.activeSessionId)
}

type WorkflowStore = {
  sessions: WorkflowSession[]
  activeSessionId: string
  serverHydrated: boolean
  setServerHydrated: (hydrated: boolean) => void
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: WorkflowEdge[]) => void
  setWorkflowName: (name: string) => void
  applyWorkflow: (workflow: {
    id?: string | null
    name: string
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
    revision?: number | null
  }, options?: { newTab?: boolean }) => void
  newWorkflow: () => void
  addSession: () => string
  closeSession: (sessionId: string) => void
  setActiveSession: (sessionId: string) => void
  onNodesChange: (changes: NodeChange[]) => void
  onEdgesChange: (changes: EdgeChange[]) => void
  onConnect: (connection: Connection) => void
  selectNode: (nodeId: string | null) => void
  openVideoHistoryModal: (nodeId: string) => void
  closeVideoHistoryModal: () => void
  toggleRunLogPanel: () => void
  closeRunLogPanel: () => void
  appendSeedanceVideo: (nodeId: string, item: Omit<VideoHistoryItem, 'id'>) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void
  pruneSeedanceEdgesForMode: (nodeId: string, mode: SeedanceGenerationMode) => void
  disconnectUpstreamImage: (seedanceNodeId: string, imageNodeId: string) => void
  setSeedanceFrameImage: (seedanceNodeId: string, role: ImageRole, imageUrl: string) => void
  disconnectUpstreamVideo: (seedanceNodeId: string, videoNodeId: string) => void
  disconnectUpstreamAudio: (seedanceNodeId: string, audioNodeId: string) => void
  addNode: (type: NodeType, position?: { x: number; y: number }) => void
  addConnectedNode: (
    type: NodeType,
    position: { x: number; y: number },
    anchor: { nodeId: string; handleType: ConnectHandleSide },
  ) => void
  addImageNode: (imageUrl: string, position?: { x: number; y: number }, role?: ImageRole) => void
  addVideoNode: (mediaUrl: string, position?: { x: number; y: number }) => void
  addAudioNode: (mediaUrl: string, position?: { x: number; y: number }) => void
  deleteSelectedNode: () => void
  deleteNode: (nodeId: string) => void
  addLog: (entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  clearWorkflowSavedId: (sessionId?: string) => void
  setSessionWorkflowMeta: (sessionId: string, workflowId: string, name: string, revision?: number | null) => void
  applyRemoteWorkflowUpdate: (
    workflowId: string,
    payload: {
      name: string
      nodes: WorkflowNode[]
      edges: WorkflowEdge[]
      revision: number
    },
  ) => void
  syncSessionRevision: (sessionId: string, revision: number) => void
  runSeedanceNode: (seedanceNodeId: string, sessionId?: string) => Promise<void>
  resumeSeedanceNode: (seedanceNodeId: string, sessionId?: string) => Promise<void>
  cancelSeedanceNode: (seedanceNodeId: string, sessionId?: string) => Promise<void>
  cancelSeedanceTask: (taskId: string) => Promise<void>
  resumeStuckSeedanceJobs: () => void
  reconcileActiveTasks: () => Promise<void>
  reconcileFailedTasks: () => Promise<void>
  resumeTaskFromQueue: (task: SeedanceTaskListItem) => Promise<void>
}

function createWorkflowNode(
  type: NodeType,
  session: WorkflowSession,
  position?: { x: number; y: number },
): WorkflowNode {
  const id = `${type}-${uuidv4().slice(0, 8)}`
  const count = session.nodes.filter(n => n.data.type === type).length
  const baseData = createNodeData(type)
  const title = count > 0 ? `${baseData.title} ${count + 1}` : baseData.title

  return {
    id,
    type: 'custom',
    position: position ?? { x: 120 + session.nodes.length * 40, y: 120 + session.nodes.length * 30 },
    data: { ...baseData, title },
  }
}

function configureConnectedSeedanceNode(
  newNode: WorkflowNode,
  anchorNode: WorkflowNode,
  handleType: ConnectHandleSide,
): WorkflowNode {
  if (newNode.data.type !== NodeType.Seedance)
    return newNode

  const generationMode = inferSeedanceGenerationModeForNewNode(anchorNode, handleType)
  const model = getRecommendedModelForModeChange(generationMode, newNode.data.model)
  const generateAudio = shouldDisableAudio(model) ? false : newNode.data.generateAudio

  return {
    ...newNode,
    data: {
      ...newNode.data,
      generationMode,
      model,
      generateAudio,
    },
  }
}

function applyWorkflowConnection(
  connection: Connection,
  nodes: WorkflowNode[],
  edges: WorkflowEdge[],
  log: (entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => void,
): { nodes: WorkflowNode[]; edges: WorkflowEdge[] } | null {
  let nextNodes = nodes
  const target = nodes.find(n => n.id === connection.target)
  const source = nodes.find(n => n.id === connection.source)

  if (target?.data.type === NodeType.Seedance && source) {
    const autoMode = resolveSeedanceModeForConnection(source, target, nodes, edges)
    const currentMode = target.data.generationMode ?? 'text_to_video'

    if (autoMode && autoMode !== currentMode) {
      const nextModel = getRecommendedModelForModeChange(autoMode, target.data.model)
      nextNodes = nodes.map(node =>
        node.id === target.id && node.data.type === NodeType.Seedance
          ? {
              ...node,
              data: {
                ...node.data,
                generationMode: autoMode,
                model: nextModel,
                generateAudio: shouldDisableAudio(nextModel) ? false : node.data.generateAudio,
              },
            }
          : node,
      )

      const modeLabels: Record<SeedanceGenerationMode, string> = {
        text_to_video: '文生视频',
        image_to_video: '图生视频',
        first_last_frame: '首尾帧',
        omni_reference: '全能参考',
      }
      log({
        nodeId: target.id,
        nodeTitle: target.data.title,
        message: `已自动切换为「${modeLabels[autoMode]}」模式以连接参考素材`,
        level: 'info',
      })
    }
  }

  const connectionCheck = validateSeedanceConnection(connection, nextNodes, edges)
  if (!connectionCheck.ok) {
    log({
      nodeId: connection.target ?? 'system',
      nodeTitle: target?.data.title ?? 'Seedance 生成',
      message: connectionCheck.reason,
      level: 'error',
    })
    return null
  }

  const resolvedTarget = nextNodes.find(n => n.id === connection.target)

  if (
    resolvedTarget?.data.type === NodeType.Seedance
    && source?.data.type === NodeType.TextPrompt
    && source.data.prompt.trim()
    && !readSeedanceNodePrompt(resolvedTarget.data)
  ) {
    const importedPrompt = source.data.prompt
    nextNodes = nextNodes.map(node =>
      node.id === resolvedTarget.id && node.data.type === NodeType.Seedance
        ? { ...node, data: { ...node.data, prompt: importedPrompt } }
        : node,
    )
  }

  const nextEdges = addEdge({ ...connection, type: 'custom' }, edges)

  if (resolvedTarget?.data.type === NodeType.Seedance) {
    const mode = resolvedTarget.data.generationMode ?? 'text_to_video'
    nextNodes = applySeedanceImageRolesForMode(resolvedTarget.id, mode, nextNodes, nextEdges)
  }

  return { nodes: nextNodes, edges: nextEdges }
}

function resetStuckSeedanceNode(node: WorkflowNode): WorkflowNode {
  if (node.data.type !== NodeType.Seedance || node.data.status !== 'running')
    return node

  if (node.data.taskId)
    return node

  return {
    ...node,
    data: {
      ...node.data,
      status: 'idle',
      progress: undefined,
      progressStartedAt: undefined,
      taskStatus: undefined,
      queuePosition: undefined,
      error: undefined,
      taskId: undefined,
    },
  }
}

function createRunSeedanceDeps(
  get: () => WorkflowStoreInternal,
  set: (partial: Partial<WorkflowStoreInternal> | ((state: WorkflowStoreInternal) => Partial<WorkflowStoreInternal>)) => void,
  sessionId: string,
): Parameters<typeof runSeedanceNodeSession>[2] {
  return {
    upsertLocalTask: (item) => {
      useTaskQueueStore.getState().upsertLocalTask({
        ...item,
        workflowId: item.workflowId ?? undefined,
      })
    },
    updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => {
      get().updateNodeDataForSession(sessionId, nodeId, data)
      set(state => ({
        sessions: syncSessionRunningState(state.sessions, sessionId),
      }))
    },
    appendSeedanceVideo: (nodeId: string, item: Omit<VideoHistoryItem, 'id'>) => {
      get().appendSeedanceVideoForSession(sessionId, nodeId, item)
    },
    addLog: (entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => {
      get().addLogForSession(sessionId, entry)
    },
    clearLogs: () => {
      get().clearLogsForSession(sessionId)
    },
    getNodes: () => get().sessions.find(s => s.id === sessionId)?.nodes ?? [],
    getEdges: () => get().sessions.find(s => s.id === sessionId)?.edges ?? [],
  }
}

function findSeedanceNodeForTask(
  session: WorkflowSession,
  task: SeedanceTaskListItem,
): WorkflowNode | undefined {
  if (task.nodeId) {
    const node = session.nodes.find(n => n.id === task.nodeId)
    if (node?.data.type === NodeType.Seedance)
      return node
  }

  if (task.nodeTitle) {
    return session.nodes.find(
      n => n.data.type === NodeType.Seedance && n.data.title === task.nodeTitle,
    )
  }

  return undefined
}

function findSessionForTask(
  sessions: WorkflowSession[],
  task: SeedanceTaskListItem,
): WorkflowSession | undefined {
  if (task.workflowId)
    return sessions.find(session => session.workflowId === task.workflowId)

  return undefined
}

async function ensureSessionForTask(
  get: () => WorkflowStoreInternal,
  task: SeedanceTaskListItem,
): Promise<WorkflowSession | undefined> {
  const existing = findSessionForTask(get().sessions, task)
  if (existing)
    return existing

  if (!task.workflowId)
    return getActiveSession(get())

  try {
    const response = await fetch(`/api/workflows/${encodeURIComponent(task.workflowId)}`)
    const data = await response.json()
    if (!response.ok || !data.workflow)
      return getActiveSession(get())

    get().applyWorkflow(data.workflow, { newTab: true })
    return get().sessions.find(session => session.workflowId === task.workflowId)
      ?? getActiveSession(get())
  }
  catch (error) {
    console.error('[seedance] load workflow for task failed:', error)
    return getActiveSession(get())
  }
}

function restoreTaskOnNode(
  get: () => WorkflowStoreInternal,
  sessionId: string,
  nodeId: string,
  task: SeedanceTaskListItem,
) {
  const isSystemQueue = task.status === 'waiting' || task.status === 'submitting'
  get().updateNodeDataForSession(sessionId, nodeId, {
    status: 'running',
    taskId: task.id,
    progress: task.progress,
    progressStartedAt: isSystemQueue ? undefined : (task.progressStartedAt ?? Date.now()),
    taskStatus: task.status,
    queuePosition: task.queuePosition,
    error: undefined,
  })
}

function restoreFailedTaskOnNode(
  get: () => WorkflowStoreInternal,
  sessionId: string,
  nodeId: string,
  task: SeedanceTaskListItem,
) {
  const errorMessage = formatSeedanceUserError(
    task.error?.message,
    task.error?.code,
    '视频生成失败',
  )

  get().updateNodeDataForSession(sessionId, nodeId, {
    status: 'failed',
    taskId: task.id,
    error: errorMessage,
    progress: undefined,
    progressStartedAt: undefined,
    taskStatus: undefined,
    queuePosition: undefined,
  })
}

function resumeStuckSeedanceJobsForStore(
  get: () => WorkflowStoreInternal,
  set: (partial: Partial<WorkflowStoreInternal> | ((state: WorkflowStoreInternal) => Partial<WorkflowStoreInternal>)) => void,
) {
  for (const session of get().sessions) {
    for (const node of session.nodes) {
      if (
        node.data.type !== NodeType.Seedance
        || node.data.status !== 'running'
        || !node.data.taskId
        || isSeedanceJobInflight(session.id, node.id)
      ) {
        continue
      }

      void executeSeedanceJob(get, set, session.id, node.id, 'resume')
    }
  }
}

async function executeSeedanceJob(
  get: () => WorkflowStoreInternal,
  set: (partial: Partial<WorkflowStoreInternal> | ((state: WorkflowStoreInternal) => Partial<WorkflowStoreInternal>)) => void,
  sessionId: string,
  seedanceNodeId: string,
  mode: 'run' | 'resume',
) {
  if (isSeedanceJobInflight(sessionId, seedanceNodeId))
    return

  const session = get().sessions.find(s => s.id === sessionId)
  if (!session)
    return

  const target = session.nodes.find(n => n.id === seedanceNodeId)
  if (!target || target.data.type !== NodeType.Seedance)
    return

  if (mode === 'run' && target.data.status === 'running')
    return

  if (mode === 'resume' && (target.data.status !== 'running' || !target.data.taskId))
    return

  const deps = createRunSeedanceDeps(get, set, sessionId)
  const signal = beginSeedanceJob(sessionId, seedanceNodeId)
  const options = { sessionId, signal, resume: mode === 'resume' }

  try {
    const latestSession = get().sessions.find(s => s.id === sessionId)
    if (!latestSession)
      return

    if (mode === 'resume') {
      await resumeSeedanceNodeSession(latestSession, seedanceNodeId, deps, options)
    }
    else {
      await runSeedanceNodeSession(latestSession, seedanceNodeId, deps, options)
    }
  }
  catch (error) {
    handleSeedanceSessionError(seedanceNodeId, target.data.title, deps, error, options)
  }
  finally {
    finalizeSeedanceSessionJob(options, seedanceNodeId)
    set(state => ({
      sessions: syncSessionRunningState(state.sessions, sessionId),
    }))
  }
}

function syncSessionRunningState(sessions: WorkflowSession[], sessionId: string): WorkflowSession[] {
  return patchWorkflowSession(sessions, sessionId, session => ({
    ...session,
    isRunning: session.nodes.some(
      node => node.data.type === NodeType.Seedance && node.data.status === 'running',
    ),
  }))
}

function createNodeData(type: NodeType): WorkflowNodeData {
  switch (type) {
    case NodeType.Start:
      return { type, title: '开始' }
    case NodeType.TextPrompt:
      return { type, title: '文本提示词', prompt: '' }
    case NodeType.ImageInput:
      return { type, title: '参考图片', imageUrl: '', role: 'first_frame' }
    case NodeType.VideoInput:
      return { type, title: '参考视频', mediaUrl: '' }
    case NodeType.AudioInput:
      return { type, title: '参考音频', mediaUrl: '' }
    case NodeType.Seedance:
      return {
        type,
        title: 'Seedance 生成',
        prompt: '',
        generationMode: 'text_to_video',
        model: 'doubao-seedance-1-5-pro-251215',
        resolution: '720p',
        ratio: '16:9',
        duration: 5,
        seed: -1,
        generateAudio: false,
        watermark: false,
        cameraFixed: false,
        status: 'idle',
        videoHistory: [],
      }
    case NodeType.Output:
      return { type, title: '视频输出', videoHistory: [], status: 'idle' }
  }
}

// Internal session-scoped helpers (not exposed on public store type but used via closure)
type WorkflowStoreInternal = WorkflowStore & {
  updateNodeDataForSession: (sessionId: string, nodeId: string, data: Partial<WorkflowNodeData>) => void
  appendSeedanceVideoForSession: (sessionId: string, nodeId: string, item: Omit<VideoHistoryItem, 'id'>) => void
  addLogForSession: (sessionId: string, entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => void
  clearLogsForSession: (sessionId: string) => void
  patchSession: (sessionId: string, updater: (session: WorkflowSession) => WorkflowSession) => void
}

export const useWorkflowStore = create<WorkflowStoreInternal>()((set, get) => ({
      sessions: [initialSession],
      activeSessionId: initialSession.id,
      serverHydrated: false,

      setServerHydrated: hydrated => set({ serverHydrated: hydrated }),

      patchSession: (sessionId, updater) => set(state => ({
        sessions: patchWorkflowSession(state.sessions, sessionId, updater),
      })),

      setNodes: nodes => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({ ...session, nodes }))
      },

      setEdges: edges => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({ ...session, edges }))
      },

      setWorkflowName: name => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({ ...session, name }))
      },

      applyWorkflow: (workflow, options) => {
        const migrated = migrateOutputNodesIntoSeedance(workflow.nodes, workflow.edges)
        const edges = migrated.edges
        const nodes = normalizeSeedanceNodesOnLoad(
          normalizeWorkflowImageRoles(migrated.nodes, edges),
        )
        const newTab = options?.newTab ?? true

        const applyToSession = (sessionId: string) => {
          get().patchSession(sessionId, session => ({
            ...session,
            nodes,
            edges,
            workflowId: workflow.id ?? null,
            name: workflow.name,
            revision: workflow.revision ?? session.revision,
            selectedNodeId: null,
            videoHistoryModalNodeId: null,
            runLogs: [],
            runLogPanelOpen: false,
          }))
          set({ activeSessionId: sessionId })
        }

        if (workflow.id) {
          const existingSession = get().sessions.find(s => s.workflowId === workflow.id)
          if (existingSession) {
            applyToSession(existingSession.id)
            return
          }
        }

        if (newTab) {
          const session = createWorkflowSession({
            name: workflow.name,
            workflowId: workflow.id ?? null,
            nodes,
            edges,
            revision: workflow.revision ?? null,
          })
          set(state => ({
            sessions: [...state.sessions, session],
            activeSessionId: session.id,
          }))
          return
        }

        applyToSession(get().activeSessionId)
      },

      applyRemoteWorkflowUpdate: (workflowId, payload) => {
        const migrated = migrateOutputNodesIntoSeedance(payload.nodes, payload.edges)
        const edges = migrated.edges
        const nodes = normalizeSeedanceNodesOnLoad(
          normalizeWorkflowImageRoles(migrated.nodes, edges),
        )

        set(state => ({
          sessions: state.sessions.map(session =>
            session.workflowId === workflowId
              ? {
                  ...session,
                  name: payload.name,
                  nodes,
                  edges,
                  revision: payload.revision,
                }
              : session,
          ),
        }))
      },

      syncSessionRevision: (sessionId, revision) => {
        get().patchSession(sessionId, session => ({ ...session, revision }))
      },

      newWorkflow: () => {
        const session = createWorkflowSession()
        set(state => ({
          sessions: [...state.sessions, session],
          activeSessionId: session.id,
        }))
      },

      addSession: () => {
        const session = createWorkflowSession()
        set(state => ({
          sessions: [...state.sessions, session],
          activeSessionId: session.id,
        }))
        return session.id
      },

      closeSession: sessionId => {
        const { sessions, activeSessionId } = get()
        const target = sessions.find(s => s.id === sessionId)
        if (!target)
          return

        if (target.isRunning) {
          if (!window.confirm(`工作流「${target.name}」正在运行，关闭后任务仍在后台继续。确定关闭？`))
            return
        }

        flushWorkflowSessionSave(sessionId)

        if (sessions.length <= 1) {
          const session = createWorkflowSession()
          set({ sessions: [session], activeSessionId: session.id })
          return
        }

        const nextSessions = sessions.filter(s => s.id !== sessionId)
        const nextActive = activeSessionId === sessionId
          ? nextSessions[Math.max(0, sessions.findIndex(s => s.id === sessionId) - 1)].id
          : activeSessionId

        set({ sessions: nextSessions, activeSessionId: nextActive })
      },

      setActiveSession: sessionId => {
        if (!get().sessions.some(s => s.id === sessionId))
          return

        set({ activeSessionId: sessionId })
        const session = get().sessions.find(s => s.id === sessionId)
        if (session?.workflowId)
          void rememberLastWorkflow(session.workflowId)
      },

      onNodesChange: changes => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({
          ...session,
          nodes: applyNodeChanges(changes, session.nodes) as WorkflowNode[],
        }))
      },

      onEdgesChange: changes => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const nextEdges = applyEdgeChanges(changes, session.edges)
        let nextNodes = session.nodes

        const removedEdgeIds = changes
          .filter(change => change.type === 'remove')
          .map(change => change.id)

        if (removedEdgeIds.length > 0) {
          const removedImageToSeedance = session.edges.some(edge =>
            removedEdgeIds.includes(edge.id)
            && session.nodes.find(node => node.id === edge.target)?.data.type === NodeType.Seedance
            && session.nodes.find(node => node.id === edge.source)?.data.type === NodeType.ImageInput,
          )

          if (removedImageToSeedance) {
            for (const node of session.nodes) {
              if (node.data.type !== NodeType.Seedance)
                continue
              const mode = node.data.generationMode ?? 'text_to_video'
              nextNodes = applySeedanceImageRolesForMode(node.id, mode, nextNodes, nextEdges)
            }
          }
        }

        get().patchSession(activeSessionId, s => ({ ...s, edges: nextEdges, nodes: nextNodes }))
      },

      onConnect: connection => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const result = applyWorkflowConnection(
          connection,
          session.nodes,
          session.edges,
          entry => get().addLogForSession(activeSessionId, entry),
        )
        if (!result)
          return

        get().patchSession(activeSessionId, s => ({
          ...s,
          nodes: result.nodes,
          edges: result.edges,
        }))
      },

      selectNode: nodeId => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({ ...session, selectedNodeId: nodeId }))
      },

      openVideoHistoryModal: nodeId => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({
          ...session,
          videoHistoryModalNodeId: nodeId,
          selectedNodeId: nodeId,
        }))
      },

      closeVideoHistoryModal: () => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({ ...session, videoHistoryModalNodeId: null }))
      },

      toggleRunLogPanel: () => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({
          ...session,
          runLogPanelOpen: !session.runLogPanelOpen,
        }))
      },

      closeRunLogPanel: () => {
        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({
          ...session,
          runLogPanelOpen: false,
        }))
      },

      appendSeedanceVideo: (nodeId, item) => {
        get().appendSeedanceVideoForSession(get().activeSessionId, nodeId, item)
      },

      appendSeedanceVideoForSession: (sessionId, nodeId, item) => {
        get().patchSession(sessionId, session => {
          const node = session.nodes.find(n => n.id === nodeId)
          if (!node || node.data.type !== NodeType.Seedance)
            return session

          const historyItem: VideoHistoryItem = { ...item, id: uuidv4() }
          const videoHistory = [historyItem, ...(node.data.videoHistory ?? [])]

          return {
            ...session,
            nodes: session.nodes.map(n =>
              n.id === nodeId && n.data.type === NodeType.Seedance
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      videoUrl: item.videoUrl,
                      videoHistory,
                      status: 'succeeded',
                      error: undefined,
                    },
                  }
                : n,
            ),
          }
        })
      },

      updateNodeData: (nodeId, data) => {
        get().updateNodeDataForSession(get().activeSessionId, nodeId, data)
      },

      updateNodeDataForSession: (sessionId, nodeId, data) => {
        get().patchSession(sessionId, session => ({
          ...session,
          nodes: session.nodes.map(node =>
            node.id === nodeId
              ? { ...node, data: { ...node.data, ...data } as WorkflowNodeData }
              : node,
          ),
        }))
      },

      pruneSeedanceEdgesForMode: (nodeId, mode) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const node = session.nodes.find(n => n.id === nodeId)
        if (!node || node.data.type !== NodeType.Seedance)
          return

        const { edges: nextEdges, removedCount } = pruneSeedanceUpstreamEdges(nodeId, mode, session.nodes, session.edges)
        const nextNodes = applySeedanceImageRolesForMode(nodeId, mode, session.nodes, nextEdges)
        const nodesChanged = nextNodes.some((n, index) => n !== session.nodes[index])

        if (removedCount === 0 && !nodesChanged)
          return

        get().patchSession(activeSessionId, s => ({ ...s, edges: nextEdges, nodes: nextNodes }))
        if (removedCount > 0) {
          get().addLogForSession(activeSessionId, {
            nodeId,
            nodeTitle: node.data.title,
            message: `已根据「${mode}」模式断开 ${removedCount} 条不符合的参考素材连接`,
            level: 'info',
          })
        }
      },

      disconnectUpstreamImage: (seedanceNodeId, imageNodeId) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const seedanceNode = session.nodes.find(n => n.id === seedanceNodeId)
        if (!seedanceNode || seedanceNode.data.type !== NodeType.Seedance)
          return

        const refs = getSeedanceUpstreamRefs(seedanceNodeId, session.nodes, session.edges)
        const imageRef = refs.images.find(image => image.nodeId === imageNodeId)
        if (!imageRef)
          return

        const edge = session.edges.find(
          e => e.source === imageNodeId && e.target === seedanceNodeId,
        )
        if (!edge)
          return

        const mode = seedanceNode.data.generationMode ?? 'text_to_video'
        const nextEdges = session.edges.filter(e => e.id !== edge.id)
        let nextNodes = applySeedanceImageRolesForMode(seedanceNodeId, mode, session.nodes, nextEdges)

        const nextPrompt = updatePromptAfterImageRemoval(
          readSeedanceNodePrompt(seedanceNode.data),
          imageRef.index,
        )
        nextNodes = nextNodes.map(node =>
          node.id === seedanceNodeId && node.data.type === NodeType.Seedance
            ? { ...node, data: { ...node.data, prompt: nextPrompt } }
            : node,
        )

        get().patchSession(activeSessionId, s => ({ ...s, edges: nextEdges, nodes: nextNodes }))
        get().addLogForSession(activeSessionId, {
          nodeId: seedanceNodeId,
          nodeTitle: seedanceNode.data.title,
          message: `已移除图片「${imageRef.title}」（@图片${imageRef.index}）`,
          level: 'info',
        })
      },

      setSeedanceFrameImage: (seedanceNodeId, role, imageUrl) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const seedanceNode = session.nodes.find(n => n.id === seedanceNodeId)
        if (!seedanceNode || seedanceNode.data.type !== NodeType.Seedance)
          return

        const mode = seedanceNode.data.generationMode ?? 'text_to_video'
        const orderedImages = getOrderedUpstreamImageNodes(seedanceNodeId, session.nodes, session.edges)
        const slotIndex = role === 'first_frame' ? 0 : 1
        const existingNode = orderedImages[slotIndex]

        if (existingNode) {
          let nextNodes = session.nodes.map(node =>
            node.id === existingNode.id && node.data.type === NodeType.ImageInput
              ? { ...node, data: { ...node.data, imageUrl, role } }
              : node,
          )
          nextNodes = applySeedanceImageRolesForMode(seedanceNodeId, mode, nextNodes, session.edges)
          get().patchSession(activeSessionId, s => ({ ...s, nodes: nextNodes }))
          return
        }

        if (orderedImages.length >= 2)
          return

        const seedancePos = seedanceNode.position
        const newNode = createWorkflowNode(NodeType.ImageInput, session, {
          x: seedancePos.x - 320,
          y: seedancePos.y + (role === 'last_frame' ? 140 : 0),
        })
        newNode.data = {
          ...newNode.data,
          type: NodeType.ImageInput,
          imageUrl,
          role,
        } as typeof newNode.data

        const connection: Connection = {
          source: newNode.id,
          target: seedanceNodeId,
          sourceHandle: null,
          targetHandle: null,
        }

        const result = applyWorkflowConnection(
          connection,
          [...session.nodes, newNode],
          session.edges,
          entry => get().addLogForSession(activeSessionId, entry),
        )
        if (!result)
          return

        get().patchSession(activeSessionId, s => ({
          ...s,
          nodes: result.nodes,
          edges: result.edges,
        }))
      },

      disconnectUpstreamVideo: (seedanceNodeId, videoNodeId) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const seedanceNode = session.nodes.find(n => n.id === seedanceNodeId)
        if (!seedanceNode || seedanceNode.data.type !== NodeType.Seedance)
          return

        const refs = getSeedanceUpstreamRefs(seedanceNodeId, session.nodes, session.edges)
        const videoRef = refs.videos.find(video => video.nodeId === videoNodeId)
        if (!videoRef)
          return

        const edge = session.edges.find(
          e => e.source === videoNodeId && e.target === seedanceNodeId,
        )
        if (!edge)
          return

        const nextEdges = session.edges.filter(e => e.id !== edge.id)
        const nextPrompt = updatePromptAfterVideoRemoval(
          readSeedanceNodePrompt(seedanceNode.data),
          videoRef.index,
        )
        const nextNodes = session.nodes.map(node =>
          node.id === seedanceNodeId && node.data.type === NodeType.Seedance
            ? { ...node, data: { ...node.data, prompt: nextPrompt } }
            : node,
        )

        get().patchSession(activeSessionId, s => ({ ...s, edges: nextEdges, nodes: nextNodes }))
        get().addLogForSession(activeSessionId, {
          nodeId: seedanceNodeId,
          nodeTitle: seedanceNode.data.title,
          message: `已移除视频「${videoRef.title}」（@视频${videoRef.index}）`,
          level: 'info',
        })
      },

      disconnectUpstreamAudio: (seedanceNodeId, audioNodeId) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const seedanceNode = session.nodes.find(n => n.id === seedanceNodeId)
        if (!seedanceNode || seedanceNode.data.type !== NodeType.Seedance)
          return

        const refs = getSeedanceUpstreamRefs(seedanceNodeId, session.nodes, session.edges)
        const audioRef = refs.audios.find(audio => audio.nodeId === audioNodeId)
        if (!audioRef)
          return

        const edge = session.edges.find(
          e => e.source === audioNodeId && e.target === seedanceNodeId,
        )
        if (!edge)
          return

        const nextEdges = session.edges.filter(e => e.id !== edge.id)
        const nextPrompt = updatePromptAfterAudioRemoval(
          readSeedanceNodePrompt(seedanceNode.data),
          audioRef.index,
        )
        const nextNodes = session.nodes.map(node =>
          node.id === seedanceNodeId && node.data.type === NodeType.Seedance
            ? { ...node, data: { ...node.data, prompt: nextPrompt } }
            : node,
        )

        get().patchSession(activeSessionId, s => ({ ...s, edges: nextEdges, nodes: nextNodes }))
        get().addLogForSession(activeSessionId, {
          nodeId: seedanceNodeId,
          nodeTitle: seedanceNode.data.title,
          message: `已移除音频「${audioRef.title}」（@音频${audioRef.index}）`,
          level: 'info',
        })
      },

      addNode: (type, position) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const newNode = createWorkflowNode(type, session, position)

        get().patchSession(activeSessionId, s => ({
          ...s,
          nodes: [...s.nodes, newNode],
        }))
      },

      addConnectedNode: (type, position, anchor) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const anchorNode = session.nodes.find(node => node.id === anchor.nodeId)
        if (!anchorNode)
          return

        const newNode = configureConnectedSeedanceNode(
          createWorkflowNode(type, session, position),
          anchorNode,
          anchor.handleType,
        )
        const endpoints = buildConnectionForNewNode(anchor.nodeId, newNode.id, anchor.handleType)
        const connection: Connection = {
          ...endpoints,
          sourceHandle: null,
          targetHandle: null,
        }
        const result = applyWorkflowConnection(
          connection,
          [...session.nodes, newNode],
          session.edges,
          entry => get().addLogForSession(activeSessionId, entry),
        )
        if (!result)
          return

        get().patchSession(activeSessionId, s => ({
          ...s,
          selectedNodeId: newNode.id,
          nodes: result.nodes,
          edges: result.edges,
        }))
      },

      addImageNode: (imageUrl, position, role = 'first_frame') => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const id = `${NodeType.ImageInput}-${uuidv4().slice(0, 8)}`
        const count = session.nodes.filter(n => n.data.type === NodeType.ImageInput).length
        const title = count > 0 ? `参考图片 ${count + 1}` : '参考图片'

        get().patchSession(activeSessionId, s => ({
          ...s,
          selectedNodeId: id,
          nodes: [
            ...s.nodes,
            {
              id,
              type: 'custom',
              position: position ?? { x: 120 + s.nodes.length * 40, y: 120 + s.nodes.length * 30 },
              data: {
                type: NodeType.ImageInput,
                title,
                imageUrl,
                role,
              },
            },
          ],
        }))
      },

      addVideoNode: (mediaUrl, position) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const id = `${NodeType.VideoInput}-${uuidv4().slice(0, 8)}`
        const count = session.nodes.filter(n => n.data.type === NodeType.VideoInput).length
        const title = count > 0 ? `参考视频 ${count + 1}` : '参考视频'

        get().patchSession(activeSessionId, s => ({
          ...s,
          selectedNodeId: id,
          nodes: [
            ...s.nodes,
            {
              id,
              type: 'custom',
              position: position ?? { x: 120 + s.nodes.length * 40, y: 120 + s.nodes.length * 30 },
              data: {
                type: NodeType.VideoInput,
                title,
                mediaUrl,
              },
            },
          ],
        }))
      },

      addAudioNode: (mediaUrl, position) => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const id = `${NodeType.AudioInput}-${uuidv4().slice(0, 8)}`
        const count = session.nodes.filter(n => n.data.type === NodeType.AudioInput).length
        const title = count > 0 ? `参考音频 ${count + 1}` : '参考音频'

        get().patchSession(activeSessionId, s => ({
          ...s,
          selectedNodeId: id,
          nodes: [
            ...s.nodes,
            {
              id,
              type: 'custom',
              position: position ?? { x: 120 + s.nodes.length * 40, y: 120 + s.nodes.length * 30 },
              data: {
                type: NodeType.AudioInput,
                title,
                mediaUrl,
              },
            },
          ],
        }))
      },

      deleteSelectedNode: () => {
        const session = getActiveSession(get())
        if (session?.selectedNodeId)
          get().deleteNode(session.selectedNodeId)
      },

      deleteNode: nodeId => {
        const { activeSessionId } = get()
        const session = getActiveSession(get())
        if (!session)
          return

        const node = session.nodes.find(n => n.id === nodeId)
        if (!node || node.data.type === NodeType.Start)
          return

        get().patchSession(activeSessionId, s => ({
          ...s,
          nodes: s.nodes.filter(n => n.id !== nodeId),
          edges: s.edges.filter(e => e.source !== nodeId && e.target !== nodeId),
          selectedNodeId: s.selectedNodeId === nodeId ? null : s.selectedNodeId,
        }))
      },

      addLog: entry => {
        get().addLogForSession(get().activeSessionId, entry)
      },

      addLogForSession: (sessionId, entry) => {
        get().patchSession(sessionId, session => ({
          ...session,
          runLogs: [
            ...session.runLogs,
            { ...entry, id: uuidv4(), timestamp: Date.now() },
          ],
        }))
      },

      clearLogs: () => {
        get().clearLogsForSession(get().activeSessionId)
      },

      clearLogsForSession: sessionId => {
        get().patchSession(sessionId, session => ({ ...session, runLogs: [] }))
      },

      clearWorkflowSavedId: sessionId => {
        const id = sessionId ?? get().activeSessionId
        get().patchSession(id, session => ({ ...session, workflowId: null }))
      },

      setSessionWorkflowMeta: (sessionId, workflowId, name, revision) => {
        get().patchSession(sessionId, session => ({
          ...session,
          workflowId,
          name,
          revision: revision ?? session.revision,
        }))
      },

      runSeedanceNode: async (seedanceNodeId, sessionId) => {
        const id = sessionId ?? get().activeSessionId
        await executeSeedanceJob(get, set, id, seedanceNodeId, 'run')
      },

      resumeSeedanceNode: async (seedanceNodeId, sessionId) => {
        const id = sessionId ?? get().activeSessionId
        await executeSeedanceJob(get, set, id, seedanceNodeId, 'resume')
      },

      cancelSeedanceNode: async (seedanceNodeId, sessionId) => {
        const id = sessionId ?? get().activeSessionId
        const session = get().sessions.find(s => s.id === id)
        const node = session?.nodes.find(n => n.id === seedanceNodeId)
        if (!node || node.data.type !== NodeType.Seedance)
          return

        const taskId = node.data.taskId
        if (taskId) {
          const response = await fetch(`/api/seedance/tasks/${taskId}`, { method: 'DELETE' })
          const data = await response.json().catch(() => ({}))
          if (!response.ok)
            throw new Error(typeof data.error === 'string' ? data.error : '取消失败')
        }

        abortSeedanceJob(id, seedanceNodeId)

        get().updateNodeDataForSession(id, seedanceNodeId, {
          status: 'idle',
          progress: undefined,
          progressStartedAt: undefined,
          taskId: undefined,
          taskStatus: undefined,
          queuePosition: undefined,
          error: undefined,
        })

        if (taskId) {
          useTaskQueueStore.getState().upsertLocalTask({
            id: taskId,
            taskId,
            prompt: node.data.prompt,
            nodeTitle: node.data.title,
            status: 'cancelled',
            progress: 0,
            createdAt: Date.now(),
            workflowId: session?.workflowId ?? undefined,
            nodeId: seedanceNodeId,
          })
        }

        get().addLogForSession(id, {
          nodeId: seedanceNodeId,
          nodeTitle: node.data.title,
          message: '已取消生成',
          level: 'info',
        })

        set(state => ({
          sessions: syncSessionRunningState(state.sessions, id),
        }))
      },

      cancelSeedanceTask: async (taskId) => {
        for (const session of get().sessions) {
          const node = session.nodes.find(
            n => n.data.type === NodeType.Seedance && n.data.taskId === taskId,
          )
          if (node) {
            await get().cancelSeedanceNode(node.id, session.id)
            return
          }
        }

        const response = await fetch(`/api/seedance/tasks/${taskId}`, { method: 'DELETE' })
        const data = await response.json().catch(() => ({}))
        if (!response.ok)
          throw new Error(typeof data.error === 'string' ? data.error : '取消失败')

        const local = useTaskQueueStore.getState().localTasks.find(t => t.taskId === taskId)
        useTaskQueueStore.getState().upsertLocalTask({
          id: taskId,
          taskId,
          prompt: local?.prompt,
          nodeTitle: local?.nodeTitle,
          status: 'cancelled',
          progress: 0,
          createdAt: local?.createdAt ?? Date.now(),
          workflowId: local?.workflowId,
          nodeId: local?.nodeId,
        })
      },

      resumeStuckSeedanceJobs: () => {
        resumeStuckSeedanceJobsForStore(get, set)
      },

      reconcileActiveTasks: async () => {
        try {
          const response = await fetch('/api/seedance/tasks?active=true', { cache: 'no-store' })
          if (!response.ok)
            return

          const data = await response.json()
          const tasks = (data.items ?? []) as SeedanceTaskListItem[]

          for (const task of tasks) {
            if (task.status !== 'waiting' && task.status !== 'submitting' && task.status !== 'queued' && task.status !== 'running')
              continue

            const session = findSessionForTask(get().sessions, task) ?? getActiveSession(get())
            if (!session)
              continue

            const node = findSeedanceNodeForTask(session, task)
            if (!node || node.data.type !== NodeType.Seedance)
              continue

            if (isSeedanceJobInflight(session.id, node.id))
              continue

            restoreTaskOnNode(get, session.id, node.id, task)
            void executeSeedanceJob(get, set, session.id, node.id, 'resume')
          }
        }
        catch (error) {
          console.error('[seedance] reconcile active tasks failed:', error)
        }
      },

      reconcileFailedTasks: async () => {
        try {
          const response = await fetch('/api/seedance/tasks?page_num=1&page_size=100&filter.status=failed', {
            cache: 'no-store',
          })
          if (!response.ok)
            return

          const data = await response.json()
          const tasks = (data.items ?? []) as SeedanceTaskListItem[]

          for (const session of get().sessions) {
            if (!session.workflowId)
              continue

            const sessionTasks = tasks.filter(task => task.workflowId === session.workflowId)
            const latestTaskByNodeId = new Map<string, SeedanceTaskListItem>()
            const latestTaskByTaskId = new Map<string, SeedanceTaskListItem>()
            let restored = false

            for (const task of sessionTasks) {
              const taskUpdatedAt = task.updated_at ?? task.created_at ?? 0

              const existingByTaskId = latestTaskByTaskId.get(task.id)
              const existingTaskUpdatedAt = existingByTaskId?.updated_at ?? existingByTaskId?.created_at ?? 0
              if (!existingByTaskId || taskUpdatedAt >= existingTaskUpdatedAt)
                latestTaskByTaskId.set(task.id, task)

              const node = findSeedanceNodeForTask(session, task)
              if (!node || node.data.type !== NodeType.Seedance)
                continue

              const existing = latestTaskByNodeId.get(node.id)
              const existingUpdatedAt = existing?.updated_at ?? existing?.created_at ?? 0
              if (!existing || taskUpdatedAt >= existingUpdatedAt)
                latestTaskByNodeId.set(node.id, task)
            }

            for (const node of session.nodes) {
              if (node.data.type !== NodeType.Seedance)
                continue

              if (isSeedanceJobInflight(session.id, node.id))
                continue

              const task = latestTaskByNodeId.get(node.id)
                ?? (node.data.taskId ? latestTaskByTaskId.get(node.data.taskId) : undefined)

              if (!task)
                continue

              const errorMessage = formatSeedanceUserError(
                task.error?.message,
                task.error?.code,
                '视频生成失败',
              )

              if (
                node.data.status === 'failed'
                && node.data.error === errorMessage
                && node.data.taskId === task.id
              ) {
                continue
              }

              restoreFailedTaskOnNode(get, session.id, node.id, task)
              restored = true
            }

            if (restored)
              flushWorkflowSessionSave(session.id)
          }
        }
        catch (error) {
          console.error('[seedance] reconcile failed tasks failed:', error)
        }
      },

      resumeTaskFromQueue: async (task) => {
        if (task.status !== 'waiting' && task.status !== 'submitting' && task.status !== 'queued' && task.status !== 'running')
          return

        const session = await ensureSessionForTask(get, task)
        if (!session)
          return

        if (session.id !== get().activeSessionId)
          get().setActiveSession(session.id)

        const node = findSeedanceNodeForTask(session, task)
        if (!node)
          return

        if (isSeedanceJobInflight(session.id, node.id))
          return

        restoreTaskOnNode(get, session.id, node.id, task)
        await executeSeedanceJob(get, set, session.id, node.id, 'resume')
      },
    }))
