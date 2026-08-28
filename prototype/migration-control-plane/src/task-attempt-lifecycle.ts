import { canonicalJson } from './canonical-json.js'
import {
  AssignmentAttemptV1Schema,
  TaskRecordV1Schema,
  type AssignmentAttemptV1,
  type TaskRecordV1
} from './domain/assignment-contracts.js'
import { MAX_SAFE_REVISION } from './domain/common-contracts.js'

type TaskStatus = TaskRecordV1['state']['status']
type AttemptStatus = AssignmentAttemptV1['state']['status']

const TASK_TRANSITIONS: Readonly<Record<TaskStatus, readonly TaskStatus[]>> = {
  pending: ['runnable', 'blocked', 'cancelled', 'quarantined'],
  runnable: ['leased', 'blocked', 'cancelled', 'quarantined'],
  leased: ['running', 'runnable', 'failed', 'cancelled', 'quarantined'],
  running: ['running', 'evaluating', 'failed', 'cancelled', 'quarantined'],
  evaluating: ['completed', 'failed', 'quarantined'],
  blocked: ['pending', 'cancelled', 'quarantined'],
  completed: [],
  failed: [],
  cancelled: [],
  quarantined: []
}

const ATTEMPT_TRANSITIONS: Readonly<Record<AttemptStatus, readonly AttemptStatus[]>> = {
  claimed: ['running', 'failed', 'cancelled', 'stale'],
  running: ['result-submitted', 'failed', 'cancelled', 'stale'],
  'result-submitted': ['evaluating', 'failed', 'cancelled', 'stale'],
  evaluating: ['succeeded', 'failed', 'cancelled', 'stale'],
  succeeded: [],
  failed: [],
  cancelled: [],
  stale: []
}

export type AttemptAuthority = { attemptId: string; fence: number }

export type TaskTransitionInput = {
  current: unknown
  next: unknown
  authority?: AttemptAuthority
}

export type AttemptTransitionInput = {
  current: unknown
  next: unknown
  fence: number
}

export class LifecycleTransitionError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'LifecycleTransitionError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new LifecycleTransitionError(code, message)
}

function immutableTaskFields(task: TaskRecordV1): string {
  return canonicalJson({
    schemaVersion: task.schemaVersion,
    kind: task.kind,
    id: task.id,
    tenantId: task.tenantId,
    missionId: task.missionId,
    createdAt: task.createdAt,
    planRevisionId: task.planRevisionId,
    title: task.title,
    capability: task.capability,
    dependencyTaskIds: task.dependencyTaskIds,
    proofObligations: task.proofObligations,
    requiredEvaluationContractIds: task.requiredEvaluationContractIds,
    ownedScope: task.ownedScope,
    readScope: task.readScope,
    budget: task.budget,
    recoveryPolicy: task.recoveryPolicy
  })
}

function stateAuthority(state: TaskRecordV1['state']): AttemptAuthority | null {
  if (state.status === 'leased' || state.status === 'running' || state.status === 'evaluating') {
    return { attemptId: state.attemptId, fence: state.fence }
  }
  return null
}

export function validateTaskTransition(input: TaskTransitionInput): TaskRecordV1 {
  const current = TaskRecordV1Schema.parse(input.current)
  const next = TaskRecordV1Schema.parse(input.next)
  if (immutableTaskFields(current) !== immutableTaskFields(next)) {
    fail('task_identity_changed', 'Task transition cannot change immutable task fields')
  }
  if (current.revision === MAX_SAFE_REVISION || next.revision !== current.revision + 1) {
    fail('task_revision_mismatch', 'Task revision must advance exactly once')
  }
  if (!TASK_TRANSITIONS[current.state.status].includes(next.state.status)) {
    fail(
      'invalid_task_transition',
      `Task cannot transition from ${current.state.status} to ${next.state.status}`
    )
  }

  const currentAuthority = stateAuthority(current.state)
  if (currentAuthority) {
    if (
      !input.authority ||
      input.authority.attemptId !== currentAuthority.attemptId ||
      input.authority.fence !== currentAuthority.fence
    ) {
      fail('stale_task_authority', 'Active task transition requires its current attempt and fence')
    }
  }
  const nextAuthority = stateAuthority(next.state)
  if (
    currentAuthority &&
    nextAuthority &&
    (currentAuthority.attemptId !== nextAuthority.attemptId ||
      currentAuthority.fence !== nextAuthority.fence)
  ) {
    fail('task_authority_changed', 'Active task transition cannot replace attempt authority')
  }
  if (current.state.status === 'runnable' && next.state.status === 'leased' && !nextAuthority) {
    fail('missing_task_authority', 'Leased task requires attempt authority')
  }
  return next
}

function immutableAttemptFields(attempt: AssignmentAttemptV1): string {
  return canonicalJson({
    schemaVersion: attempt.schemaVersion,
    kind: attempt.kind,
    id: attempt.id,
    tenantId: attempt.tenantId,
    missionId: attempt.missionId,
    createdAt: attempt.createdAt,
    assignmentId: attempt.assignmentId,
    attemptNumber: attempt.attemptNumber,
    fence: attempt.fence,
    worker: attempt.worker,
    contextManifestId: attempt.contextManifestId,
    startedAt: attempt.startedAt
  })
}

export function validateAttemptTransition(input: AttemptTransitionInput): AssignmentAttemptV1 {
  const current = AssignmentAttemptV1Schema.parse(input.current)
  const next = AssignmentAttemptV1Schema.parse(input.next)
  if (immutableAttemptFields(current) !== immutableAttemptFields(next)) {
    fail('attempt_identity_changed', 'Attempt transition cannot change immutable attempt fields')
  }
  if (input.fence !== current.fence || next.fence !== current.fence) {
    fail('stale_attempt_fence', 'Attempt transition requires its immutable fence')
  }
  if (!ATTEMPT_TRANSITIONS[current.state.status].includes(next.state.status)) {
    fail(
      'invalid_attempt_transition',
      `Attempt cannot transition from ${current.state.status} to ${next.state.status}`
    )
  }
  return next
}

export function taskCompletedAt(task: TaskRecordV1): string | null {
  if (
    task.state.status === 'completed' ||
    task.state.status === 'failed' ||
    task.state.status === 'cancelled'
  ) {
    return task.state.completedAt
  }
  if (task.state.status === 'quarantined') {
    return task.state.quarantinedAt
  }
  return null
}

export function attemptCompletedAt(attempt: AssignmentAttemptV1): string | null {
  if (
    attempt.state.status === 'succeeded' ||
    attempt.state.status === 'failed' ||
    attempt.state.status === 'cancelled' ||
    attempt.state.status === 'stale'
  ) {
    return attempt.state.completedAt
  }
  return null
}

export function assertAttemptTaskStatePair(attempt: AssignmentAttemptV1, task: TaskRecordV1): void {
  const valid =
    (attempt.state.status === 'claimed' && task.state.status === 'leased') ||
    (attempt.state.status === 'running' && task.state.status === 'running') ||
    (attempt.state.status === 'result-submitted' && task.state.status === 'running') ||
    (attempt.state.status === 'evaluating' && task.state.status === 'evaluating') ||
    (attempt.state.status === 'succeeded' && task.state.status === 'completed') ||
    (attempt.state.status === 'failed' && task.state.status === 'failed') ||
    (attempt.state.status === 'cancelled' && task.state.status === 'cancelled') ||
    (attempt.state.status === 'stale' &&
      (task.state.status === 'runnable' || task.state.status === 'quarantined'))
  if (!valid) {
    throw new TypeError(
      `Attempt state ${attempt.state.status} is incompatible with task state ${task.state.status}`
    )
  }
}
