import { z } from 'zod'
import { canonicalJson } from './canonical-json.js'
import {
  PlanRevisionIdSchema,
  RevisionSchema,
  Sha256Schema,
  ShortTextSchema,
  TaskIdSchema
} from './domain/common-contracts.js'
import { TaskRecordV1Schema, type TaskRecordV1 } from './domain/assignment-contracts.js'
import {
  PlanRevisionV1Schema,
  type PlanOperation,
  type PlanRevisionV1
} from './domain/planning-contracts.js'

const TaskOutputContractSchema = z.strictObject({
  taskId: TaskIdSchema,
  outputSchemaSha256: Sha256Schema
})

const DependencyRequirementSchema = z.strictObject({
  taskId: TaskIdSchema,
  dependencyTaskId: TaskIdSchema,
  requiredOutputSchemaSha256: Sha256Schema,
  recoveryRule: ShortTextSchema
})

const CurrentPlanSchema = z
  .strictObject({ id: PlanRevisionIdSchema, revision: z.number().int().positive() })
  .nullable()

export type PlanDependencyRequirement = z.infer<typeof DependencyRequirementSchema>

export type PlanDagValidationInput = {
  plan: unknown
  tasks: readonly unknown[]
  taskOutputContracts: readonly unknown[]
  dependencyRequirements: readonly unknown[]
  currentMissionRevision: unknown
  currentPlan: unknown
}

export type ValidatedPlanDag = {
  plan: PlanRevisionV1
  tasks: TaskRecordV1[]
  dependencyRequirements: PlanDependencyRequirement[]
  outputSchemaSha256ByTask: ReadonlyMap<string, string>
}

export class PlanDagValidationError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'PlanDagValidationError'
    this.code = code
  }
}

function fail(code: string, message: string): never {
  throw new PlanDagValidationError(code, message)
}

function edgeKey(taskId: string, dependencyTaskId: string): string {
  return `${taskId}->${dependencyTaskId}`
}

function operationTaskIds(operation: PlanOperation): string[] {
  switch (operation.operation) {
    case 'add-task':
    case 'block-task':
    case 'unblock-task':
    case 'cancel-task':
    case 'quarantine-task':
      return [operation.taskId]
    case 'split-task':
      return [operation.taskId, ...operation.childTaskIds]
    case 'merge-tasks':
      return [...operation.sourceTaskIds, operation.targetTaskId]
    case 'add-dependency':
      return [operation.taskId, operation.dependencyTaskId]
    case 'supersede-task':
      return [operation.taskId, ...operation.replacementTaskIds]
  }
}

function requireUnique<T>(
  values: readonly T[],
  key: (value: T) => string,
  label: string
): Map<string, T> {
  const result = new Map<string, T>()
  for (const value of values) {
    const id = key(value)
    if (result.has(id)) {
      fail('duplicate_record', `${label} contains duplicate ${id}`)
    }
    result.set(id, value)
  }
  return result
}

function validatePlanBase(
  plan: PlanRevisionV1,
  currentMissionRevision: number,
  currentPlan: { id: string; revision: number } | null
): void {
  if (plan.baseMissionRevision !== currentMissionRevision) {
    fail(
      'stale_mission_revision',
      `Plan base mission revision ${plan.baseMissionRevision} does not match ${currentMissionRevision}`
    )
  }
  if (currentPlan === null) {
    if (plan.revision !== 1 || plan.basePlanRevisionId !== null) {
      fail('invalid_plan_base', 'First materialized plan must be revision 1 without a base plan')
    }
    return
  }
  if (plan.revision !== currentPlan.revision + 1 || plan.basePlanRevisionId !== currentPlan.id) {
    fail('invalid_plan_base', 'Plan revision must advance exactly from the current plan')
  }
}

function validateOperations(
  plan: PlanRevisionV1,
  taskById: ReadonlyMap<string, TaskRecordV1>
): void {
  const addedTaskIds = new Set<string>()
  for (const operation of plan.operations) {
    for (const taskId of operationTaskIds(operation)) {
      if (!taskById.has(taskId)) {
        fail('missing_task', `Plan operation references missing task ${taskId}`)
      }
    }
    if (operation.operation === 'add-task') {
      if (addedTaskIds.has(operation.taskId)) {
        fail('duplicate_add_task', `Task ${operation.taskId} is added more than once`)
      }
      addedTaskIds.add(operation.taskId)
      const task = taskById.get(operation.taskId)!
      if (
        task.title !== operation.title ||
        task.capability !== operation.capability ||
        canonicalJson(task.dependencyTaskIds) !== canonicalJson(operation.dependencyTaskIds) ||
        canonicalJson(task.proofObligations) !== canonicalJson(operation.proofObligations) ||
        canonicalJson(task.recoveryPolicy) !== canonicalJson(operation.recoveryPolicy)
      ) {
        fail('task_operation_mismatch', `Task ${task.id} does not match its add-task operation`)
      }
      const taskStatus = task.state.status
      if (taskStatus !== 'pending' && taskStatus !== 'blocked') {
        fail('invalid_initial_task_state', `Added task ${task.id} must start pending or blocked`)
      }
    }
    if (operation.operation === 'add-dependency') {
      const task = taskById.get(operation.taskId)!
      if (!new Set(task.dependencyTaskIds).has(operation.dependencyTaskId)) {
        fail('dependency_operation_mismatch', 'Added dependency is absent from materialized task')
      }
    }
    if (operation.operation === 'block-task') {
      const task = taskById.get(operation.taskId)!
      if (
        task.state.status !== 'blocked' ||
        canonicalJson(task.state.gapIds) !== canonicalJson(operation.gapIds)
      ) {
        fail('task_operation_mismatch', `Blocked task ${task.id} does not match its plan operation`)
      }
    }
  }
  if (plan.revision === 1 && addedTaskIds.size !== taskById.size) {
    fail('missing_add_task', 'First plan revision must add every materialized task exactly once')
  }
}

function validateAcyclic(taskById: ReadonlyMap<string, TaskRecordV1>): void {
  const dependentIdsByDependency = new Map<string, string[]>()
  const remainingDependencies = new Map<string, number>()
  for (const task of taskById.values()) {
    remainingDependencies.set(task.id, task.dependencyTaskIds.length)
    for (const dependencyTaskId of task.dependencyTaskIds) {
      if (!taskById.has(dependencyTaskId)) {
        fail('missing_dependency', `Task ${task.id} depends on missing task ${dependencyTaskId}`)
      }
      const dependents = dependentIdsByDependency.get(dependencyTaskId) ?? []
      dependents.push(task.id)
      dependentIdsByDependency.set(dependencyTaskId, dependents)
    }
  }

  const ready = [...remainingDependencies]
    .filter(([, count]) => count === 0)
    .map(([taskId]) => taskId)
    .sort()
  let visited = 0
  for (let cursor = 0; cursor < ready.length; cursor += 1) {
    const taskId = ready[cursor]!
    visited += 1
    for (const dependentId of dependentIdsByDependency.get(taskId) ?? []) {
      const remaining = remainingDependencies.get(dependentId)! - 1
      remainingDependencies.set(dependentId, remaining)
      if (remaining === 0) {
        ready.push(dependentId)
      }
    }
  }
  if (visited !== taskById.size) {
    fail('cyclic_plan', 'Plan task dependencies contain a cycle')
  }
}

export function validatePlanDag(input: PlanDagValidationInput): ValidatedPlanDag {
  const plan = PlanRevisionV1Schema.parse(input.plan)
  const tasks = input.tasks.map((task) => TaskRecordV1Schema.parse(task))
  const outputContracts = input.taskOutputContracts.map((contract) =>
    TaskOutputContractSchema.parse(contract)
  )
  const dependencyRequirements = input.dependencyRequirements.map((requirement) =>
    DependencyRequirementSchema.parse(requirement)
  )
  const currentMissionRevision = RevisionSchema.parse(input.currentMissionRevision)
  const currentPlan = CurrentPlanSchema.parse(input.currentPlan)
  validatePlanBase(plan, currentMissionRevision, currentPlan)

  const taskById = requireUnique(tasks, (task) => task.id, 'tasks')
  for (const task of tasks) {
    if (
      task.tenantId !== plan.tenantId ||
      task.missionId !== plan.missionId ||
      task.planRevisionId !== plan.id
    ) {
      fail('task_scope_mismatch', `Task ${task.id} is outside plan ${plan.id}`)
    }
  }
  validateOperations(plan, taskById)
  validateAcyclic(taskById)

  const outputByTask = requireUnique(
    outputContracts,
    (contract) => contract.taskId,
    'taskOutputContracts'
  )
  if (outputByTask.size !== taskById.size) {
    fail('missing_output_contract', 'Every task requires exactly one output contract')
  }
  for (const taskId of taskById.keys()) {
    if (!outputByTask.has(taskId)) {
      fail('missing_output_contract', `Task ${taskId} has no output contract`)
    }
  }

  const requirementByEdge = requireUnique(
    dependencyRequirements,
    (requirement) => edgeKey(requirement.taskId, requirement.dependencyTaskId),
    'dependencyRequirements'
  )
  const expectedEdges = new Set<string>()
  for (const task of tasks) {
    for (const dependencyTaskId of task.dependencyTaskIds) {
      const key = edgeKey(task.id, dependencyTaskId)
      expectedEdges.add(key)
      const requirement = requirementByEdge.get(key)
      if (!requirement) {
        fail('missing_recovery_rule', `Dependency ${key} has no contract and recovery rule`)
      }
      const producedContract = outputByTask.get(dependencyTaskId)!
      if (requirement.requiredOutputSchemaSha256 !== producedContract.outputSchemaSha256) {
        fail('incompatible_dependency_contract', `Dependency contract does not match for ${key}`)
      }
    }
  }
  if (requirementByEdge.size !== expectedEdges.size) {
    fail('unexpected_dependency_contract', 'Dependency contracts must match graph edges exactly')
  }

  return {
    plan,
    tasks,
    dependencyRequirements,
    outputSchemaSha256ByTask: new Map(
      outputContracts.map((contract) => [contract.taskId, contract.outputSchemaSha256])
    )
  }
}
