import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { AssignmentResultV1Schema, type AssignmentResultV1 } from './domain/assignment-contracts.js'
import {
  ArtifactVersionIdSchema,
  AssignmentIdSchema,
  AttemptIdSchema,
  EvidenceIdSchema,
  FenceSchema,
  GapIdSchema,
  PlanRevisionIdSchema,
  Sha256Schema,
  ShortTextSchema,
  UsageSchema,
  uniqueIdArray,
  type Actor,
  type Budget,
  type Usage
} from './domain/common-contracts.js'

const SuccessfulSubmissionSchema = z.strictObject({
  status: z.literal('succeeded'),
  summary: z.string().min(1).max(32_768),
  artifactVersionIds: uniqueIdArray(ArtifactVersionIdSchema, {
    max: 1_000,
    label: 'artifactVersionIds'
  }),
  evidenceIds: uniqueIdArray(EvidenceIdSchema, {
    min: 1,
    max: 1_000,
    label: 'evidenceIds'
  }),
  gapIds: uniqueIdArray(GapIdSchema, { max: 1_000, label: 'gapIds' }),
  planRevisionIds: uniqueIdArray(PlanRevisionIdSchema, {
    max: 128,
    label: 'planRevisionIds'
  })
})

const FailedSubmissionSchema = z.strictObject({
  status: z.literal('failed'),
  errorCode: z.string().min(1).max(128),
  message: ShortTextSchema,
  retryable: z.boolean()
})

export const OmpAssignmentResultSubmissionSchema = z.strictObject({
  schemaVersion: z.literal(1),
  type: z.literal('assignment_result'),
  assignmentId: AssignmentIdSchema,
  attemptId: AttemptIdSchema,
  fence: FenceSchema,
  outcome: z.discriminatedUnion('status', [SuccessfulSubmissionSchema, FailedSubmissionSchema]),
  limitations: z.array(ShortTextSchema).max(64)
})

export type AssignmentResultAuthority = {
  tenantId: string
  missionId: string
  resultId: string
  assignmentId: string
  attemptId: string
  fence: number
  attemptStatus: 'claimed' | 'running' | 'result-submitted' | 'terminal'
  readableEvidenceIds: readonly string[]
  ownedArtifactVersionIds: readonly string[]
  knownGapIds: readonly string[]
  knownPlanRevisionIds: readonly string[]
  budget: Budget
}

export type AdmitOmpAssignmentResultInput = {
  payload: string | Uint8Array
  reportedOutputDigest: string
  authority: AssignmentResultAuthority
  usage: Usage
  submittedAt: string
  submittedBy: Actor
}

export class AssignmentResultAdmissionError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AssignmentResultAdmissionError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): AssignmentResultAdmissionError {
  return new AssignmentResultAdmissionError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  )
}

function decodePayload(payload: string | Uint8Array): { text: string; bytes: Uint8Array } {
  if (typeof payload === 'string') {
    return { text: payload, bytes: Buffer.from(payload) }
  }
  try {
    return { text: new TextDecoder('utf-8', { fatal: true }).decode(payload), bytes: payload }
  } catch (error) {
    throw failure('invalid_output_encoding', 'Assignment result is not valid UTF-8', error)
  }
}

function assertCurrentAttempt(
  submission: z.infer<typeof OmpAssignmentResultSubmissionSchema>,
  authority: AssignmentResultAuthority
): void {
  if (authority.attemptStatus !== 'running') {
    throw failure('attempt_not_active', 'Assignment attempt is not running')
  }
  if (
    submission.assignmentId !== authority.assignmentId ||
    submission.attemptId !== authority.attemptId ||
    submission.fence !== authority.fence
  ) {
    throw failure('stale_attempt', 'Assignment result does not match the current attempt and fence')
  }
}

function assertReferences(
  submission: z.infer<typeof OmpAssignmentResultSubmissionSchema>,
  authority: AssignmentResultAuthority
): void {
  if (submission.outcome.status !== 'succeeded') {
    return
  }
  for (const [label, references, allowed] of [
    ['evidence', submission.outcome.evidenceIds, authority.readableEvidenceIds],
    ['artifact', submission.outcome.artifactVersionIds, authority.ownedArtifactVersionIds],
    ['gap', submission.outcome.gapIds, authority.knownGapIds],
    ['plan revision', submission.outcome.planRevisionIds, authority.knownPlanRevisionIds]
  ] as const) {
    if (references.some((reference) => !allowed.includes(reference))) {
      throw failure('reference_out_of_scope', `${label} reference is outside assignment scope`)
    }
  }
}

function assertBudget(usageInput: Usage, budget: Budget): Usage {
  const usage = UsageSchema.parse(usageInput)
  if (
    usage.inputTokens + usage.outputTokens > budget.tokenLimit ||
    usage.wallTimeMs > budget.timeLimitMs ||
    usage.toolCalls > budget.toolCallLimit ||
    usage.costUsd > budget.costLimitUsd
  ) {
    throw failure('budget_exceeded', 'Assignment result usage exceeds its admitted budget')
  }
  return usage
}

export function admitOmpAssignmentResult(input: AdmitOmpAssignmentResultInput): AssignmentResultV1 {
  const { text, bytes } = decodePayload(input.payload)
  if (bytes.byteLength > input.authority.budget.outputByteLimit) {
    throw failure('output_too_large', 'Assignment result exceeds its output byte budget')
  }
  const outputDigest = sha256Text(bytes)
  if (!Sha256Schema.safeParse(input.reportedOutputDigest).success) {
    throw failure('invalid_output_digest', 'Reported output digest is invalid')
  }
  if (outputDigest !== input.reportedOutputDigest) {
    throw failure('output_digest_mismatch', 'Assignment result output digest differs')
  }
  let submission: z.infer<typeof OmpAssignmentResultSubmissionSchema>
  try {
    submission = OmpAssignmentResultSubmissionSchema.parse(JSON.parse(text) as unknown)
  } catch (error) {
    throw failure('invalid_result', 'Assignment result must match the strict typed schema', error)
  }
  assertCurrentAttempt(submission, input.authority)
  assertReferences(submission, input.authority)
  const usage = assertBudget(input.usage, input.authority.budget)
  const outcome =
    submission.outcome.status === 'succeeded'
      ? {
          status: 'succeeded' as const,
          artifactVersionIds: submission.outcome.artifactVersionIds,
          evidenceIds: submission.outcome.evidenceIds,
          gapIds: submission.outcome.gapIds,
          planRevisionIds: submission.outcome.planRevisionIds
        }
      : submission.outcome
  try {
    return AssignmentResultV1Schema.parse({
      schemaVersion: 1,
      kind: 'assignment-result',
      id: input.authority.resultId,
      tenantId: input.authority.tenantId,
      missionId: input.authority.missionId,
      createdAt: input.submittedAt,
      assignmentId: submission.assignmentId,
      attemptId: submission.attemptId,
      fence: submission.fence,
      outputDigest,
      outcome,
      usage,
      limitations: submission.limitations,
      submittedAt: input.submittedAt,
      submittedBy: input.submittedBy
    })
  } catch (error) {
    throw failure('invalid_admitted_result', 'Host result record is invalid', error)
  }
}

export function encodeOmpAssignmentResultSubmission(submission: unknown): string {
  return canonicalJson(OmpAssignmentResultSubmissionSchema.parse(submission))
}
