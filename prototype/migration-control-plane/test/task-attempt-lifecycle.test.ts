import { describe, expect, it } from 'vitest'
import {
  LifecycleTransitionError,
  validateAttemptTransition,
  validateTaskTransition
} from '../src/task-attempt-lifecycle.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

const laterAt = '2026-01-01T00:01:00.000Z'

function initialTask(): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['task-record.v1']) as Record<
    string,
    unknown
  >
  value.state = { status: 'pending' }
  return value
}

function nextTask(
  current: Record<string, unknown>,
  state: Record<string, unknown>
): Record<string, unknown> {
  const next = structuredClone(current)
  next.revision = (current.revision as number) + 1
  next.state = state
  return next
}

function initialAttempt(): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['assignment-attempt.v1']) as Record<
    string,
    unknown
  >
  value.state = { status: 'claimed', leaseExpiresAt: laterAt }
  return value
}

function nextAttempt(
  current: Record<string, unknown>,
  state: Record<string, unknown>
): Record<string, unknown> {
  const next = structuredClone(current)
  next.state = state
  return next
}

function expectLifecycleError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected lifecycle transition to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(LifecycleTransitionError)
    expect((error as LifecycleTransitionError).code).toBe(code)
  }
}

describe('task lifecycle', () => {
  it('guards the complete pending-to-completed path', () => {
    const pending = initialTask()
    const runnable = validateTaskTransition({
      current: pending,
      next: nextTask(pending, { status: 'runnable' })
    })
    const leased = validateTaskTransition({
      current: runnable,
      next: nextTask(runnable, {
        status: 'leased',
        attemptId: 'attempt_s1',
        fence: 1,
        leaseExpiresAt: laterAt
      })
    })
    const authority = { attemptId: 'attempt_s1', fence: 1 }
    const running = validateTaskTransition({
      current: leased,
      next: nextTask(leased, {
        status: 'running',
        attemptId: 'attempt_s1',
        fence: 1,
        leaseExpiresAt: laterAt
      }),
      authority
    })
    const evaluating = validateTaskTransition({
      current: running,
      next: nextTask(running, {
        status: 'evaluating',
        attemptId: 'attempt_s1',
        fence: 1,
        evaluationAssignmentIds: ['evaluation_assignment_s1']
      }),
      authority
    })
    const completed = validateTaskTransition({
      current: evaluating,
      next: nextTask(evaluating, {
        status: 'completed',
        reason: 'Independent evaluation passed.',
        completedAt: laterAt,
        acceptedAssignmentResultIds: ['assignment_result_s1'],
        acceptedArtifactVersionIds: ['artifact_version_s1']
      }),
      authority
    })
    expect(completed.state.status).toBe('completed')
  })

  it('rejects skipped, terminal, stale-authority, and identity-changing transitions', () => {
    const pending = initialTask()
    expectLifecycleError(
      () =>
        validateTaskTransition({
          current: pending,
          next: nextTask(pending, {
            status: 'running',
            attemptId: 'attempt_s1',
            fence: 1,
            leaseExpiresAt: laterAt
          })
        }),
      'invalid_task_transition'
    )

    const leased = nextTask(nextTask(pending, { status: 'runnable' }), {
      status: 'leased',
      attemptId: 'attempt_s1',
      fence: 1,
      leaseExpiresAt: laterAt
    })
    expectLifecycleError(
      () =>
        validateTaskTransition({
          current: leased,
          next: nextTask(leased, {
            status: 'running',
            attemptId: 'attempt_s1',
            fence: 1,
            leaseExpiresAt: laterAt
          }),
          authority: { attemptId: 'attempt_s1', fence: 2 }
        }),
      'stale_task_authority'
    )

    const changed = nextTask(pending, { status: 'runnable' })
    changed.capability = 'changed-capability'
    expectLifecycleError(
      () => validateTaskTransition({ current: pending, next: changed }),
      'task_identity_changed'
    )
  })
})

describe('assignment attempt lifecycle', () => {
  it('guards claimed, running, result, evaluation, and success states', () => {
    const claimed = initialAttempt()
    const running = validateAttemptTransition({
      current: claimed,
      next: nextAttempt(claimed, { status: 'running', leaseExpiresAt: laterAt }),
      fence: 1
    })
    const submitted = validateAttemptTransition({
      current: running,
      next: nextAttempt(running, {
        status: 'result-submitted',
        resultId: 'assignment_result_s1',
        submittedAt: laterAt
      }),
      fence: 1
    })
    const evaluating = validateAttemptTransition({
      current: submitted,
      next: nextAttempt(submitted, {
        status: 'evaluating',
        resultId: 'assignment_result_s1',
        evaluationAssignmentIds: ['evaluation_assignment_s1']
      }),
      fence: 1
    })
    const succeeded = validateAttemptTransition({
      current: evaluating,
      next: nextAttempt(evaluating, {
        status: 'succeeded',
        reason: 'Evaluation passed.',
        completedAt: laterAt
      }),
      fence: 1
    })
    expect(succeeded.state.status).toBe('succeeded')
  })

  it('rejects skipped state, changed fence, and terminal restart', () => {
    const claimed = initialAttempt()
    expectLifecycleError(
      () =>
        validateAttemptTransition({
          current: claimed,
          next: nextAttempt(claimed, {
            status: 'succeeded',
            reason: 'Skipped work.',
            completedAt: laterAt
          }),
          fence: 1
        }),
      'invalid_attempt_transition'
    )

    const changedFence = nextAttempt(claimed, { status: 'running', leaseExpiresAt: laterAt })
    changedFence.fence = 2
    expectLifecycleError(
      () => validateAttemptTransition({ current: claimed, next: changedFence, fence: 1 }),
      'attempt_identity_changed'
    )

    const failed = nextAttempt(claimed, {
      status: 'failed',
      reason: 'Worker failed.',
      completedAt: laterAt
    })
    const retry = nextAttempt(failed, { status: 'running', leaseExpiresAt: laterAt })
    expectLifecycleError(
      () => validateAttemptTransition({ current: failed, next: retry, fence: 1 }),
      'invalid_attempt_transition'
    )
  })
})
