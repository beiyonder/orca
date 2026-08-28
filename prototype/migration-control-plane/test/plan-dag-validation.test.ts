import { describe, expect, it } from 'vitest'
import { PlanDagValidationError, validatePlanDag } from '../src/plan-dag-validation.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

const digestA = 'a'.repeat(64)
const digestB = 'b'.repeat(64)
const digestC = 'c'.repeat(64)

type PlanDagTestInput = {
  plan: Record<string, unknown>
  tasks: Record<string, unknown>[]
  taskOutputContracts: { taskId: string; outputSchemaSha256: string }[]
  dependencyRequirements: {
    taskId: string
    dependencyTaskId: string
    requiredOutputSchemaSha256: string
    recoveryRule: string
  }[]
  currentMissionRevision: number
  currentPlan: { id: string; revision: number } | null
}

function task(id: string, dependencyTaskIds: string[]): Record<string, unknown> {
  const value = structuredClone(DOMAIN_CONTRACT_SAMPLES['task-record.v1']) as Record<
    string,
    unknown
  >
  value.id = id
  value.planRevisionId = 'plan_dag'
  value.title = `Task ${id}`
  value.capability = `capability-${id}`
  value.dependencyTaskIds = dependencyTaskIds
  value.proofObligations = [`Prove ${id}`]
  value.state = { status: 'pending' }
  return value
}

function validInput(): PlanDagTestInput {
  const tasks = [
    task('task_extract', []),
    task('task_map', ['task_extract']),
    task('task_validate', ['task_map'])
  ]
  const plan = structuredClone(DOMAIN_CONTRACT_SAMPLES['plan-revision.v1']) as Record<
    string,
    unknown
  >
  plan.id = 'plan_dag'
  plan.operations = tasks.map((value) => ({
    operation: 'add-task',
    taskId: value.id,
    title: value.title,
    capability: value.capability,
    dependencyTaskIds: value.dependencyTaskIds,
    proofObligations: value.proofObligations,
    recoveryPolicy: value.recoveryPolicy
  }))
  return {
    plan,
    tasks,
    taskOutputContracts: [
      { taskId: 'task_extract', outputSchemaSha256: digestA },
      { taskId: 'task_map', outputSchemaSha256: digestB },
      { taskId: 'task_validate', outputSchemaSha256: digestC }
    ],
    dependencyRequirements: [
      {
        taskId: 'task_map',
        dependencyTaskId: 'task_extract',
        requiredOutputSchemaSha256: digestA,
        recoveryRule: 'Reconstruct extract output before retry.'
      },
      {
        taskId: 'task_validate',
        dependencyTaskId: 'task_map',
        requiredOutputSchemaSha256: digestB,
        recoveryRule: 'Re-run mapping before validation.'
      }
    ],
    currentMissionRevision: 1,
    currentPlan: null
  }
}

function expectPlanError(input: PlanDagTestInput, code: string): void {
  try {
    validatePlanDag(input)
    throw new Error('Expected plan validation to fail')
  } catch (error) {
    expect(error).toBeInstanceOf(PlanDagValidationError)
    expect((error as PlanDagValidationError).code).toBe(code)
  }
}

describe('plan DAG validation', () => {
  it('admits a complete acyclic graph with compatible contracts and recovery rules', () => {
    const result = validatePlanDag(validInput())
    expect(result.plan.id).toBe('plan_dag')
    expect(result.tasks.map((value) => value.id)).toEqual([
      'task_extract',
      'task_map',
      'task_validate'
    ])
    expect(result.dependencyRequirements).toHaveLength(2)
  })

  it('rejects a dependency on a missing task', () => {
    const input = validInput()
    input.tasks[1]!.dependencyTaskIds = ['task_missing']
    ;(input.plan.operations as Record<string, unknown>[])[1]!.dependencyTaskIds = ['task_missing']
    expectPlanError(input, 'missing_dependency')
  })

  it('rejects a cycle across otherwise valid task records', () => {
    const input = validInput()
    input.tasks[0]!.dependencyTaskIds = ['task_validate']
    ;(input.plan.operations as Record<string, unknown>[])[0]!.dependencyTaskIds = ['task_validate']
    input.dependencyRequirements.push({
      taskId: 'task_extract',
      dependencyTaskId: 'task_validate',
      requiredOutputSchemaSha256: digestC,
      recoveryRule: 'Rebuild validation before extract.'
    })
    expectPlanError(input, 'cyclic_plan')
  })

  it('rejects a consumer contract incompatible with its dependency output', () => {
    const input = validInput()
    input.dependencyRequirements[0]!.requiredOutputSchemaSha256 = digestC
    expectPlanError(input, 'incompatible_dependency_contract')
  })

  it('rejects a dependency without its explicit contract and recovery rule', () => {
    const input = validInput()
    input.dependencyRequirements.splice(0, 1)
    expectPlanError(input, 'missing_recovery_rule')
  })

  it('rejects stale mission and plan bases', () => {
    const staleMission = validInput()
    staleMission.currentMissionRevision = 2
    expectPlanError(staleMission, 'stale_mission_revision')

    const stalePlan = validInput()
    stalePlan.currentPlan = { id: 'plan_previous', revision: 1 }
    expectPlanError(stalePlan, 'invalid_plan_base')
  })

  it('rejects task materialization that differs from its add operation', () => {
    const input = validInput()
    input.tasks[1]!.capability = 'different-capability'
    expectPlanError(input, 'task_operation_mismatch')
  })
})
