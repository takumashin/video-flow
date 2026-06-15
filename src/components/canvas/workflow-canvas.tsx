'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import ReactFlow, {
  Background,
  BackgroundVariant,
  SelectionMode,
  useReactFlow,
  type HandleType,
  type NodeChange,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { FileAudio, FileVideo, ImagePlus } from 'lucide-react'
import CustomEdge from './custom-edge'
import CustomNode from './custom-node'
import CanvasOperator from './operator'
import ConnectNodeMenu, { resolveConnectNodePosition, type ConnectNodeMenuState } from './connect-node-menu'
import SnapGuideLines from './snap-guide-lines'
import { useActiveWorkflowSession } from '@/components/workflow-tabs'
import { useWorkflowStore } from '@/store/workflow-store'
import { useThemeStore } from '@/store/theme-store'
import type { WorkflowNode } from '@/lib/types'
import { NodeType } from '@/lib/types'
import type { ConnectHandleSide } from '@/lib/connect-node-options'
import { getImageFiles, processImageFiles } from '@/lib/image-upload'
import { processAudioFiles, processVideoFiles } from '@/lib/media-upload'
import {
  detectDragFileKinds,
  getAudioFiles,
  getVideoFiles,
  type DragFileKind,
} from '@/lib/media-upload-shared'
import { hasAssetDrag, readAssetDragData } from '@/lib/asset-drag'
import { validateSeedanceConnection, type ConnectionEndpoints } from '@/lib/seedance-connection-rules'
import { getConnectableNodeTypes } from '@/lib/connect-node-options'
import { snapNodePosition, type SnapGuide } from '@/lib/node-snap'
import { useAssetLibraryStore } from '@/store/asset-library-store'

const nodeTypes = { custom: CustomNode }
const edgeTypes = { custom: CustomEdge }

type FileDragState = {
  active: boolean
  kinds: DragFileKind[]
}

const EMPTY_FILE_DRAG: FileDragState = { active: false, kinds: [] }

function getDragOverlayMessage(kinds: DragFileKind[]): { title: string; hint: string } {
  const hasImage = kinds.includes('image')
  const hasVideo = kinds.includes('video')
  const hasAudio = kinds.includes('audio')
  const onlyUnknown = kinds.length === 1 && kinds[0] === 'unknown'

  if (onlyUnknown || (hasImage && hasVideo && hasAudio))
    return {
      title: '松开鼠标添加参考素材',
      hint: '支持图片、视频、音频文件',
    }

  if (hasVideo && !hasImage && !hasAudio)
    return {
      title: '松开鼠标添加参考视频',
      hint: '将创建「参考视频」节点（MP4 / WebM / MOV）',
    }

  if (hasAudio && !hasImage && !hasVideo)
    return {
      title: '松开鼠标添加参考音频',
      hint: '将创建「参考音频」节点（MP3 / WAV / M4A）',
    }

  if (hasImage && !hasVideo && !hasAudio)
    return {
      title: '松开鼠标添加参考图片',
      hint: '支持拖拽多张图片到画布',
    }

  return {
    title: '松开鼠标添加参考素材',
    hint: '图片 / 视频 / 音频将创建对应节点',
  }
}

function WorkflowCanvasInner() {
  const activeSession = useActiveWorkflowSession()
  const nodes = activeSession?.nodes ?? []
  const edges = activeSession?.edges ?? []
  const isRunning = activeSession?.isRunning ?? false
  const onNodesChange = useWorkflowStore(s => s.onNodesChange)
  const onEdgesChange = useWorkflowStore(s => s.onEdgesChange)
  const onConnect = useWorkflowStore(s => s.onConnect)
  const addConnectedNode = useWorkflowStore(s => s.addConnectedNode)
  const selectNode = useWorkflowStore(s => s.selectNode)
  const openVideoHistoryModal = useWorkflowStore(s => s.openVideoHistoryModal)
  const addImageNode = useWorkflowStore(s => s.addImageNode)
  const addVideoNode = useWorkflowStore(s => s.addVideoNode)
  const addAudioNode = useWorkflowStore(s => s.addAudioNode)
  const addLog = useWorkflowStore(s => s.addLog)
  const resolvedTheme = useThemeStore(s => s.resolvedTheme)
  const { screenToFlowPosition } = useReactFlow()
  const containerRef = useRef<HTMLDivElement>(null)
  const selectedNodeId = activeSession?.selectedNodeId ?? null
  const flowNodes = nodes.map(node => ({
    ...node,
    selected: node.id === selectedNodeId,
    draggable:
      !isRunning
      || node.data.type !== NodeType.Seedance
      || node.data.status !== 'running',
  }))

  const flowEdges = edges.map(edge => ({
    ...edge,
    selected: edge.selected
      || (selectedNodeId != null && (edge.source === selectedNodeId || edge.target === selectedNodeId)),
  }))

  const [fileDrag, setFileDrag] = useState<FileDragState>(EMPTY_FILE_DRAG)
  const [assetDragActive, setAssetDragActive] = useState(false)
  const draggingAssetKind = useAssetLibraryStore(s => s.draggingAssetKind)
  const setDraggingAssetKind = useAssetLibraryStore(s => s.setDraggingAssetKind)
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([])
  const [connectMenu, setConnectMenu] = useState<ConnectNodeMenuState | null>(null)
  const connectContextRef = useRef<{
    nodeId: string
    handleType: ConnectHandleSide
  } | null>(null)
  const connectSucceededRef = useRef(false)

  const closeConnectMenu = useCallback(() => {
    setConnectMenu(null)
    connectContextRef.current = null
  }, [])

  const handleConnect = useCallback((connection: Parameters<typeof onConnect>[0]) => {
    connectSucceededRef.current = true
    onConnect(connection)
  }, [onConnect])

  const handleConnectStart = useCallback((
    _: React.MouseEvent | React.TouchEvent,
    params: { nodeId: string | null; handleType: HandleType | null },
  ) => {
    connectSucceededRef.current = false
    if (!params.nodeId || !params.handleType)
      return

    connectContextRef.current = {
      nodeId: params.nodeId,
      handleType: params.handleType,
    }
  }, [])

  const handleConnectEnd = useCallback((event: MouseEvent | TouchEvent) => {
    const context = connectContextRef.current
    connectContextRef.current = null

    if (connectSucceededRef.current || !context || isRunning)
      return

    const clientX = 'clientX' in event ? event.clientX : event.changedTouches[0]?.clientX
    const clientY = 'clientY' in event ? event.clientY : event.changedTouches[0]?.clientY
    if (clientX == null || clientY == null)
      return

    const dropTarget = document.elementFromPoint(clientX, clientY)
    if (!dropTarget?.closest('.react-flow__pane'))
      return

    if (dropTarget.closest('.react-flow__node') || dropTarget.closest('.react-flow__handle'))
      return

    const container = containerRef.current
    if (!container)
      return

    const containerRect = container.getBoundingClientRect()
    const menuState: ConnectNodeMenuState = {
      anchorNodeId: context.nodeId,
      handleType: context.handleType,
      screenX: clientX - containerRect.left,
      screenY: clientY - containerRect.top,
      flowPosition: screenToFlowPosition({ x: clientX, y: clientY }),
    }

    const connectableTypes = getConnectableNodeTypes(
      { nodeId: context.nodeId, handleType: context.handleType },
      nodes,
      edges,
    )

    if (connectableTypes.length === 1) {
      addConnectedNode(
        connectableTypes[0]!,
        resolveConnectNodePosition(menuState, connectableTypes[0]!),
        { nodeId: context.nodeId, handleType: context.handleType },
      )
      return
    }

    setConnectMenu(menuState)
  }, [addConnectedNode, edges, isRunning, nodes, screenToFlowPosition])

  const handleConnectNodeSelect = useCallback((
    type: NodeType,
    menu: ConnectNodeMenuState,
  ) => {
    addConnectedNode(
      type,
      resolveConnectNodePosition(menu, type),
      { nodeId: menu.anchorNodeId, handleType: menu.handleType },
    )
    closeConnectMenu()
  }, [addConnectedNode, closeConnectMenu])

  useEffect(() => {
    const clearFileDrag = () => {
      setFileDrag(EMPTY_FILE_DRAG)
      setAssetDragActive(false)
      setDraggingAssetKind(null)
    }
    document.addEventListener('dragend', clearFileDrag)
    return () => document.removeEventListener('dragend', clearFileDrag)
  }, [setDraggingAssetKind])

  const handleNodesChange = useCallback((changes: NodeChange[]) => {
    const draggingChange = changes.find(
      change => change.type === 'position' && change.dragging && change.position,
    )

    if (draggingChange?.type === 'position' && draggingChange.position) {
      const node = nodes.find(n => n.id === draggingChange.id)
      if (node) {
        const snap = snapNodePosition(node, draggingChange.position, nodes)
        setSnapGuides(snap.guides)
        onNodesChange(changes.map(change =>
          change.type === 'position' && change.id === draggingChange.id
            ? { ...change, position: snap.position }
            : change,
        ))
        return
      }
    }

    if (changes.some(change => change.type === 'position' && change.dragging === false))
      setSnapGuides([])

    onNodesChange(changes)
  }, [nodes, onNodesChange])

  const isValidConnection = useCallback(
    (connection: ConnectionEndpoints) => validateSeedanceConnection(connection, nodes, edges).ok,
    [nodes, edges],
  )

  const onPaneClick = useCallback(() => {
    closeConnectMenu()
    selectNode(null)
  }, [closeConnectMenu, selectNode])

  const onNodeClick = useCallback((_: React.MouseEvent, node: WorkflowNode) => {
    selectNode(node.id)
    if (node.data.type === NodeType.Output)
      openVideoHistoryModal(node.id)
  }, [openVideoHistoryModal, selectNode])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    if (isRunning)
      return

    if (hasAssetDrag(e.dataTransfer)) {
      e.dataTransfer.dropEffect = 'copy'
      setAssetDragActive(true)
      setFileDrag(EMPTY_FILE_DRAG)
      return
    }

    const kinds = detectDragFileKinds(e.dataTransfer)
    if (kinds.length === 0)
      return
    e.dataTransfer.dropEffect = 'copy'
    setFileDrag({ active: true, kinds })
    setAssetDragActive(false)
  }, [isRunning])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    if (e.currentTarget === e.target) {
      setFileDrag(EMPTY_FILE_DRAG)
      setAssetDragActive(false)
    }
  }, [])

  const onDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    setFileDrag(EMPTY_FILE_DRAG)
    setAssetDragActive(false)
    setDraggingAssetKind(null)

    if (isRunning)
      return

    const asset = readAssetDragData(e.dataTransfer)
    if (asset) {
      const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
      const label = asset.kind === 'image' ? '参考图片' : asset.kind === 'video' ? '参考视频' : '参考音频'
      if (asset.kind === 'image')
        addImageNode(asset.url, position)
      else if (asset.kind === 'video')
        addVideoNode(asset.url, position)
      else
        addAudioNode(asset.url, position)

      addLog({
        nodeId: 'system',
        nodeTitle: '系统',
        message: `已从资产库拖入${label}`,
        level: 'success',
      })
      return
    }

    const fileList = e.dataTransfer.files
    const images = getImageFiles(fileList)
    const videos = getVideoFiles(fileList)
    const audios = getAudioFiles(fileList)

    if (images.length === 0 && videos.length === 0 && audios.length === 0)
      return

    const position = screenToFlowPosition({ x: e.clientX, y: e.clientY })
    let offset = 0

    const nextPosition = () => ({
      x: position.x + offset * 32,
      y: position.y + offset * 32,
    })

    try {
      if (images.length > 0) {
        const imageUrls = await processImageFiles(images)
        imageUrls.forEach(imageUrl => {
          addImageNode(imageUrl, nextPosition())
          offset += 1
        })
        addLog({
          nodeId: 'system',
          nodeTitle: '系统',
          message: `已添加 ${imageUrls.length} 张参考图片`,
          level: 'success',
        })
      }

      if (videos.length > 0) {
        const videoUrls = await processVideoFiles(videos)
        videoUrls.forEach(mediaUrl => {
          addVideoNode(mediaUrl, nextPosition())
          offset += 1
        })
        addLog({
          nodeId: 'system',
          nodeTitle: '系统',
          message: `已添加 ${videoUrls.length} 个参考视频`,
          level: 'success',
        })
      }

      if (audios.length > 0) {
        const audioUrls = await processAudioFiles(audios)
        audioUrls.forEach(mediaUrl => {
          addAudioNode(mediaUrl, nextPosition())
          offset += 1
        })
        addLog({
          nodeId: 'system',
          nodeTitle: '系统',
          message: `已添加 ${audioUrls.length} 个参考音频`,
          level: 'success',
        })
      }

      if (images.length > 0 || videos.length > 0 || audios.length > 0)
        useAssetLibraryStore.getState().bumpRefresh()
    }
    catch (error) {
      const message = error instanceof Error ? error.message : '文件上传失败'
      addLog({
        nodeId: 'system',
        nodeTitle: '系统',
        message,
        level: 'error',
      })
    }
  }, [addAudioNode, addImageNode, addLog, addVideoNode, isRunning, screenToFlowPosition, setDraggingAssetKind])

  const overlayMessage = assetDragActive
    ? {
        title: '松开鼠标添加资产',
        hint: draggingAssetKind === 'video'
          ? '将创建「参考视频」节点'
          : draggingAssetKind === 'audio'
            ? '将创建「参考音频」节点'
            : '将创建「参考图片」节点',
      }
    : getDragOverlayMessage(fileDrag.kinds)

  const overlayIcon = assetDragActive
    ? (draggingAssetKind === 'video'
        ? FileVideo
        : draggingAssetKind === 'audio'
          ? FileAudio
          : ImagePlus)
    : fileDrag.kinds.includes('video') && !fileDrag.kinds.includes('image')
      ? FileVideo
      : fileDrag.kinds.includes('audio') && !fileDrag.kinds.includes('image') && !fileDrag.kinds.includes('video')
        ? FileAudio
        : ImagePlus
  const OverlayIcon = overlayIcon

  return (
    <div id="workflow-container" ref={containerRef} className="relative h-full w-full">
      <ReactFlow
        nodes={flowNodes}
        edges={flowEdges}
        onNodesChange={handleNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={handleConnect}
        onConnectStart={handleConnectStart}
        onConnectEnd={handleConnectEnd}
        isValidConnection={isValidConnection}
        nodesConnectable={!isRunning}
        onPaneClick={onPaneClick}
        onNodeClick={onNodeClick}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.2}
        maxZoom={2}
        deleteKeyCode={['Backspace', 'Delete']}
        selectionMode={SelectionMode.Partial}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={16}
          size={1}
          color={resolvedTheme === 'dark' ? '#2a3140' : '#D0D5DD'}
        />
        <SnapGuideLines guides={snapGuides} />
        <CanvasOperator />
      </ReactFlow>

      {(fileDrag.active || assetDragActive) && (
        <div className="pointer-events-none absolute inset-4 z-10 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary-light bg-primary/5 backdrop-blur-[1px]">
          <div className="flex flex-col items-center gap-2 rounded-xl bg-surface/95 px-8 py-6 shadow-lg">
            <OverlayIcon className="h-8 w-8 text-primary-light" />
            <p className="text-sm font-medium text-foreground">{overlayMessage.title}</p>
            <p className="text-xs text-muted">{overlayMessage.hint}</p>
          </div>
        </div>
      )}

      <ConnectNodeMenu
        menu={connectMenu}
        nodes={nodes}
        edges={edges}
        onSelect={handleConnectNodeSelect}
        onClose={closeConnectMenu}
      />

    </div>
  )
}

export default function WorkflowCanvas() {
  return <WorkflowCanvasInner />
}
