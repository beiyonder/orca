import { z } from 'zod'
import {
  ActorSchema,
  CertificationIdSchema,
  ContentReferenceSchema,
  ContractSchemaReferenceSchema,
  DataClassSchema,
  EvaluationContractIdSchema,
  ModelRouteSchema,
  Sha256Schema,
  ShortTextSchema,
  ToolReferenceSchema,
  tenantRecordFields,
  uniqueIdArray
} from './common-contracts.js'

const skillId = (prefix: string) =>
  z
    .string()
    .min(prefix.length + 2)
    .max(128)
    .regex(new RegExp(`^${prefix}_[a-z0-9][a-z0-9_-]{0,111}$`))

export const SkillIdSchema = skillId('skill').brand<'SkillId'>()
export const SkillVersionIdSchema = skillId('skill_version').brand<'SkillVersionId'>()
export const SkillLifecycleIdSchema = skillId('skill_lifecycle').brand<'SkillLifecycleId'>()
export const SkillLifecycleStatusSchema = z.enum([
  'quarantined',
  'certified',
  'active',
  'deprecated',
  'revoked'
])

export const SkillVersionV1Schema = z
  .strictObject({
    ...tenantRecordFields('skill-version', SkillVersionIdSchema),
    skillId: SkillIdSchema,
    version: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    artifact: ContentReferenceSchema,
    artifactDigest: Sha256Schema,
    description: z.string().min(1).max(8_192),
    discoveryKeywords: z.array(z.string().min(1).max(128)).min(1).max(128),
    contract: z.strictObject({
      input: ContractSchemaReferenceSchema,
      output: ContractSchemaReferenceSchema,
      contractDigest: Sha256Schema
    }),
    compatibleModelRoutes: z.array(ModelRouteSchema).max(64),
    compatibleRuntimes: z
      .array(
        z.strictObject({
          runtime: z.string().min(1).max(128),
          versionConstraint: z.string().min(1).max(256),
          harness: z.string().min(1).max(128)
        })
      )
      .min(1)
      .max(64),
    requiredTools: z.array(ToolReferenceSchema).max(128),
    evaluationContractIds: uniqueIdArray(EvaluationContractIdSchema, {
      min: 1,
      max: 128,
      label: 'evaluationContractIds'
    }),
    dataClasses: z.array(DataClassSchema).min(1).max(6),
    authorityEnvelope: z.strictObject({
      toolNames: z.array(z.string().min(1).max(128)).max(128),
      networkDestinations: z.array(z.url().max(4_096)).max(128),
      filesystemScopes: z.array(z.string().min(1).max(4_096)).max(128),
      secretScopes: z.array(z.string().min(1).max(256)).max(128),
      effectClasses: z.array(z.string().min(1).max(128)).max(128)
    }),
    dependencyVersionIds: uniqueIdArray(SkillVersionIdSchema, {
      max: 128,
      label: 'dependencyVersionIds'
    }),
    supportedTaskClasses: z.array(z.string().min(1).max(128)).min(1).max(128),
    unsupportedTaskClasses: z.array(z.string().min(1).max(128)).max(128),
    predecessorVersionId: SkillVersionIdSchema.nullable(),
    license: z.string().min(1).max(256),
    signer: z.string().min(1).max(512).nullable(),
    createdBy: ActorSchema
  })
  .superRefine((skill, context) => {
    if (skill.artifact.sha256 !== skill.artifactDigest) {
      context.addIssue({ code: 'custom', message: 'Skill artifact digest differs' })
    }
    if (skill.version === 1 && skill.predecessorVersionId !== null) {
      context.addIssue({ code: 'custom', message: 'First skill version cannot have a predecessor' })
    }
    if (skill.version > 1 && skill.predecessorVersionId === null) {
      context.addIssue({ code: 'custom', message: 'Later skill version requires a predecessor' })
    }
    const requiredToolNames = skill.requiredTools.map((tool) => tool.name)
    if (new Set(requiredToolNames).size !== requiredToolNames.length) {
      context.addIssue({ code: 'custom', message: 'Skill required tools must be unique' })
    }
    if (
      JSON.stringify([...skill.authorityEnvelope.toolNames].toSorted()) !==
      JSON.stringify([...requiredToolNames].toSorted())
    ) {
      context.addIssue({ code: 'custom', message: 'Skill authority must match required tools' })
    }
    const unsupportedTaskClasses = new Set(skill.unsupportedTaskClasses)
    if (skill.supportedTaskClasses.some((taskClass) => unsupportedTaskClasses.has(taskClass))) {
      context.addIssue({ code: 'custom', message: 'Skill task classes cannot overlap' })
    }
    const dataClasses = new Set(skill.dataClasses)
    if (
      skill.compatibleModelRoutes.some((route) =>
        route.dataClasses.some((dataClass) => !dataClasses.has(dataClass))
      )
    ) {
      context.addIssue({ code: 'custom', message: 'Skill model route expands data classes' })
    }
    if (skill.dependencyVersionIds.includes(skill.id)) {
      context.addIssue({ code: 'custom', message: 'Skill version cannot depend on itself' })
    }
  })

export const SkillLifecycleEventV1Schema = z
  .strictObject({
    ...tenantRecordFields('skill-lifecycle-event', SkillLifecycleIdSchema),
    skillId: SkillIdSchema,
    skillVersionId: SkillVersionIdSchema,
    sequence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
    fromStatus: SkillLifecycleStatusSchema.nullable(),
    toStatus: SkillLifecycleStatusSchema,
    certificationId: CertificationIdSchema.nullable(),
    evidenceIds: z.array(z.string().min(1).max(128)).max(1_000),
    reason: ShortTextSchema,
    transitionedBy: ActorSchema
  })
  .superRefine((event, context) => {
    if (event.sequence === 1 && (event.fromStatus !== null || event.toStatus !== 'quarantined')) {
      context.addIssue({ code: 'custom', message: 'First skill event must enter quarantine' })
    }
    if (event.sequence > 1 && event.fromStatus === null) {
      context.addIssue({ code: 'custom', message: 'Later skill event requires a prior status' })
    }
    if (
      (event.toStatus === 'certified' || event.toStatus === 'active') &&
      event.certificationId === null
    ) {
      context.addIssue({
        code: 'custom',
        message: 'Certified or active skill requires certification'
      })
    }
    if (
      (event.toStatus === 'certified' || event.toStatus === 'active') &&
      event.evidenceIds.length === 0
    ) {
      context.addIssue({ code: 'custom', message: 'Certified or active skill requires evidence' })
    }
  })

export type SkillVersionV1 = z.infer<typeof SkillVersionV1Schema>
export type SkillLifecycleEventV1 = z.infer<typeof SkillLifecycleEventV1Schema>
