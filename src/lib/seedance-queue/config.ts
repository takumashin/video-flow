/**
 * 火山方舟 Seedance 官方并发参考（default 在线推理）：
 * - Pro / 2.0 系列：并发 10，RPM 600
 * - Lite 系列：并发 5，RPM 300
 * @see https://www.volcengine.com/docs/82379/1520757
 */
const DEFAULT_MAX_CONCURRENCY = 10

export function getSeedanceMaxConcurrency(): number {
  const raw = process.env.SEEDANCE_MAX_CONCURRENCY?.trim()
  if (!raw)
    return DEFAULT_MAX_CONCURRENCY

  const parsed = Number.parseInt(raw, 10)
  if (!Number.isFinite(parsed) || parsed < 1)
    return DEFAULT_MAX_CONCURRENCY

  return parsed
}
