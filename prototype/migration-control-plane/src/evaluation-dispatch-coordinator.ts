import { z } from 'zod'
import {
  ActorSchema,
  BudgetSchema,
  IsoDateTimeSchema,
  MissionIdSchema,
  ShortTextSchema,
  TenantIdSchema
} from './domain/common-contracts.js'
import {
  ContextManifestReferenceV2Schema,
  EvaluationAssignmentV2Schema,
  EvaluationInputReferenceV2Schema,
  EvaluationProducerV2Schema,
  EvaluationSubjectReferenceV2Schema,
  EvaluatorExecutionV2Schema,
  type EvaluationAssignmentV2
} from './domain/evaluation-assignment-contracts-v2.js'
import {
  EvaluationCoordinationV1Schema,
  type EvaluationCoordinationV1
} from './domain/evaluation-coordination-contracts.js'
import { EvaluationContractV2Schema } from './domain/evaluation-contracts-v2.js'
import {
  EvaluatorDefinitionReferenceV2Schema,
  EvaluatorDefinitionV2Schema
} from './domain/evaluation-definition-contracts-v2.js'
import {
  deriveEvaluatorIndependence,
  stableEvaluationCoordinatorId
} from './evaluation-coordinator-identities.js'
import { evaluationCoordinationFailure } from './evaluation-coordination-registry.js'
import {
  EvaluationContractRegistry,
  evaluationRecordDigest
} from './evaluation-contract-registry.js'

const RunnerBindingSchema = z.strictObject({
  evaluatorDefinition: EvaluatorDefinitionReferenceV2Schema,
  execution: EvaluatorExecutionV2Schema,
  contextManifest: ContextManifestReferenceV2Schema,
  budget: BudgetSchema,
  sharedCorpus: z.enum(['separate', 'shared-declared', 'not-applicable'])
})

const DispatchRequestSchema = z
  .strictObject({
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    coordinationKey: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-z0-9][a-z0-9_-]*$/),
    createdAt: IsoDateTimeSchema,
    resultDeadlineAt: IsoDateTimeSchema,
    contract: EvaluationContractV2Schema,
    evaluatorDefinitions: z.array(EvaluatorDefinitionV2Schema).min(1).max(64),
    subject: EvaluationSubjectReferenceV2Schema,
    inputs: z.array(EvaluationInputReferenceV2Schema).max(256),
    producer: EvaluationProducerV2Schema,
    runners: z.array(RunnerBindingSchema).min(1).max(64),
    createdBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64)
  })
  .superRefine((request, context) => {
    if (request.createdBy.kind !== 'system') {
      context.addIssue({ code: 'custom', message: 'Only product system authority may coordinate' })
    }
    if (Date.parse(request.resultDeadlineAt) <= Date.parse(request.createdAt)) {
      context.addIssue({ code: 'custom', message: 'Evaluation deadline must follow dispatch' })
    }
    const definitions = request.evaluatorDefinitions.map(
      (definition) => `${definition.id}\u0000${definition.version}`
    )
    if (new Set(definitions).size !== definitions.length) {
      context.addIssue({ code: 'custom', message: 'Evaluator definitions must be unique' })
    }
    const runners = request.runners.map(
      (runner) =>
        `${runner.evaluatorDefinition.id}\u0000${runner.evaluatorDefinition.version}\u0000${runner.evaluatorDefinition.digest}`
    )
    if (new Set(runners).size !== runners.length) {
      context.addIssue({ code: 'custom', message: 'Runner bindings must be unique' })
    }
  })

export type EvaluationDispatchRequest = z.input<typeof DispatchRequestSchema>
export type EvaluationDispatchPlan = {
  coordination: EvaluationCoordinationV1
  assignments: EvaluationAssignmentV2[]
  messages: {
    messageId: string
    topic: 'evaluation.assignment.v2'
    messageKey: string
    payload: EvaluationAssignmentV2
  }[]
}

export function coordinateEvaluationDispatch(input: unknown): EvaluationDispatchPlan {
  let request: z.output<typeof DispatchRequestSchema>
  try {
    request = DispatchRequestSchema.parse(input)
  } catch (error) {
    throw evaluationCoordinationFailure('invalid_dispatch', 'Evaluation dispatch is invalid', error)
  }
  const registry = new EvaluationContractRegistry()
  const definitions = request.evaluatorDefinitions.map((definition) =>
    registry.registerDefinition(definition)
  )
  const contract = registry.registerContract(request.contract)
  if (contract.tenantId !== request.tenantId) {
    throw evaluationCoordinationFailure('tenant_mismatch', 'Contract tenant differs from dispatch')
  }
  const definitionsByReference = new Map(
    definitions.map((definition) => [
      `${definition.id}\u0000${definition.version}\u0000${evaluationRecordDigest(definition)}`,
      definition
    ])
  )
  const runnersByReference = new Map(
    request.runners.map((runner) => [
      `${runner.evaluatorDefinition.id}\u0000${runner.evaluatorDefinition.version}\u0000${runner.evaluatorDefinition.digest}`,
      runner
    ])
  )
  if (
    definitionsByReference.size !== contract.requiredEvaluators.length ||
    runnersByReference.size !== contract.requiredEvaluators.length
  ) {
    throw evaluationCoordinationFailure(
      'runner_coverage_mismatch',
      'Dispatch must provide exactly one definition and runner per required evaluator'
    )
  }
  const assignments: EvaluationAssignmentV2[] = []
  const entries: EvaluationCoordinationV1['entries'] = []
  const messages: EvaluationDispatchPlan['messages'] = []
  for (const required of contract.requiredEvaluators) {
    const referenceKey = `${required.id}\u0000${required.version}\u0000${required.digest}`
    const definition = definitionsByReference.get(referenceKey)
    const runner = runnersByReference.get(referenceKey)
    if (!definition || !runner) {
      throw evaluationCoordinationFailure(
        'required_runner_missing',
        'Required evaluator has no exact independent runner binding'
      )
    }
    if (runner.contextManifest.digest !== runner.execution.contextDigest) {
      throw evaluationCoordinationFailure(
        'context_mismatch',
        'Runner context manifest and runtime context digest differ'
      )
    }
    const contractReference = {
      id: contract.id,
      version: contract.version,
      digest: evaluationRecordDigest(contract)
    }
    const evaluatorReference = {
      id: required.id,
      version: required.version,
      digest: required.digest
    }
    const assignmentIdentity = {
      tenantId: request.tenantId,
      missionId: request.missionId,
      coordinationKey: request.coordinationKey,
      contract: contractReference,
      subject: request.subject,
      evaluatorDefinition: evaluatorReference
    }
    const assignment = registry.admitAssignment(
      EvaluationAssignmentV2Schema.parse({
        schemaVersion: 2,
        kind: 'evaluation-assignment',
        id: stableEvaluationCoordinatorId('evaluation_assignment', assignmentIdentity),
        tenantId: request.tenantId,
        missionId: request.missionId,
        createdAt: request.createdAt,
        contract: contractReference,
        evaluatorDefinition: evaluatorReference,
        subject: request.subject,
        inputs: request.inputs,
        contextManifest: runner.contextManifest,
        producer: request.producer,
        evaluatorExecution: runner.execution,
        independence: deriveEvaluatorIndependence({
          contract,
          definition,
          producer: request.producer,
          evaluator: runner.execution,
          sharedCorpus: runner.sharedCorpus
        }),
        deadlineAt: request.resultDeadlineAt,
        budget: runner.budget,
        acceptanceAuthority: 'none'
      })
    )
    const dispatchMessageId = stableEvaluationCoordinatorId(
      'evaluation_dispatch',
      assignmentIdentity
    )
    assignments.push(assignment)
    entries.push({
      evaluatorDefinition: evaluatorReference,
      assignmentId: assignment.id,
      assignmentDigest: evaluationRecordDigest(assignment),
      dispatchMessageId,
      disposition: 'assigned',
      result: null,
      reason: null
    })
    messages.push({
      messageId: dispatchMessageId,
      topic: 'evaluation.assignment.v2',
      messageKey: assignment.id,
      payload: assignment
    })
  }
  const coordination = EvaluationCoordinationV1Schema.parse({
    schemaVersion: 1,
    kind: 'evaluation-coordination',
    id: stableEvaluationCoordinatorId('evaluation_coordination', {
      tenantId: request.tenantId,
      missionId: request.missionId,
      coordinationKey: request.coordinationKey,
      version: 1
    }),
    tenantId: request.tenantId,
    missionId: request.missionId,
    createdAt: request.createdAt,
    coordinationKey: request.coordinationKey,
    version: 1,
    predecessor: null,
    contract: {
      id: contract.id,
      version: contract.version,
      digest: evaluationRecordDigest(contract)
    },
    subject: request.subject,
    resultDeadlineAt: request.resultDeadlineAt,
    entries,
    outcome: 'pending',
    unresolvedReasons: [],
    acceptanceDisposition: 'unaccepted',
    unrelatedWorkDisposition: 'continue',
    observedAt: request.createdAt,
    createdBy: request.createdBy,
    limitations: request.limitations,
    acceptanceAuthority: 'none'
  })
  return { coordination, assignments, messages }
}
