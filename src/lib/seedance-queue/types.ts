import type { SeedanceCreateTaskRequest } from '@/lib/types'

export type SeedanceTaskSubmitPayload = {
  request: SeedanceCreateTaskRequest
  creditCost: number
}
