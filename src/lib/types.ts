import type { Edge, Node } from 'reactflow'

export enum NodeType {
  Start = 'start',
  TextPrompt = 'text_prompt',
  ImageInput = 'image_input',
  VideoInput = 'video_input',
  AudioInput = 'audio_input',
  Seedance = 'seedance',
  Output = 'output',
}

export type ImageRole = 'first_frame' | 'last_frame' | 'reference_image'

export type SeedanceGenerationMode =
  | 'text_to_video'
  | 'image_to_video'
  | 'first_last_frame'
  | 'omni_reference'

export type StartNodeData = {
  type: NodeType.Start
  title: string
}

export type TextPromptNodeData = {
  type: NodeType.TextPrompt
  title: string
  prompt: string
}

export type ImageInputNodeData = {
  type: NodeType.ImageInput
  title: string
  imageUrl: string
  role: ImageRole
}

export type VideoInputNodeData = {
  type: NodeType.VideoInput
  title: string
  mediaUrl: string
}

export type AudioInputNodeData = {
  type: NodeType.AudioInput
  title: string
  mediaUrl: string
}

export type SeedanceVideoResolution = '480p' | '720p' | '1080p'

export type SeedanceVideoRatio =
  | '16:9'
  | '9:16'
  | '1:1'
  | '4:3'
  | '3:4'
  | '21:9'
  | 'adaptive'

export type SeedanceTaskStatus = 'waiting' | 'submitting' | 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled'

export type SeedanceNodeData = {
  type: NodeType.Seedance
  title: string
  prompt: string
  generationMode: SeedanceGenerationMode
  model: string
  resolution: SeedanceVideoResolution
  ratio: SeedanceVideoRatio
  /** 4–15 秒，或 -1 表示智能时长 */
  duration: number
  /** -1 表示随机种子，≥0 为固定种子 */
  seed: number
  generateAudio: boolean
  watermark: boolean
  cameraFixed: boolean
  status: 'idle' | 'running' | 'succeeded' | 'failed'
  /** 火山任务状态（waiting/submitting/queued/running 等），用于节点内展示排队文案 */
  taskStatus?: SeedanceTaskStatus
  /** 系统排队序号（waiting 时有效） */
  queuePosition?: number
  /** 0–100，展示用假进度（基于 progressStartedAt 计算） */
  progress?: number
  /** 本次生成开始时间，用于假进度条 */
  progressStartedAt?: number
  taskId?: string
  error?: string
  videoUrl?: string
  videoHistory?: VideoHistoryItem[]
}

export type VideoHistoryItem = {
  id: string
  videoUrl: string
  taskId?: string
  createdAt: number
}

export type OutputNodeData = {
  type: NodeType.Output
  title: string
  videoUrl?: string
  videoHistory: VideoHistoryItem[]
  status: 'idle' | 'running' | 'succeeded' | 'failed'
}

export type WorkflowNodeData =
  | StartNodeData
  | TextPromptNodeData
  | ImageInputNodeData
  | VideoInputNodeData
  | AudioInputNodeData
  | SeedanceNodeData
  | OutputNodeData

export type WorkflowNode = Node<WorkflowNodeData>
export type WorkflowEdge = Edge

export type SavedWorkflow = {
  id: string
  name: string
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
  revision: number
  createdAt: number
  updatedAt: number
}

export type WorkflowSummary = Pick<SavedWorkflow, 'id' | 'name' | 'createdAt' | 'updatedAt'>

// ---- Workflow Version Management ----

export type WorkflowVersionType = 'auto' | 'manual' | 'restore' | 'merge'

export type WorkflowVersionSummary = {
  id: string
  workflowId: string
  revision: number
  branchName: string
  name: string
  label: string | null
  description: string | null
  type: WorkflowVersionType
  createdBy: string | null
  createdByName: string | null
  createdByImage: string | null
  createdAt: number
}

export type WorkflowVersionDetail = WorkflowVersionSummary & {
  nodes: WorkflowNode[]
  edges: WorkflowEdge[]
}

export type WorkflowDiffEntry = {
  type: 'added' | 'removed' | 'modified'
  id: string
  title?: string
  nodeType?: string
  source?: string
  target?: string
  changes?: Array<{ field: string; before: unknown; after: unknown }>
}

export type WorkflowDiffResult = {
  versionA: { id: string; revision: number; createdAt: number; label: string | null }
  versionB: { id: string; revision: number; createdAt: number; label: string | null }
  nodeChanges: WorkflowDiffEntry[]
  edgeChanges: WorkflowDiffEntry[]
}

export type WorkflowBranchStatus = 'active' | 'archived' | 'merged'

export type WorkflowBranch = {
  name: string
  status: WorkflowBranchStatus
  isMain: boolean
  latestRevision: number
  latestVersionId: string
  createdAt: number
  updatedAt: number
  createdBy: string | null
  createdByName: string | null
  description: string | null
}

export type ImageContentItem = {
  imageUrl: string
  imageRole: ImageRole
}

export type VideoContentItem = {
  videoUrl: string
}

export type AudioContentItem = {
  audioUrl: string
}

export type SeedanceCreateTaskRequest = {
  model: string
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string }; role?: ImageRole }
    | { type: 'video_url'; video_url: { url: string }; role?: 'reference_video' }
    | { type: 'audio_url'; audio_url: { url: string }; role?: 'reference_audio' }
  >
  generate_audio?: boolean
  resolution?: string
  ratio?: string
  duration?: number
  seed?: number
  camera_fixed?: boolean
  watermark?: boolean
}

export type SeedanceTaskResponse = {
  id: string
  status: SeedanceTaskStatus
  content?: {
    video_url?: string
    progress?: number | string
  } | null
  error?: {
    code?: string
    message?: string
  } | null
  created_at?: number | string
  updated_at?: number | string
  duration?: number | null
  frames?: number | null
  framespersecond?: number | null
  /** 部分网关或版本会在顶层返回进度（数字或 "45%" 字符串） */
  progress?: number | string
}

export type SeedanceTaskListItem = {
  id: string
  model?: string
  status: SeedanceTaskStatus
  content?: {
    video_url?: string
  }
  error?: {
    message?: string
    code?: string
  }
  usage?: {
    completion_tokens?: number
    total_tokens?: number
  }
  created_at?: number
  updated_at?: number
  /** 工作流或轮询写入的展示进度 */
  progress?: number
  prompt?: string
  nodeTitle?: string
  workflowId?: string
  nodeId?: string
  progressStartedAt?: number
  queuePosition?: number
}

export type SeedanceTaskListResponse = {
  total: number
  items: SeedanceTaskListItem[]
}

export type ListSeedanceTasksOptions = {
  pageNum?: number
  pageSize?: number
  status?: SeedanceTaskStatus | ''
  taskIds?: string[]
}

export type RunLogEntry = {
  id: string
  nodeId: string
  nodeTitle: string
  message: string
  level: 'info' | 'success' | 'error'
  timestamp: number
}
