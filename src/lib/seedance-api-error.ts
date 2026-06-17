export class SeedanceApiError extends Error {
  readonly code?: string
  readonly status?: number

  constructor(message: string, options?: { code?: string, status?: number }) {
    super(message)
    this.name = 'SeedanceApiError'
    this.code = options?.code
    this.status = options?.status
  }
}

export function extractSeedanceApiErrorPayload(data: unknown): { message: string, code?: string } {
  if (!data || typeof data !== 'object')
    return { message: '请求失败' }

  const record = data as {
    message?: string
    error?: { message?: string, code?: string } | string
    code?: string
  }

  if (typeof record.error === 'string')
    return { message: record.error, code: record.code }

  const message = record.error?.message || record.message || '请求失败'
  const code = record.error?.code || record.code
  return { message, code }
}

export function createSeedanceApiError(
  data: unknown,
  fallbackMessage: string,
  status?: number,
): SeedanceApiError {
  const { message, code } = extractSeedanceApiErrorPayload(data)
  return new SeedanceApiError(message || fallbackMessage, { code, status })
}

export function isNonRetryableSeedanceError(message: string, code?: string | null): boolean {
  const normalized = `${code ?? ''} ${message}`.toLowerCase()
  if (normalized.includes('playground') || /cannot invoke the model|only available in the playground/i.test(normalized))
    return true

  return /api key|authentication|unauthorized|forbidden|invalid_api_key|missing_api_key|invalid task|task_not_found|invalid_task_id|quota_exceeded|insufficient/.test(normalized)
}
