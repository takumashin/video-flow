import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { Connection, EdgeChange, NodeChange } from 'reactflow'
import {
  addEdge,
  applyEdgeChanges,
  applyNodeChanges,
} from 'reactflow'
import { v4 as uuidv4 } from 'uuid'
import type { ImageRole, RunLogEntry, SeedanceGenerationMode, VideoHistoryItem, WorkflowEdge, WorkflowNode, WorkflowNodeData } from '@/lib/types'
import { NodeType } from '@/lib/types'
import { pruneSeedanceUpstreamEdges, validateSeedanceConnection, applySeedanceImageRolesForMode, normalizeWorkflowImageRoles } from '@/lib/seedance-connection-rules'
import {
  readSeedanceNodePrompt,
  updatePromptAfterAudioRemoval,
  updatePromptAfterImageRemoval,
  updatePromptAfterVideoRemoval,
  getSeedanceUpstreamRefs,
} from '@/lib/seedance-upstream'
import { runSeedanceNodeSession } from '@/lib/run-workflow-session'
import {
  createWorkflowSession,
  patchWorkflowSession,
  type WorkflowSession,
} from '@/lib/workflow-session'
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
  setNodes: (nodes: WorkflowNode[]) => void
  setEdges: (edges: WorkflowEdge[]) => void
  setWorkflowName: (name: string) => void
  applyWorkflow: (workflow: {
    id?: string | null
    name: string
    nodes: WorkflowNode[]
    edges: WorkflowEdge[]
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
  appendOutputVideo: (nodeId: string, item: Omit<VideoHistoryItem, 'id'>) => void
  updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => void
  pruneSeedanceEdgesForMode: (nodeId: string, mode: SeedanceGenerationMode) => void
  disconnectUpstreamImage: (seedanceNodeId: string, imageNodeId: string) => void
  disconnectUpstreamVideo: (seedanceNodeId: string, videoNodeId: string) => void
  disconnectUpstreamAudio: (seedanceNodeId: string, audioNodeId: string) => void
  addNode: (type: NodeType, position?: { x: number; y: number }) => void
  addImageNode: (imageUrl: string, position?: { x: number; y: number }, role?: ImageRole) => void
  addVideoNode: (mediaUrl: string, position?: { x: number; y: number }) => void
  addAudioNode: (mediaUrl: string, position?: { x: number; y: number }) => void
  deleteSelectedNode: () => void
  deleteNode: (nodeId: string) => void
  addLog: (entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => void
  clearLogs: () => void
  clearWorkflowSavedId: (sessionId?: string) => void
  setSessionWorkflowMeta: (sessionId: string, workflowId: string, name: string) => void
  runSeedanceNode: (seedanceNodeId: string, sessionId?: string) => Promise<void>
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
      }
    case NodeType.Output:
      return { type, title: '视频输出', videoHistory: [], status: 'idle' }
  }
}

// Internal session-scoped helpers (not exposed on public store type but used via closure)
type WorkflowStoreInternal = WorkflowStore & {
  updateNodeDataForSession: (sessionId: string, nodeId: string, data: Partial<WorkflowNodeData>) => void
  appendOutputVideoForSession: (sessionId: string, nodeId: string, item: Omit<VideoHistoryItem, 'id'>) => void
  addLogForSession: (sessionId: string, entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => void
  clearLogsForSession: (sessionId: string) => void
  patchSession: (sessionId: string, updater: (session: WorkflowSession) => WorkflowSession) => void
}

export const useWorkflowStore = create<WorkflowStoreInternal>()(
  persist(
    (set, get) => ({
      sessions: [initialSession],
      activeSessionId: initialSession.id,

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
        const edges = workflow.edges
        const nodes = normalizeWorkflowImageRoles(workflow.nodes, edges)
        const newTab = options?.newTab ?? true

        if (newTab) {
          const session = createWorkflowSession({
            name: workflow.name,
            workflowId: workflow.id ?? null,
            nodes,
            edges,
          })
          set(state => ({
            sessions: [...state.sessions, session],
            activeSessionId: session.id,
          }))
          return
        }

        const { activeSessionId } = get()
        get().patchSession(activeSessionId, session => ({
          ...session,
          nodes,
          edges,
          workflowId: workflow.id ?? null,
          name: workflow.name,
          selectedNodeId: null,
          videoHistoryModalNodeId: null,
          runLogs: [],
        }))
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
        if (get().sessions.some(s => s.id === sessionId))
          set({ activeSessionId: sessionId })
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

        const { nodes, edges } = session
        const target = nodes.find(n => n.id === connection.target)
        const source = nodes.find(n => n.id === connection.source)

        const connectionCheck = validateSeedanceConnection(connection, nodes, edges)
        if (!connectionCheck.ok) {
          get().addLogForSession(activeSessionId, {
            nodeId: connection.target ?? 'system',
            nodeTitle: target?.data.title ?? 'Seedance 生成',
            message: connectionCheck.reason,
            level: 'error',
          })
          return
        }

        let nextNodes = nodes

        if (
          target?.data.type === NodeType.Seedance
          && source?.data.type === NodeType.TextPrompt
          && source.data.prompt.trim()
          && !readSeedanceNodePrompt(target.data)
        ) {
          const importedPrompt = source.data.prompt
          nextNodes = nodes.map(node =>
            node.id === target.id && node.data.type === NodeType.Seedance
              ? { ...node, data: { ...node.data, prompt: importedPrompt } }
              : node,
          )
        }

        const nextEdges = addEdge({ ...connection, type: 'custom' }, edges)

        if (target?.data.type === NodeType.Seedance) {
          const mode = target.data.generationMode ?? 'text_to_video'
          nextNodes = applySeedanceImageRolesForMode(target.id, mode, nextNodes, nextEdges)
        }

        get().patchSession(activeSessionId, s => ({ ...s, nodes: nextNodes, edges: nextEdges }))
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

      appendOutputVideo: (nodeId, item) => {
        get().appendOutputVideoForSession(get().activeSessionId, nodeId, item)
      },

      appendOutputVideoForSession: (sessionId, nodeId, item) => {
        get().patchSession(sessionId, session => {
          const node = session.nodes.find(n => n.id === nodeId)
          if (!node || node.data.type !== NodeType.Output)
            return session

          const historyItem: VideoHistoryItem = { ...item, id: uuidv4() }
          const videoHistory = [historyItem, ...(node.data.videoHistory ?? [])]

          return {
            ...session,
            nodes: session.nodes.map(n =>
              n.id === nodeId
                ? {
                    ...n,
                    data: {
                      ...n.data,
                      type: NodeType.Output,
                      videoUrl: item.videoUrl,
                      videoHistory,
                      status: 'succeeded',
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

        const id = `${type}-${uuidv4().slice(0, 8)}`
        const count = session.nodes.filter(n => n.data.type === type).length
        const baseData = createNodeData(type)
        const title = count > 0 ? `${baseData.title} ${count + 1}` : baseData.title

        get().patchSession(activeSessionId, s => ({
          ...s,
          nodes: [
            ...s.nodes,
            {
              id,
              type: 'custom',
              position: position ?? { x: 120 + s.nodes.length * 40, y: 120 + s.nodes.length * 30 },
              data: { ...baseData, title },
            },
          ],
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

      setSessionWorkflowMeta: (sessionId, workflowId, name) => {
        get().patchSession(sessionId, session => ({
          ...session,
          workflowId,
          name,
        }))
      },

      runSeedanceNode: async (seedanceNodeId, sessionId) => {
        const id = sessionId ?? get().activeSessionId
        const session = get().sessions.find(s => s.id === id)
        if (!session)
          return

        const target = session.nodes.find(n => n.id === seedanceNodeId)
        if (!target || target.data.type !== NodeType.Seedance)
          return

        if (target.data.status === 'running')
          return

        const deps = {
          upsertLocalTask: useTaskQueueStore.getState().upsertLocalTask,
          updateNodeData: (nodeId: string, data: Partial<WorkflowNodeData>) => {
            get().updateNodeDataForSession(id, nodeId, data)
            set(state => ({
              sessions: syncSessionRunningState(state.sessions, id),
            }))
          },
          appendOutputVideo: (nodeId: string, item: Omit<VideoHistoryItem, 'id'>) => {
            get().appendOutputVideoForSession(id, nodeId, item)
          },
          addLog: (entry: Omit<RunLogEntry, 'id' | 'timestamp'>) => {
            get().addLogForSession(id, entry)
          },
          clearLogs: () => {
            get().clearLogsForSession(id)
          },
          getNodes: () => get().sessions.find(s => s.id === id)?.nodes ?? [],
          getEdges: () => get().sessions.find(s => s.id === id)?.edges ?? [],
        }

        try {
          const latestSession = get().sessions.find(s => s.id === id)
          if (!latestSession)
            return
          await runSeedanceNodeSession(latestSession, seedanceNodeId, deps)
        }
        catch (error) {
          const message = error instanceof Error ? error.message : '运行失败'
          deps.addLog({
            nodeId: seedanceNodeId,
            nodeTitle: target.data.title,
            message,
            level: 'error',
          })
        }
        finally {
          set(state => ({
            sessions: syncSessionRunningState(state.sessions, id),
          }))
        }
      },
    }),
    {
      name: 'seedance-studio-workflow',
      storage: createJSONStorage(() => localStorage),
      partialize: state => ({
        sessions: state.sessions.map(session => ({
          id: session.id,
          workflowId: session.workflowId,
          name: session.name,
          nodes: session.nodes,
          edges: session.edges,
        })),
        activeSessionId: state.activeSessionId,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state)
          return

        // Migrate legacy single-workflow persist shape
        const legacy = state as WorkflowStoreInternal & {
          nodes?: WorkflowNode[]
          edges?: WorkflowEdge[]
          workflowId?: string | null
          workflowName?: string
        }

        if (!state.sessions?.length && legacy.nodes && legacy.edges) {
          const session = createWorkflowSession({
            name: legacy.workflowName ?? '示例工作流',
            workflowId: legacy.workflowId ?? null,
            nodes: legacy.nodes,
            edges: legacy.edges,
          })
          state.sessions = [session]
          state.activeSessionId = session.id
        }

        state.sessions = state.sessions.map(session => ({
          ...session,
          isRunning: false,
          runLogs: [],
          selectedNodeId: null,
          videoHistoryModalNodeId: null,
          nodes: normalizeWorkflowImageRoles(session.nodes, session.edges),
        }))

        if (!state.sessions.some(s => s.id === state.activeSessionId))
          state.activeSessionId = state.sessions[0]?.id ?? initialSession.id
      },
    },
  ),
)
