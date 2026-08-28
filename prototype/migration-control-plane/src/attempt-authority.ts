export type ClaimedTaskAttempt = {
  taskId: string
  attemptId: string
  fence: number
  leaseExpiresAt: string
}

export type TaskAttemptClaimInput = {
  taskId: string
  attempt: unknown
  leasedTask: unknown
}

export type AttemptAdvanceInput = {
  taskId: string
  attemptId: string
  fence: number
  observedAt: string
  nextAttempt: unknown
  nextTask: unknown
}

export class TaskClaimConflictError extends Error {
  constructor(taskId: string) {
    super(`Task is not runnable for a new attempt: ${taskId}`)
    this.name = 'TaskClaimConflictError'
  }
}

export class StaleAttemptAuthorityError extends Error {
  constructor(taskId: string, attemptId: string, fence: number) {
    super(`Attempt is not authoritative for task ${taskId}: ${attemptId} fence ${fence}`)
    this.name = 'StaleAttemptAuthorityError'
  }
}
