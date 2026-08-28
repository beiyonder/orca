import { describe, expect, it } from 'vitest'
import type { DomainSchemaName } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_SCHEMA_REGISTRY } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

function sample(name: DomainSchemaName): Record<string, unknown> {
  return structuredClone(DOMAIN_CONTRACT_SAMPLES[name]) as Record<string, unknown>
}

function expectInvalid(name: DomainSchemaName, value: unknown, message?: string): void {
  const result = DOMAIN_SCHEMA_REGISTRY[name].safeParse(value)
  expect(result.success).toBe(false)
  if (!result.success && message) {
    expect(result.error.issues.map((issue) => issue.message)).toContain(message)
  }
}

describe('mission and version invariants', () => {
  it('rejects invalid IDs, mismatched mission identity, and reversed terminal time', () => {
    const invalidId = sample('mission-record.v1')
    invalidId.id = 'not-prefixed'
    expectInvalid('mission-record.v1', invalidId)

    const mismatch = sample('mission-record.v1')
    mismatch.missionId = 'mission_other'
    expectInvalid('mission-record.v1', mismatch, 'Mission id and missionId must match')

    const reversed = sample('mission-record.v1')
    reversed.state = {
      status: 'completed',
      enteredAt: '2026-01-01T01:00:00.000Z',
      completedAt: '2026-01-01T00:00:00.000Z',
      reason: 'done'
    }
    expectInvalid('mission-record.v1', reversed, 'completedAt must not precede enteredAt')
  })

  it('requires create commands to omit revision and existing commands to pin it', () => {
    const create = sample('mission-command.v1')
    create.expectedRevision = 0
    expectInvalid('mission-command.v1', create, 'create-mission expectedRevision must be null')

    const existing = sample('mission-command.v1')
    existing.commandType = 'record-evidence'
    existing.expectedRevision = null
    expectInvalid(
      'mission-command.v1',
      existing,
      'existing-mission commands require expectedRevision'
    )
  })
})

describe('epistemic invariants', () => {
  it('enforces temporal evidence and direct/derived assertion semantics', () => {
    const evidence = sample('evidence-item.v1')
    evidence.effectiveFrom = '2026-01-02T00:00:00.000Z'
    evidence.effectiveUntil = '2026-01-01T00:00:00.000Z'
    expectInvalid('evidence-item.v1', evidence, 'effectiveUntil must not precede effectiveFrom')

    const derived = sample('assertion.v1')
    derived.directness = 'derived'
    expectInvalid('assertion.v1', derived, 'Derived assertions require derivation assertions')

    const direct = sample('assertion.v1')
    direct.derivationAssertionIds = ['assertion_parent']
    expectInvalid('assertion.v1', direct, 'Direct assertions cannot cite derivation assertions')
  })

  it('keeps denied probes distinct from observations and requires impact triggers', () => {
    const denied = sample('probe-result.v1')
    denied.outcome = { status: 'denied', reason: 'access denied', observations: [] }
    expectInvalid('probe-result.v1', denied)

    const review = sample('impact-review.v1')
    review.triggerEvidenceIds = []
    review.triggerFindingIds = []
    expectInvalid(
      'impact-review.v1',
      review,
      'Impact review requires an evidence or finding trigger'
    )
  })
})

describe('planning, assignment, and artifact invariants', () => {
  it('requires a selected decision option and a valid plan base', () => {
    const decision = sample('decision-record.v1')
    decision.selectedOptionId = 'missing'
    expectInvalid(
      'decision-record.v1',
      decision,
      'selectedOptionId must reference one decision option'
    )

    const plan = sample('plan-revision.v1')
    plan.revision = 2
    expectInvalid('plan-revision.v1', plan, 'Later plan revisions require a base plan revision')

    const selfDependency = sample('plan-revision.v1')
    selfDependency.operations = [
      { operation: 'add-dependency', taskId: 'task_s1', dependencyTaskId: 'task_s1' }
    ]
    expectInvalid('plan-revision.v1', selfDependency, 'Task cannot depend on itself')
  })

  it('prevents self-dependent/completion-less tasks and invalid context redactions', () => {
    const task = sample('task-record.v1')
    task.dependencyTaskIds = ['task_s1']
    expectInvalid('task-record.v1', task, 'Task cannot depend on itself')

    const completed = sample('task-record.v1')
    completed.state = {
      status: 'completed',
      reason: 'done',
      completedAt: '2026-01-01T00:01:00.000Z',
      acceptedAssignmentResultIds: [],
      acceptedArtifactVersionIds: []
    }
    expectInvalid(
      'task-record.v1',
      completed,
      'Completed task requires an accepted assignment result'
    )

    const context = sample('context-manifest.v1')
    context.redactions = [{ itemId: 'missing', reason: 'redact' }]
    expectInvalid('context-manifest.v1', context, 'Redaction must reference a context item')
  })

  it('enforces disabled spawn policy and immutable artifact lineage', () => {
    const assignment = sample('assignment-record.v1')
    assignment.spawnPolicy = { enabled: false, maxDepth: 1, allowedRoles: [] }
    expectInvalid(
      'assignment-record.v1',
      assignment,
      'Disabled spawn policy must have zero depth and no roles'
    )

    const artifact = sample('artifact-version.v1')
    artifact.version = 2
    expectInvalid(
      'artifact-version.v1',
      artifact,
      'Later artifact versions require a previous version'
    )
  })
})

describe('evaluation and correction invariants', () => {
  it('requires model calibration and a hard contract gate', () => {
    const evaluator = sample('evaluator-definition.v1')
    evaluator.evaluatorType = 'model'
    expectInvalid(
      'evaluator-definition.v1',
      evaluator,
      'Model evaluator requires a calibration corpus'
    )

    const contract = sample('evaluation-contract.v1')
    const measures = contract.measures as Array<Record<string, unknown>>
    measures[0]!.hard = false
    expectInvalid(
      'evaluation-contract.v1',
      contract,
      'Evaluation contract requires at least one hard required measure'
    )
  })

  it('prevents false passed/failed verdicts and malformed failed measures', () => {
    const passed = sample('evaluation-result.v1')
    const passedMeasures = passed.measures as Array<Record<string, unknown>>
    passedMeasures[0]!.status = 'fail'
    passedMeasures[0]!.failureCode = 'schema_invalid'
    expectInvalid(
      'evaluation-result.v1',
      passed,
      'Passed result requires complete coverage and only passing measures'
    )

    const failed = sample('evaluation-result.v1')
    failed.status = 'failed'
    expectInvalid(
      'evaluation-result.v1',
      failed,
      'Failed result requires at least one failed measure'
    )

    const missingCode = sample('evaluation-result.v1')
    missingCode.status = 'failed'
    const missingCodeMeasures = missingCode.measures as Array<Record<string, unknown>>
    missingCodeMeasures[0]!.status = 'fail'
    expectInvalid('evaluation-result.v1', missingCode, 'Failed measure requires failureCode')
  })

  it('requires correction to preserve identity and advance version/digest', () => {
    const identity = sample('correction-result.v1')
    const identityNew = identity.newSubject as Record<string, unknown>
    identityNew.id = 'artifact_other'
    expectInvalid(
      'correction-result.v1',
      identity,
      'Correction must preserve logical subject identity and schema version'
    )

    const version = sample('correction-result.v1')
    const versionNew = version.newSubject as Record<string, unknown>
    versionNew.version = 1
    versionNew.digest = 'a'.repeat(64)
    expectInvalid('correction-result.v1', version, 'Corrected subject must advance its version')
    expectInvalid('correction-result.v1', version, 'Corrected subject digest must change')
  })
})

describe('learning lifecycle invariants', () => {
  it('prevents authority-expanding certification and invalid capability lineage', () => {
    const candidate = sample('learning-candidate.v1')
    candidate.authorityDelta = 'separate-approval-required'
    candidate.state = {
      status: 'certified',
      certificationId: 'certification_s1',
      reason: 'passed',
      settledAt: '2026-01-01T00:01:00.000Z'
    }
    expectInvalid('learning-candidate.v1', candidate, 'Certified candidate cannot expand authority')

    const capability = sample('capability-manifest.v1')
    capability.version = 2
    expectInvalid(
      'capability-manifest.v1',
      capability,
      'Later capability version requires a predecessor'
    )
  })

  it('does not bless failed certification slices or reversed drift windows', () => {
    const certification = sample('certification-result.v1')
    certification.protectedSliceResults = { synthetic: 'fail' }
    expectInvalid(
      'certification-result.v1',
      certification,
      'Passed certification cannot contain failed or unknown measures/slices'
    )

    const drift = sample('drift-signal.v1')
    drift.windowStartedAt = '2026-01-02T00:00:00.000Z'
    expectInvalid('drift-signal.v1', drift, 'windowEndedAt must not precede windowStartedAt')
  })
})

describe('bounded effect invariants', () => {
  it('binds idempotency to exact parameters and rejects false reversibility', () => {
    const digest = sample('effect-intent.v1')
    const idempotency = digest.idempotency as Record<string, unknown>
    idempotency.parameterDigest = 'b'.repeat(64)
    expectInvalid(
      'effect-intent.v1',
      digest,
      'Idempotency parameter digest must match intent parameter digest'
    )

    const destructive = sample('effect-intent.v1')
    destructive.operationClass = 'destructive-irreversible'
    destructive.reversible = true
    expectInvalid(
      'effect-intent.v1',
      destructive,
      'Destructive irreversible effect cannot claim reversibility'
    )
  })

  it('requires exact policy grants and valid authority lifetimes', () => {
    const policy = sample('policy-decision.v1')
    policy.grant = null
    expectInvalid('policy-decision.v1', policy, 'Allowed policy decision requires a grant')

    const lease = sample('secret-lease.v1')
    lease.expiresAt = lease.issuedAt
    expectInvalid('secret-lease.v1', lease, 'Secret lease must expire after issue')

    const envelope = sample('capability-envelope.v1')
    envelope.expiresAt = envelope.issuedAt
    expectInvalid('capability-envelope.v1', envelope, 'Capability must expire after issue')
  })

  it('prevents blind same-key retry and self-compensation', () => {
    const recovery = sample('recovery-disposition.v1')
    recovery.action = 'same-key-retry'
    recovery.providerKeyStillValid = false
    expectInvalid(
      'recovery-disposition.v1',
      recovery,
      'Same-key retry requires a still-valid provider key'
    )

    const compensation = sample('compensation.v1')
    compensation.compensationEffectId = compensation.forwardEffectId
    expectInvalid(
      'compensation.v1',
      compensation,
      'Compensation effect must differ from forward effect'
    )
  })
})

describe('corpus authority invariants', () => {
  it('requires ingest permission, version lineage, and public-only global visibility', () => {
    const denied = sample('corpus-source-manifest.v1')
    const permission = denied.permission as Record<string, unknown>
    permission.ingestAllowed = false
    expectInvalid('corpus-source-manifest.v1', denied, 'Source permission forbids ingestion')

    const laterVersion = sample('corpus-source-manifest.v1')
    laterVersion.version = 2
    expectInvalid(
      'corpus-source-manifest.v1',
      laterVersion,
      'Later source version requires a predecessor'
    )

    const globalRestricted = sample('corpus-source-manifest.v1')
    globalRestricted.visibility = 'global-public'
    globalRestricted.dataClass = 'confidential'
    expectInvalid(
      'corpus-source-manifest.v1',
      globalRestricted,
      'Global corpus sources must be public'
    )
  })

  it('rejects reversed applicability and self-referential corpus edges', () => {
    const source = sample('corpus-source-manifest.v1')
    const applicability = source.applicability as Record<string, unknown>
    applicability.effectiveFrom = '2026-01-02T00:00:00.000Z'
    applicability.effectiveUntil = '2026-01-01T00:00:00.000Z'
    expectInvalid('corpus-source-manifest.v1', source, 'Applicability end precedes start')

    const relation = sample('corpus-relation.v1')
    relation.toEntityId = relation.fromEntityId
    expectInvalid('corpus-relation.v1', relation, 'Corpus relation cannot self-reference')
  })
})

describe('retrieval and knowledge context invariants', () => {
  it('binds semantic and graph configuration to enabled channels', () => {
    const semantic = sample('retrieval-query.v1')
    semantic.semanticQuery = 'semantic query'
    expectInvalid(
      'retrieval-query.v1',
      semantic,
      'Semantic channel and query must be enabled together'
    )

    const graph = sample('retrieval-query.v1')
    graph.maxGraphDepth = 1
    expectInvalid('retrieval-query.v1', graph, 'Graph channel and depth must be enabled together')
  })

  it('requires attributable exclusion and bounded contiguous context allocation', () => {
    const trace = sample('retrieval-trace.v1')
    const candidates = trace.candidates as Record<string, unknown>[]
    candidates[0]!.eligible = false
    expectInvalid('retrieval-trace.v1', trace, 'Eligibility and exclusion reason disagree')

    const context = sample('knowledge-context-manifest.v1')
    context.tokenAllocation = 1_001
    expectInvalid(
      'knowledge-context-manifest.v1',
      context,
      'Context allocation exceeds token budget'
    )
    context.tokenAllocation = 8
    const items = context.items as Record<string, unknown>[]
    items[0]!.position = 1
    expectInvalid(
      'knowledge-context-manifest.v1',
      context,
      'Knowledge context positions must be contiguous'
    )
  })
})

describe('additional lineage and observability boundaries', () => {
  it('orders proposition validity, context positions, and attempt leases', () => {
    const proposition = sample('proposition.v1')
    proposition.effectiveFrom = '2026-01-02T00:00:00.000Z'
    proposition.effectiveUntil = '2026-01-01T00:00:00.000Z'
    expectInvalid('proposition.v1', proposition, 'effectiveUntil must not precede effectiveFrom')

    const context = sample('context-manifest.v1')
    const items = context.items as Array<Record<string, unknown>>
    items[0]!.position = 1
    expectInvalid(
      'context-manifest.v1',
      context,
      'Context item positions must be contiguous and match array order'
    )

    const attempt = sample('assignment-attempt.v1')
    const state = attempt.state as Record<string, unknown>
    state.leaseExpiresAt = attempt.startedAt
    expectInvalid('assignment-attempt.v1', attempt, 'Attempt lease must expire after start')
  })

  it('requires active evaluation evidence without overclaiming compensation', () => {
    const artifact = sample('artifact-version.v1')
    artifact.state = { status: 'evaluating', evaluationResultIds: [] }
    expectInvalid('artifact-version.v1', artifact)

    const receipt = sample('effect-receipt.v1')
    receipt.afterEvidence = null
    expectInvalid('effect-receipt.v1', receipt, 'Applied receipt requires after evidence')

    const compensable = sample('effect-intent.v1')
    compensable.compensationId = 'compensation_s1'
    expect(DOMAIN_SCHEMA_REGISTRY['effect-intent.v1'].safeParse(compensable).success).toBe(true)
  })

  it('allows quarantined capabilities without pretending certification exists', () => {
    const capability = sample('capability-manifest.v1')
    capability.status = { status: 'quarantined' }
    expect(DOMAIN_SCHEMA_REGISTRY['capability-manifest.v1'].safeParse(capability).success).toBe(
      true
    )
  })
})
