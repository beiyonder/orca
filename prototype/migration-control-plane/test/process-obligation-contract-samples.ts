const tenantId = 'tenant_s1'
const missionId = 'mission_s1'
const createdAt = '2026-01-01T00:00:00.000Z'
const dueAt = '2026-01-01T00:01:00.000Z'
const graceUntil = '2026-01-01T00:02:00.000Z'
const digestA = 'a'.repeat(64)
const actor = { kind: 'system', id: 'obligation-policy', version: '1' }
const definition = {
  id: 'obligation_definition_context_delivery_v1',
  version: 1,
  digest: digestA
}
const scope = { kind: 'task', id: 'task_s1', subjectVersion: '1' }

export const PROCESS_OBLIGATION_CONTRACT_SAMPLES = {
  'process-obligation-definition.v1': {
    schemaVersion: 1,
    kind: 'process-obligation-definition',
    id: definition.id,
    tenantId,
    createdAt,
    definitionKey: 'context-delivery-before-worker-start',
    version: 1,
    predecessorDefinitionId: null,
    scopeKinds: ['task'],
    trigger: {
      eventKind: 'assignment-admitted',
      applicabilityPolicyVersion: '1',
      applicabilityPolicyDigest: digestA
    },
    timing: { deadlineOffsetMs: 60_000, graceMs: 60_000, clock: 'database' },
    proof: {
      recordKinds: ['context-manifest'],
      schemas: [{ name: 'context-manifest.v1', version: 1, digest: digestA }],
      minimumCount: 1,
      authority: 'product',
      maxAgeMs: 60_000
    },
    severity: 'blocking',
    breachAction: 'block',
    waiver: {
      allowed: true,
      authorizedActorKinds: ['system', 'operator'],
      evidenceRequired: true,
      maximumDurationMs: 3_600_000
    },
    supersession: 'cancel',
    activatedAt: createdAt,
    revokedAt: null
  },
  'process-obligation.v1': {
    schemaVersion: 1,
    kind: 'process-obligation',
    id: 'obligation_context_delivery_s1',
    tenantId,
    missionId,
    createdAt,
    definition,
    scope,
    trigger: {
      eventId: 'event_obligation_trigger_s1',
      eventPosition: 1,
      occurredAt: createdAt
    },
    openedAt: createdAt,
    dueAt,
    graceUntil,
    state: { status: 'pending' },
    breachId: null,
    currentFence: 1
  },
  'process-obligation-breach.v1': {
    schemaVersion: 1,
    kind: 'process-obligation-breach',
    id: 'obligation_breach_context_delivery_s1',
    tenantId,
    missionId,
    createdAt: graceUntil,
    obligationId: 'obligation_context_delivery_s1',
    definition,
    scope,
    dueAt,
    graceUntil,
    observedAt: graceUntil,
    reasonCodes: ['proof-missing'],
    missingProofKinds: ['context-manifest'],
    invalidProofRecordIds: [],
    monitor: {
      ownerId: 'completeness-monitor-s1',
      claimId: 'claim_s1',
      fence: 1
    },
    severity: 'blocking',
    response: 'block',
    selectedBy: actor,
    resolutionRecordId: null,
    detectedAt: graceUntil
  },
  'process-obligation-waiver.v1': {
    schemaVersion: 1,
    kind: 'process-obligation-waiver',
    id: 'obligation_waiver_context_delivery_s1',
    tenantId,
    missionId,
    createdAt,
    obligationId: 'obligation_context_delivery_s1',
    definition,
    scope,
    reason: 'Synthetic fixture uses an admitted replacement context.',
    evidenceIds: ['evidence_obligation_waiver_s1'],
    authorizationPolicyDigest: digestA,
    authorizedBy: actor,
    issuedAt: createdAt,
    expiresAt: dueAt,
    residualRisk: ['Replacement context may omit optional sources.']
  }
}
