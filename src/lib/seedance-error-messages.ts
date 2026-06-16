const REQUEST_ID_PATTERN = /\brequest\s*id\s*:\s*(\S+)/i
const CHINESE_REQUEST_ID_PATTERN = /（请求 ID：[^）]+）/

function extractRequestId(message: string): string | undefined {
  const english = message.match(REQUEST_ID_PATTERN)?.[1]
  if (english)
    return english

  return message.match(/（请求 ID：([^）]+)）/)?.[1]
}

function stripRequestId(message: string): string {
  return message
    .replace(REQUEST_ID_PATTERN, '')
    .replace(CHINESE_REQUEST_ID_PATTERN, '')
    .replace(/\s+$/, '')
}

function withRequestId(message: string, requestId?: string): string {
  if (!requestId || CHINESE_REQUEST_ID_PATTERN.test(message))
    return message

  return `${message}（请求 ID：${requestId}）`
}

function isMostlyChinese(message: string): boolean {
  const cjkCount = (message.match(/[\u4e00-\u9fff]/g) ?? []).length
  return cjkCount > 0 && cjkCount >= message.replace(/\s/g, '').length * 0.3
}

/** 火山 Seedance / Ark 常见 error.code 映射（见方舟文档与网关返回） */
const ERROR_CODE_MAP: Record<string, string> = {
  missing_prompt: '请填写视频生成提示词。',
  invalid_prompt: '提示词无效或为空，请修改后重试。',
  prompt_too_long: '提示词过长，请缩短后重试。',
  invalid_size: '视频尺寸或分辨率参数无效，请检查后重试。',
  invalid_resolution: '视频分辨率不支持，请更换参数后重试。',
  invalid_aspect_ratio: '视频宽高比不支持，请更换参数后重试。',
  invalid_duration: '视频时长参数无效，请检查后重试。',
  audio_requires_reference: '该模型生成音频需要提供参考素材，请上传参考图或参考视频后重试。',
  missing_reference: '缺少必需的参考素材，请上传参考图或参考视频后重试。',
  invalid_reference: '参考素材无效或格式不支持，请更换后重试。',
  missing_api_key: '服务未配置 API Key，请联系管理员。',
  invalid_api_key: 'API Key 无效或已过期，请联系管理员。',
  authentication_required: '未授权访问，请重新登录或联系管理员。',
  unauthorized: '未授权访问，请重新登录或联系管理员。',
  forbidden: '无权执行此操作。',
  invalid_task_id: '任务 ID 无效或不存在。',
  task_not_found: '任务不存在或已过期。',
  rate_limit_exceeded: '请求过于频繁，请稍后再试。',
  too_many_requests: '请求过于频繁，请稍后再试。',
  quota_exceeded: '已达到用量上限，请稍后再试或联系管理员。',
  insufficient_credits: '账户点数不足，请充值后再试。',
  insufficient_balance: '账户余额不足，请充值后再试。',
  copyright: '生成失败：输出视频可能涉及版权限制，请调整提示词或参考素材后重试。',
  copyright_violation: '生成失败：输出视频可能涉及版权限制，请调整提示词或参考素材后重试。',
  content_policy_violation: '生成失败：内容不符合平台安全策略，请调整提示词或参考素材后重试。',
  moderation_failed: '生成失败：内容未通过安全审核，请调整提示词或参考素材后重试。',
  safety_filter: '生成失败：内容未通过安全审核，请调整提示词或参考素材后重试。',
  content_filter: '生成失败：内容未通过安全审核，请调整提示词或参考素材后重试。',
  blocked: '生成失败：内容被安全策略拦截，请调整提示词或参考素材后重试。',
  internal_error: '服务内部错误，请稍后重试。',
  internal_server_error: '服务内部错误，请稍后重试。',
  server_error: '服务内部错误，请稍后重试。',
  service_unavailable: '服务暂时不可用，请稍后重试。',
  timeout: '视频生成超时，请稍后重试。',
  deadline_exceeded: '视频生成超时，请稍后重试。',
  request_timeout: '请求超时，请稍后重试。',
  invalid_request: '请求参数无效，请检查后重试。',
  bad_request: '请求参数无效，请检查后重试。',
  invalid_parameter: '请求参数无效，请检查后重试。',
  validation_error: '请求参数校验失败，请检查后重试。',
  model_not_found: '所选模型不可用，请更换模型后重试。',
  model_unavailable: '所选模型暂时不可用，请稍后重试或更换模型。',
  resource_exhausted: '服务资源繁忙，请稍后重试。',
  payload_too_large: '上传文件过大，请压缩或更换素材后重试。',
  unsupported_media_type: '不支持的文件格式，请更换素材后重试。',
  generation_failed: '视频生成失败，请稍后重试。',
}

function normalizeErrorCode(code: string): string {
  return code.trim().toLowerCase().replace(/[-\s]+/g, '_')
}

function lookupErrorCode(code: string | null | undefined): string | undefined {
  if (!code?.trim())
    return undefined

  const normalized = normalizeErrorCode(code)
  return ERROR_CODE_MAP[normalized] ?? ERROR_CODE_MAP[code.trim()]
}

type ErrorRule = {
  test: (message: string) => boolean
  toChinese: (message: string) => string
}

const ERROR_RULES: ErrorRule[] = [
  {
    test: message => /copyright/i.test(message),
    toChinese: () => '生成失败：输出视频可能涉及版权限制，请调整提示词或参考素材后重试。',
  },
  {
    test: message => /missing[_\s-]?prompt|prompt.*required|empty prompt/i.test(message),
    toChinese: () => '请填写视频生成提示词。',
  },
  {
    test: message => /invalid[_\s-]?size|invalid[_\s-]?resolution|unsupported resolution|aspect ratio/i.test(message),
    toChinese: () => '视频尺寸或分辨率参数无效，请检查后重试。',
  },
  {
    test: message => /audio.*reference|reference.*audio|requires reference/i.test(message),
    toChinese: () => '该模型生成音频需要提供参考素材，请上传参考图或参考视频后重试。',
  },
  {
    test: message => /missing[_\s-]?api[_\s-]?key|api key.*not/i.test(message),
    toChinese: () => '服务未配置 API Key，请联系管理员。',
  },
  {
    test: message => /invalid[_\s-]?api[_\s-]?key|unauthorized|authentication/i.test(message),
    toChinese: () => 'API Key 无效或未授权，请联系管理员。',
  },
  {
    test: message => /invalid[_\s-]?task[_\s-]?id|task.*not found/i.test(message),
    toChinese: () => '任务 ID 无效或不存在。',
  },
  {
    test: message => /rate[_\s-]?limit|too many requests/i.test(message),
    toChinese: () => '请求过于频繁，请稍后再试。',
  },
  {
    test: message => /insufficient[_\s-]?(credits|balance)|not enough credits|余额不足|点数不足/i.test(message),
    toChinese: () => '账户点数不足，请充值后再试。',
  },
  {
    test: message =>
      /moderation|content.?policy|safety|inappropriate|blocked|risk|审核|审查|违规|敏感|内容安全|安全策略|涉黄|暴力|policy violation/i.test(message),
    toChinese: () => '生成失败：内容未通过安全审核，请调整提示词或参考素材后重试。',
  },
  {
    test: message => /timeout|timed out|deadline exceeded/i.test(message),
    toChinese: () => '视频生成超时，请稍后重试。',
  },
  {
    test: message => /internal[_\s-]?error|server error|service unavailable|502|503|504/i.test(message),
    toChinese: () => '服务内部错误，请稍后重试。',
  },
  {
    test: message => /invalid request|bad request|validation failed|invalid parameter/i.test(message),
    toChinese: () => '请求参数无效，请检查后重试。',
  },
  {
    test: message => /model.*not found|model.*unavailable/i.test(message),
    toChinese: () => '所选模型不可用，请更换模型后重试。',
  },
  {
    test: message => /payload too large|file too large|size limit/i.test(message),
    toChinese: () => '上传文件过大，请压缩或更换素材后重试。',
  },
  {
    test: message => /unsupported (media|file|format|type)/i.test(message),
    toChinese: () => '不支持的文件格式，请更换素材后重试。',
  },
  {
    test: message => /resource exhausted|capacity|overloaded/i.test(message),
    toChinese: () => '服务资源繁忙，请稍后重试。',
  },
  {
    test: message => /generation failed|failed to generate|video generation failed/i.test(message),
    toChinese: () => '视频生成失败，请稍后重试。',
  },
]

/** 将火山 Seedance 英文错误转为用户可读的中文说明（保留请求 ID 便于排查） */
export function localizeSeedanceErrorMessage(
  message: string | null | undefined,
  code?: string | null,
): string | undefined {
  const trimmed = message?.trim()
  if (!trimmed && !code?.trim())
    return undefined

  const requestId = trimmed ? extractRequestId(trimmed) : undefined
  const body = trimmed ? stripRequestId(trimmed) : ''

  if (body && isMostlyChinese(body))
    return withRequestId(body, requestId)

  const codeMessage = lookupErrorCode(code)
  if (codeMessage)
    return withRequestId(codeMessage, requestId)

  for (const rule of ERROR_RULES) {
    if (body && rule.test(body))
      return withRequestId(rule.toChinese(body), requestId)
  }

  if (trimmed)
    return trimmed

  return withRequestId('视频生成失败，请稍后重试。', requestId)
}

/** 生成流程中写入节点/日志时使用，保证始终有中文 fallback */
export function formatSeedanceUserError(
  message: string | null | undefined,
  code?: string | null,
  fallback = '视频生成失败',
): string {
  return localizeSeedanceErrorMessage(message, code) ?? fallback
}
