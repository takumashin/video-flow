import type { SeedanceGenerationMode } from './types'

export type SeedanceModelOption = {
  id: string
  label: string
  description: string
  creditCost: number
  supportedModes: SeedanceGenerationMode[]
  supportsAudio: boolean
  docUrl?: string
}

/**
 * 火山方舟视频生成 API `model` 字段官方 Model ID 列表
 * @see https://www.volcengine.com/docs/82379/1520757
 */
export const SEEDANCE_MODELS: SeedanceModelOption[] = [
  {
    id: 'doubao-seedance-2-0-260128',
    label: 'Seedance 2.0',
    description: '多模态参考、首尾帧、文生/图生视频，支持有声视频',
    creditCost: 500,
    supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame', 'omni_reference'],
    supportsAudio: true,
    docUrl: 'https://www.volcengine.com/docs/82379/2291680',
  },
  {
    id: 'doubao-seedance-2-0-fast-260128',
    label: 'Seedance 2.0 Fast',
    description: '2.0 快速版，支持多模态参考与首尾帧',
    creditCost: 400,
    supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame', 'omni_reference'],
    supportsAudio: true,
    docUrl: 'https://www.volcengine.com/docs/82379/2291680',
  },
  {
    id: 'doubao-seedance-1-5-pro-251215',
    label: 'Seedance 1.5 Pro',
    description: '首尾帧、图生视频，支持生成音频（推荐通用）',
    creditCost: 300,
    supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame'],
    supportsAudio: true,
    docUrl: 'https://www.volcengine.com/docs/82379/1520757',
  },
  {
    id: 'doubao-seedance-1-0-pro-250528',
    label: 'Seedance 1.0 Pro',
    description: '首尾帧、图生视频，1080P 高清，不支持音频',
    creditCost: 200,
    supportedModes: ['text_to_video', 'image_to_video', 'first_last_frame'],
    supportsAudio: false,
    docUrl: 'https://www.volcengine.com/docs/82379/1520757',
  },
  {
    id: 'doubao-seedance-1-0-pro-fast-251015',
    label: 'Seedance 1.0 Pro Fast',
    description: '快速生成，仅支持文生视频与首帧图生视频',
    creditCost: 200,
    supportedModes: ['text_to_video', 'image_to_video'],
    supportsAudio: false,
    docUrl: 'https://www.volcengine.com/docs/82379/1520757',
  },
]

export const CUSTOM_MODEL_VALUE = '__custom_endpoint__'

export const DEFAULT_MODEL_BY_MODE: Record<SeedanceGenerationMode, string> = {
  text_to_video: 'doubao-seedance-1-5-pro-251215',
  image_to_video: 'doubao-seedance-1-5-pro-251215',
  first_last_frame: 'doubao-seedance-1-5-pro-251215',
  omni_reference: 'doubao-seedance-2-0-260128',
}

export function isEndpointId(value: string): boolean {
  return /^ep-\d/i.test(value.trim())
}

export function isKnownModelId(modelId: string): boolean {
  return SEEDANCE_MODELS.some(model => model.id === modelId)
}

export function getModelOption(modelId: string): SeedanceModelOption | undefined {
  return SEEDANCE_MODELS.find(model => model.id === modelId)
}

export function getDefaultModelForMode(mode: SeedanceGenerationMode): string {
  return DEFAULT_MODEL_BY_MODE[mode]
}

export function getModelsForMode(mode: SeedanceGenerationMode): SeedanceModelOption[] {
  return SEEDANCE_MODELS.filter(model => model.supportedModes.includes(mode))
}

export function resolveSeedanceModel(
  model: string | undefined,
  mode: SeedanceGenerationMode,
  envDefault?: string,
): string {
  const trimmed = model?.trim()
  if (trimmed)
    return trimmed

  if (envDefault?.trim())
    return envDefault.trim()

  return getDefaultModelForMode(mode)
}

export function getRecommendedModelForModeChange(
  mode: SeedanceGenerationMode,
  currentModel: string,
): string {
  const compatible = getModelsForMode(mode)
  if (compatible.some(model => model.id === currentModel))
    return currentModel
  return getDefaultModelForMode(mode)
}

export function shouldDisableAudio(modelId: string): boolean {
  const option = getModelOption(modelId)
  if (option)
    return !option.supportsAudio
  return false
}

/** 自定义 Endpoint 或未收录模型的默认扣点 */
export const DEFAULT_CUSTOM_MODEL_CREDIT_COST = 300

export function getSeedanceModelCreditCost(modelId: string): number {
  const option = getModelOption(modelId)
  if (option)
    return option.creditCost

  const normalized = modelId.trim().toLowerCase()
  if (normalized.includes('seedance-2-0-fast'))
    return 400
  if (normalized.includes('seedance-2-0'))
    return 500
  if (normalized.includes('seedance-1-5'))
    return 300
  if (normalized.includes('seedance-1-0'))
    return 200

  return DEFAULT_CUSTOM_MODEL_CREDIT_COST
}
