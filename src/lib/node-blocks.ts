import { NodeType } from './types'

export type WorkflowNodeBlock = {
  type: NodeType
  label: string
  desc: string
}

export const WORKFLOW_NODE_BLOCKS: WorkflowNodeBlock[] = [
  { type: NodeType.TextPrompt, label: '文本提示词', desc: '描述你想生成的视频内容' },
  { type: NodeType.ImageInput, label: '参考图片', desc: '拖拽或点击上传，支持首尾帧 / 全能参考' },
  { type: NodeType.VideoInput, label: '参考视频', desc: '全能参考模式最多 3 个（MP4/WebM）' },
  { type: NodeType.AudioInput, label: '参考音频', desc: '全能参考模式最多 3 个（MP3/WAV）' },
  { type: NodeType.Seedance, label: 'Seedance 生成', desc: '调用火山引擎视频模型' },
  { type: NodeType.Output, label: '视频输出', desc: '预览与下载生成结果' },
]

export function getNodeBlock(type: NodeType): WorkflowNodeBlock | undefined {
  return WORKFLOW_NODE_BLOCKS.find(block => block.type === type)
}
