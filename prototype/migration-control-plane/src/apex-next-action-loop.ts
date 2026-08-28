import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'
import {
  AssignmentIdSchema,
  BudgetSchema,
  DecisionIdSchema,
  EvidenceIdSchema,
  GapIdSchema,
  IsoDateTimeSchema,
  MissionIdSchema,
  PlanRevisionIdSchema,
  Sha256Schema,
  ShortTextSchema,
  TaskIdSchema,
  TenantIdSchema,
  uniqueIdArray
} from './domain/common-contracts.js'
import {
  SpecialistAssignmentSchema,
  SpecialistRoleSchema,
  type SpecialistAssignment
} from './specialist-agent-contracts.js'
import { validateSpecialistAssignment } from './specialist-role-contract-registry.js'

const MissionRevisionSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER)
const GapSummarySchema = z.strictObject({
  gapId: GapIdSchema,
  question: ShortTextSchema,
  severity: z.enum(['low', 'medium', 'high', 'blocker']),
  blocking: z.boolean()
})
const ApexMissionSnapshotBodySchema = z.strictObject({
  schemaVersion: z.literal(1),
  tenantId: TenantIdSchema,
  missionId: MissionIdSchema,
  missionRevision: MissionRevisionSchema,
  activePlanRevisionId: PlanRevisionIdSchema.nullable(),
  acceptedEvidenceIds: uniqueIdArray(EvidenceIdSchema, {
    max: 10_000,
    label: 'acceptedEvidenceIds'
  }),
  openGaps: z.array(GapSummarySchema).max(10_000),
  readyTaskIds: uniqueIdArray(TaskIdSchema, { max: 10_000, label: 'readyTaskIds' }),
  activeAssignmentIds: uniqueIdArray(AssignmentIdSchema, {
    max: 10_000,
    label: 'activeAssignmentIds'
  }),
  availableSpecialistRoles: z.array(SpecialistRoleSchema).max(SpecialistRoleSchema.options.length),
  activeEffectIds: z.array(z.string().min(1).max(128)).max(10_000),
  pendingEvaluationIds: z.array(z.string().min(1).max(128)).max(10_000),
  remainingBudget: BudgetSchema
})
export const ApexMissionSnapshotSchema = ApexMissionSnapshotBodySchema.extend({
  snapshotDigest: Sha256Schema
})
export type ApexMissionSnapshot = z.infer<typeof ApexMissionSnapshotSchema>
export type ApexMissionSnapshotBody = z.infer<typeof ApexMissionSnapshotBodySchema>

const DispatchSpecialistActionSchema = z.strictObject({
  kind: z.literal('dispatch-specialist'),
  gapIds: uniqueIdArray(GapIdSchema, { max: 128, label: 'gapIds' }),
  assignment: SpecialistAssignmentSchema
})
const RequestProbeActionSchema = z.strictObject({
  kind: z.literal('request-probe'),
  gapId: GapIdSchema,
  probeKey: z.string().min(1).max(256),
  question: ShortTextSchema,
  expectedOutcomes: z.array(z.string().min(1).max(512)).min(2).max(32),
  cost: z.number().nonnegative().max(1_000_000)
})
const RequestExceptionActionSchema = z.strictObject({
  kind: z.literal('request-exception'),
  gapId: GapIdSchema,
  question: ShortTextSchema,
  accountableParty: z.string().min(1).max(256)
})
const ProposeCompletionActionSchema = z.strictObject({
  kind: z.literal('propose-completion'),
  completionPredicateRefs: z.array(z.string().min(1).max(256)).min(1).max(128)
})

export const ApexNextActionProposalSchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('apex_next_action'),
  baseMissionRevision: MissionRevisionSchema,
  evidenceIds: uniqueIdArray(EvidenceIdSchema, { min: 1, max: 1_000, label: 'evidenceIds' }),
  assumptions: z.array(ShortTextSchema).max(64),
  unresolvedUncertainty: z.array(ShortTextSchema).max(64),
  rationale: z.string().min(1).max(32_768),
  action: z.discriminatedUnion('kind', [
    DispatchSpecialistActionSchema,
    RequestProbeActionSchema,
    RequestExceptionActionSchema,
    ProposeCompletionActionSchema
  ])
})
export type ApexNextActionProposal = z.infer<typeof ApexNextActionProposalSchema>

export const ApexNextActionRecordSchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('apex_next_action_record'),
  id: DecisionIdSchema,
  tenantId: TenantIdSchema,
  missionId: MissionIdSchema,
  baseMissionRevision: MissionRevisionSchema,
  snapshotDigest: Sha256Schema,
  proposalDigest: Sha256Schema,
  evidenceIds: uniqueIdArray(EvidenceIdSchema, { min: 1, max: 1_000, label: 'evidenceIds' }),
  action: ApexNextActionProposalSchema.shape.action,
  status: z.literal('proposed'),
  authority: z.literal('reconciler-required'),
  createdAt: IsoDateTimeSchema
})
export type ApexNextActionRecord = z.infer<typeof ApexNextActionRecordSchema>

export type ApexNextActionLoopInput = {
  snapshot: unknown
  proposal: unknown
  currentMissionRevision: number
  recordId: string
  createdAt: string
}
export type ApexNextActionLoopOutput = {
  record: ApexNextActionRecord
  dispatch: SpecialistAssignment | null
}

export class ApexNextActionError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ApexNextActionError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): ApexNextActionError {
  return new ApexNextActionError(code, message, cause === undefined ? undefined : { cause })
}

function assertSnapshotDigest(snapshot: ApexMissionSnapshot): void {
  const { snapshotDigest, ...body } = snapshot
  if (sha256Text(canonicalJson(body)) !== snapshotDigest) {
    throw failure('snapshot_digest_mismatch', 'Mission snapshot digest differs')
  }
}

function assertKnownEvidence(snapshot: ApexMissionSnapshot, evidenceIds: readonly string[]): void {
  const accepted = new Set<string>(snapshot.acceptedEvidenceIds)
  if (evidenceIds.some((evidenceId) => !accepted.has(evidenceId))) {
    throw failure('evidence_out_of_scope', 'Apex proposal cites unavailable evidence')
  }
}

function assertKnownGaps(snapshot: ApexMissionSnapshot, gapIds: readonly string[]): void {
  const open = new Set<string>(snapshot.openGaps.map((gap) => gap.gapId))
  if (gapIds.some((gapId) => !open.has(gapId))) {
    throw failure('gap_not_open', 'Apex action references a gap that is not open')
  }
}

function assertDispatch(snapshot: ApexMissionSnapshot, assignment: SpecialistAssignment): void {
  if (
    assignment.tenantId !== snapshot.tenantId ||
    assignment.missionId !== snapshot.missionId ||
    assignment.missionRevision !== snapshot.missionRevision ||
    assignment.planRevisionId !== snapshot.activePlanRevisionId
  ) {
    throw failure('dispatch_binding_mismatch', 'Specialist dispatch does not match the snapshot')
  }
  if (!snapshot.availableSpecialistRoles.includes(assignment.role)) {
    throw failure('specialist_unavailable', 'Specialist role is unavailable')
  }
  if (snapshot.activeAssignmentIds.includes(assignment.assignmentId)) {
    throw failure('assignment_already_active', 'Specialist assignment is already active')
  }
  const remaining = snapshot.remainingBudget
  const requested = assignment.budget
  if (
    requested.tokenLimit > remaining.tokenLimit ||
    requested.timeLimitMs > remaining.timeLimitMs ||
    requested.toolCallLimit > remaining.toolCallLimit ||
    requested.outputByteLimit > remaining.outputByteLimit ||
    requested.costLimitUsd > remaining.costLimitUsd
  ) {
    throw failure('mission_budget_exceeded', 'Specialist dispatch exceeds remaining mission budget')
  }
}

export function createApexMissionSnapshot(bodyInput: unknown): ApexMissionSnapshot {
  const body = ApexMissionSnapshotBodySchema.parse(bodyInput)
  return ApexMissionSnapshotSchema.parse({
    ...body,
    snapshotDigest: sha256Text(canonicalJson(body))
  })
}

export function runApexNextAction(input: ApexNextActionLoopInput): ApexNextActionLoopOutput {
  let snapshot: ApexMissionSnapshot
  let proposal: ApexNextActionProposal
  try {
    snapshot = ApexMissionSnapshotSchema.parse(input.snapshot)
    proposal = ApexNextActionProposalSchema.parse(input.proposal)
  } catch (error) {
    throw failure('invalid_apex_input', 'Apex snapshot or proposal is invalid', error)
  }
  assertSnapshotDigest(snapshot)
  if (
    snapshot.missionRevision !== input.currentMissionRevision ||
    proposal.baseMissionRevision !== input.currentMissionRevision
  ) {
    throw failure('stale_mission_revision', 'Apex proposal is not based on current mission state')
  }
  assertKnownEvidence(snapshot, proposal.evidenceIds)
  let dispatch: SpecialistAssignment | null = null
  if (proposal.action.kind === 'dispatch-specialist') {
    assertKnownGaps(snapshot, proposal.action.gapIds)
    try {
      dispatch = validateSpecialistAssignment(proposal.action.assignment)
    } catch (error) {
      throw failure(
        'invalid_specialist_dispatch',
        'Specialist dispatch violates its role contract',
        error
      )
    }
    assertDispatch(snapshot, dispatch)
  } else if (
    proposal.action.kind === 'request-probe' ||
    proposal.action.kind === 'request-exception'
  ) {
    assertKnownGaps(snapshot, [proposal.action.gapId])
  }
  const proposalDigest = sha256Text(canonicalJson(proposal))
  const record = ApexNextActionRecordSchema.parse({
    schemaVersion: 1,
    type: 'apex_next_action_record',
    id: input.recordId,
    tenantId: snapshot.tenantId,
    missionId: snapshot.missionId,
    baseMissionRevision: snapshot.missionRevision,
    snapshotDigest: snapshot.snapshotDigest,
    proposalDigest,
    evidenceIds: proposal.evidenceIds,
    action: proposal.action,
    status: 'proposed',
    authority: 'reconciler-required',
    createdAt: input.createdAt
  })
  return { record, dispatch }
}
