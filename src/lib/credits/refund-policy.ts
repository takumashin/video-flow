/**
 * 点数退还策略（Phase A.2）
 *
 * | 场景 | 是否退点 |
 * |------|---------|
 * | 内容审查 / 安全策略导致 failed | 是 → refundCreditsForReviewFailedTask |
 * | 系统排队提交失败（waiting → submitting 失败）| 是 → refundCreditsForTask |
 * | 一般 API failed（超时、内部错误等）| 否 |
 * | 用户取消 cancelled | 否 |
 *
 * 所有退还均通过 hasCreditRefundForTask 保证同一 taskId 幂等。
 */
const REVIEW_FAILURE_PATTERNS = [
  /审核/i,
  /审查/i,
  /违规/i,
  /敏感/i,
  /内容安全/i,
  /安全策略/i,
  /moderation/i,
  /content.?policy/i,
  /safety/i,
  /inappropriate/i,
  /blocked/i,
  /risk/i,
  /涉黄/i,
  /暴力/i,
  /policy/i,
]

/** 判断 Seedance 任务失败是否由内容审查/安全策略导致 */
export function isReviewRelatedTaskFailure(errorMessage: string | null | undefined): boolean {
  const message = errorMessage?.trim()
  if (!message)
    return false

  return REVIEW_FAILURE_PATTERNS.some(pattern => pattern.test(message))
}
