import { z } from 'zod'
import {
  ActorSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  BudgetSchema,
  ContextManifestIdSchema,
  EvaluationAssignmentIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  IsoDateTimeSchema,
  MissionIdSchema,
  ModelRouteSchema,
  PositiveVersionSchema,
  Sha256Schema,
  TenantIdSchema
} from './common-contracts.js'
import {
  EvaluationSubjectContractV2Schema,
  VersionedSchemaReferenceV2Schema
} from './evaluation-contracts-v2.js'
import {
  EvaluationContractReferenceV2Schema,
  EvaluatorDefinitionReferenceV2Schema
} from './evaluation-definition-contracts-v2.js'

export const EvaluationEvidenceReferenceV2Schema = z.strictObject({
  id: EvidenceIdSchema,
  version: PositiveVersionSchema,
  digest: Sha256Schema
})

export const EvaluationSubjectReferenceV2Schema = EvaluationSubjectContractV2Schema.safeExtend({
  id: z.string().min(1).max(128),
  version: PositiveVersionSchema,
  digest: Sha256Schema
}).strict()

export const EvaluationInputReferenceV2Schema = z
  .strictObject({
    name: z.string().min(1).max(128),
    recordKind: z.string().min(1).max(128),
    schema: VersionedSchemaReferenceV2Schema,
    recordId: z.string().min(1).max(128),
    recordVersion: PositiveVersionSchema,
    digest: Sha256Schema,
    evidence: z.array(EvaluationEvidenceReferenceV2Schema).max(10_000),
    observedAt: IsoDateTimeSchema
  })
  .superRefine((input, context) => {
    const evidenceKeys = input.evidence.map((item) => `${item.id}\u0000${item.version}`)
    if (new Set(evidenceKeys).size !== evidenceKeys.length) {
      context.addIssue({ code: 'custom', message: 'Input evidence references must be unique' })
    }
  })

const EvaluationRuntimeIdentityV2Schema = z.strictObject({
  actor: ActorSchema,
  processIdentity: z.string().min(1).max(256),
  modelRoute: ModelRouteSchema.nullable(),
  contextDigest: Sha256Schema,
  credentialScopeDigest: Sha256Schema.nullable(),
  toolSetDigest: Sha256Schema
})

export const EvaluationProducerV2Schema = EvaluationRuntimeIdentityV2Schema.safeExtend({
  assignmentId: AssignmentIdSchema,
  attemptId: AttemptIdSchema,
  fence: FenceSchema
}).strict()

export const EvaluatorExecutionV2Schema = EvaluationRuntimeIdentityV2Schema.safeExtend({
  attemptId: AttemptIdSchema,
  fence: FenceSchema
}).strict()

export const EvaluatorIndependenceObservationV2Schema = z.strictObject({
  process: z.enum(['different', 'same', 'not-applicable']),
  model: z.enum(['different', 'same', 'not-applicable']),
  provider: z.enum(['different', 'same', 'not-applicable']),
  context: z.enum(['different', 'same']),
  credentials: z.enum(['separate', 'shared', 'not-applicable']),
  producerReasoningVisible: z.literal(false),
  sharedCorpus: z.enum(['separate', 'shared-declared', 'not-applicable'])
})

export const ContextManifestReferenceV2Schema = z.strictObject({
  id: ContextManifestIdSchema,
  schema: VersionedSchemaReferenceV2Schema,
  digest: Sha256Schema
})

function routeIdentity(route: z.infer<typeof ModelRouteSchema> | null): string | null {
  return route === null ? null : `${route.provider}\u0000${route.model}\u0000${route.revision}`
}

export const EvaluationAssignmentV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.literal('evaluation-assignment'),
    id: EvaluationAssignmentIdSchema,
    tenantId: TenantIdSchema,
    missionId: MissionIdSchema,
    createdAt: IsoDateTimeSchema,
    contract: EvaluationContractReferenceV2Schema,
    evaluatorDefinition: EvaluatorDefinitionReferenceV2Schema,
    subject: EvaluationSubjectReferenceV2Schema,
    inputs: z.array(EvaluationInputReferenceV2Schema).max(256),
    contextManifest: ContextManifestReferenceV2Schema,
    producer: EvaluationProducerV2Schema,
    evaluatorExecution: EvaluatorExecutionV2Schema,
    independence: EvaluatorIndependenceObservationV2Schema,
    deadlineAt: IsoDateTimeSchema,
    budget: BudgetSchema,
    acceptanceAuthority: z.literal('none')
  })
  .superRefine((assignment, context) => {
    if (Date.parse(assignment.deadlineAt) <= Date.parse(assignment.createdAt)) {
      context.addIssue({ code: 'custom', message: 'Evaluation deadline must follow assignment' })
    }
    if (new Set(assignment.inputs.map((input) => input.name)).size !== assignment.inputs.length) {
      context.addIssue({ code: 'custom', message: 'Evaluation input names must be unique' })
    }
    const producer = assignment.producer
    const evaluator = assignment.evaluatorExecution
    if (producer.actor.kind === evaluator.actor.kind && producer.actor.id === evaluator.actor.id) {
      context.addIssue({ code: 'custom', message: 'Producer cannot evaluate its own subject' })
    }
    const processSame = producer.processIdentity === evaluator.processIdentity
    if (
      (assignment.independence.process === 'different' && processSame) ||
      (assignment.independence.process === 'same' && !processSame)
    ) {
      context.addIssue({ code: 'custom', message: 'Observed process independence disagrees' })
    }
    const producerRoute = routeIdentity(producer.modelRoute)
    const evaluatorRoute = routeIdentity(evaluator.modelRoute)
    const modelSame = producerRoute !== null && producerRoute === evaluatorRoute
    if (
      (assignment.independence.model === 'different' &&
        (producerRoute === null || evaluatorRoute === null || modelSame)) ||
      (assignment.independence.model === 'same' && !modelSame) ||
      (assignment.independence.model === 'not-applicable' && evaluatorRoute !== null)
    ) {
      context.addIssue({ code: 'custom', message: 'Observed model independence disagrees' })
    }
    const providerSame =
      producer.modelRoute !== null &&
      evaluator.modelRoute !== null &&
      producer.modelRoute.provider === evaluator.modelRoute.provider
    if (
      (assignment.independence.provider === 'different' &&
        (producer.modelRoute === null || evaluator.modelRoute === null || providerSame)) ||
      (assignment.independence.provider === 'same' && !providerSame) ||
      (assignment.independence.provider === 'not-applicable' && evaluator.modelRoute !== null)
    ) {
      context.addIssue({ code: 'custom', message: 'Observed provider independence disagrees' })
    }
    const contextSame = producer.contextDigest === evaluator.contextDigest
    if (
      (assignment.independence.context === 'different' && contextSame) ||
      (assignment.independence.context === 'same' && !contextSame)
    ) {
      context.addIssue({ code: 'custom', message: 'Observed context independence disagrees' })
    }
    const credentialSame =
      producer.credentialScopeDigest !== null &&
      producer.credentialScopeDigest === evaluator.credentialScopeDigest
    if (
      (assignment.independence.credentials === 'separate' &&
        (producer.credentialScopeDigest === null ||
          evaluator.credentialScopeDigest === null ||
          credentialSame)) ||
      (assignment.independence.credentials === 'shared' && !credentialSame) ||
      (assignment.independence.credentials === 'not-applicable' &&
        evaluator.credentialScopeDigest !== null)
    ) {
      context.addIssue({ code: 'custom', message: 'Observed credential independence disagrees' })
    }
  })

export type EvaluationAssignmentV2 = z.infer<typeof EvaluationAssignmentV2Schema>
export type EvaluationEvidenceReferenceV2 = z.infer<typeof EvaluationEvidenceReferenceV2Schema>
