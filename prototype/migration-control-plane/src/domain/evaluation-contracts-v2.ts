import { z } from 'zod'
import {
  ActorSchema,
  EvaluationContractIdSchema,
  IsoDateTimeSchema,
  PositiveVersionSchema,
  Sha256Schema,
  ShortTextSchema,
  TenantIdSchema
} from './common-contracts.js'
import {
  EvaluationContractReferenceV2Schema,
  EvaluationMeasureDefinitionV2Schema,
  EvaluatorDefinitionReferenceV2Schema,
  EvaluatorIndependenceRequirementV2Schema
} from './evaluation-definition-contracts-v2.js'

export const VersionedSchemaReferenceV2Schema = z
  .strictObject({
    name: z
      .string()
      .min(1)
      .max(256)
      .regex(/^[a-z][a-z0-9-]*\.v[1-9][0-9]*$/),
    version: PositiveVersionSchema,
    digest: Sha256Schema
  })
  .superRefine((reference, context) => {
    const suffix = /\.v([1-9][0-9]*)$/.exec(reference.name)
    if (Number(suffix?.[1]) !== reference.version) {
      context.addIssue({
        code: 'custom',
        message: 'Schema name suffix and version must agree',
        path: ['version']
      })
    }
  })

export const EvaluationSubjectContractV2Schema = z.strictObject({
  kind: z.string().min(1).max(128),
  schema: VersionedSchemaReferenceV2Schema
})

export const EvaluationInputRequirementV2Schema = z.strictObject({
  name: z.string().min(1).max(128),
  recordKind: z.string().min(1).max(128),
  schema: VersionedSchemaReferenceV2Schema,
  required: z.boolean(),
  bindsSubject: z.boolean(),
  minimumEvidenceCount: z.number().int().nonnegative().max(10_000),
  maxAgeMs: z
    .number()
    .int()
    .positive()
    .max(365 * 24 * 60 * 60 * 1_000)
    .nullable(),
  description: ShortTextSchema
})

export const RequiredEvaluatorV2Schema = EvaluatorDefinitionReferenceV2Schema.safeExtend({
  measureNames: z.array(z.string().min(1).max(128)).min(1).max(256)
})
  .strict()
  .superRefine((evaluator, context) => {
    if (new Set(evaluator.measureNames).size !== evaluator.measureNames.length) {
      context.addIssue({
        code: 'custom',
        message: 'Required evaluator measure names must be unique',
        path: ['measureNames']
      })
    }
  })

export const EvaluationContractMeasureV2Schema = EvaluationMeasureDefinitionV2Schema.safeExtend({
  evaluator: EvaluatorDefinitionReferenceV2Schema
}).strict()

export const EvaluationContractV2Schema = z
  .strictObject({
    schemaVersion: z.literal(2),
    kind: z.literal('evaluation-contract'),
    id: EvaluationContractIdSchema,
    tenantId: TenantIdSchema,
    createdAt: IsoDateTimeSchema,
    contractKey: z.string().min(1).max(128),
    version: PositiveVersionSchema,
    predecessor: EvaluationContractReferenceV2Schema.nullable(),
    subject: EvaluationSubjectContractV2Schema,
    inputRequirements: z.array(EvaluationInputRequirementV2Schema).max(256),
    requiredEvaluators: z.array(RequiredEvaluatorV2Schema).min(1).max(64),
    measures: z.array(EvaluationContractMeasureV2Schema).min(1).max(256),
    composition: z.enum(['all', 'any', 'ordered-gates']),
    independence: EvaluatorIndependenceRequirementV2Schema,
    maxAgeMs: z
      .number()
      .int()
      .positive()
      .max(365 * 24 * 60 * 60 * 1_000),
    correctionBudget: z.number().int().nonnegative().max(100),
    unavailableDisposition: z.literal('unaccepted'),
    contradictoryDisposition: z.enum(['unaccepted', 'quarantined']),
    acceptanceAuthority: z.literal('product-reconciler-only'),
    createdBy: ActorSchema,
    limitations: z.array(ShortTextSchema).max(64),
    revokedAt: IsoDateTimeSchema.nullable()
  })
  .superRefine((contract, context) => {
    if ((contract.version === 1) !== (contract.predecessor === null)) {
      context.addIssue({
        code: 'custom',
        message: 'Only the first evaluation contract version may omit a predecessor',
        path: ['predecessor']
      })
    }
    if (contract.predecessor !== null && contract.predecessor.version !== contract.version - 1) {
      context.addIssue({
        code: 'custom',
        message: 'Evaluation contract predecessor must be the immediately prior version',
        path: ['predecessor', 'version']
      })
    }
    const inputNames = contract.inputRequirements.map((requirement) => requirement.name)
    if (new Set(inputNames).size !== inputNames.length) {
      context.addIssue({ code: 'custom', message: 'Evaluation input names must be unique' })
    }
    if (contract.inputRequirements.filter((requirement) => requirement.bindsSubject).length !== 1) {
      context.addIssue({
        code: 'custom',
        message: 'Evaluation contract requires exactly one subject-bound input'
      })
    }
    const measureNames = contract.measures.map((measure) => measure.name)
    if (new Set(measureNames).size !== measureNames.length) {
      context.addIssue({ code: 'custom', message: 'Evaluation measure names must be unique' })
    }
    if (!contract.measures.some((measure) => measure.hard && measure.required)) {
      context.addIssue({
        code: 'custom',
        message: 'Evaluation contract requires at least one hard required measure'
      })
    }
    const evaluatorKeys = contract.requiredEvaluators.map(
      (evaluator) => `${evaluator.id}\u0000${evaluator.version}`
    )
    if (new Set(evaluatorKeys).size !== evaluatorKeys.length) {
      context.addIssue({ code: 'custom', message: 'Required evaluators must be unique' })
    }
    const required = new Map(
      contract.requiredEvaluators.map((evaluator) => [
        `${evaluator.id}\u0000${evaluator.version}\u0000${evaluator.digest}`,
        new Set(evaluator.measureNames)
      ])
    )
    const assignedByEvaluator = new Map<string, Set<string>>()
    for (const [index, measure] of contract.measures.entries()) {
      const evaluatorKey = `${measure.evaluator.id}\u0000${measure.evaluator.version}\u0000${measure.evaluator.digest}`
      if (!required.get(evaluatorKey)?.has(measure.name)) {
        context.addIssue({
          code: 'custom',
          message: 'Contract measure must belong to an exact required evaluator version',
          path: ['measures', index, 'evaluator']
        })
      }
      const assigned = assignedByEvaluator.get(evaluatorKey) ?? new Set<string>()
      assigned.add(measure.name)
      assignedByEvaluator.set(evaluatorKey, assigned)
    }
    for (const [index, evaluator] of contract.requiredEvaluators.entries()) {
      const evaluatorKey = `${evaluator.id}\u0000${evaluator.version}\u0000${evaluator.digest}`
      const assigned = assignedByEvaluator.get(evaluatorKey) ?? new Set<string>()
      if (evaluator.measureNames.some((name) => !assigned.has(name))) {
        context.addIssue({
          code: 'custom',
          message: 'Required evaluator references an undefined contract measure',
          path: ['requiredEvaluators', index, 'measureNames']
        })
      }
    }
    if (
      contract.revokedAt !== null &&
      Date.parse(contract.revokedAt) < Date.parse(contract.createdAt)
    ) {
      context.addIssue({ code: 'custom', message: 'Contract revocation cannot predate creation' })
    }
  })

export type EvaluationContractV2 = z.infer<typeof EvaluationContractV2Schema>
export type EvaluationContractMeasureV2 = z.infer<typeof EvaluationContractMeasureV2Schema>
export type EvaluationInputRequirementV2 = z.infer<typeof EvaluationInputRequirementV2Schema>
