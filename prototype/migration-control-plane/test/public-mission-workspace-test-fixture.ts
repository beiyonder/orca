import { insertPostgresDomainRecords } from '../src/database/postgres-domain-record-store.js'
import { withPostgresTransaction } from '../src/database/postgres-transaction.js'
import {
  DOMAIN_SCHEMA_REGISTRY,
  type DomainSchemaName
} from '../src/domain/domain-contract-registry.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'
import type { PostgresKernelTestContext } from './postgres-kernel-test-context.js'

const WORKSPACE_SCHEMAS = [
  'source-system-inventory.v1',
  'context-manifest.v1',
  'evidence-item.v1',
  'proposition.v1',
  'assertion.v1',
  'contradiction-set.v1',
  'accepted-finding.v1',
  'probe-request.v1',
  'probe-result.v1',
  'gap.v1',
  'decision-record.v1',
  'plan-revision.v1',
  'migration-proposal.v1',
  'task-record.v1',
  'assignment-record.v1',
  'assignment-attempt.v1',
  'assignment-result.v1',
  'artifact-version.v1',
  'evaluation-result.v1',
  'evaluation-assignment.v1',
  'subject-acceptance.v1',
  'correction-cycle.v1',
  'correction-request.v1',
  'correction-result.v1',
  'learning-candidate.v1',
  'effect-intent.v1',
  'effect-receipt.v1',
  'recovery-disposition.v1'
] as const satisfies readonly DomainSchemaName[]

function retarget(value: unknown, missionId: string): unknown {
  if (value === 'tenant_s1') {
    return 'tenant_api_a'
  }
  if (value === 'mission_s1') {
    return missionId
  }
  if (Array.isArray(value)) {
    return value.map((item) => retarget(item, missionId))
  }
  if (typeof value === 'object' && value !== null) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, retarget(item, missionId)])
    )
  }
  return value
}

function recordState(payload: Record<string, unknown>): string | null {
  const state = payload.state
  return typeof state === 'object' && state !== null && 'status' in state
    ? String(state.status)
    : null
}

export async function insertMissionWorkspaceFixture(
  context: PostgresKernelTestContext,
  missionId: string
): Promise<void> {
  const records = WORKSPACE_SCHEMAS.map((schemaName) => {
    const raw = retarget(structuredClone(DOMAIN_CONTRACT_SAMPLES[schemaName]), missionId)
    const payload = DOMAIN_SCHEMA_REGISTRY[schemaName].parse(raw) as Record<string, unknown>
    return {
      tenantId: 'tenant_api_a',
      recordId: String(payload.id),
      missionId,
      schemaName,
      recordKind: String(payload.kind),
      recordState: recordState(payload),
      payload,
      createdAt: String(payload.createdAt)
    }
  })
  const gapIndex = records.findIndex((record) => record.schemaName === 'gap.v1')
  const gap = records[gapIndex]!
  const blockedGap = DOMAIN_SCHEMA_REGISTRY['gap.v1'].parse({
    ...gap.payload,
    blockedDecisionIds: ['decision_s1'],
    state: {
      status: 'blocked',
      reason: 'Operator input is required for one bounded decision.',
      blockerIds: ['task_s1']
    }
  })
  records[gapIndex] = {
    ...gap,
    recordState: 'blocked',
    payload: blockedGap
  }
  const resolvedGap = DOMAIN_SCHEMA_REGISTRY['gap.v1'].parse({
    ...blockedGap,
    id: 'gap_workspace_resolved',
    state: {
      status: 'resolved',
      acceptedFindingId: 'finding_s1',
      resolvedAt: '2026-01-01T00:02:00.000Z'
    }
  })
  records.push({
    tenantId: 'tenant_api_a',
    recordId: resolvedGap.id,
    missionId,
    schemaName: 'gap.v1',
    recordKind: 'gap',
    recordState: 'resolved',
    payload: resolvedGap,
    createdAt: resolvedGap.createdAt
  })
  await withPostgresTransaction(context.pool, async (client) =>
    insertPostgresDomainRecords(client, records)
  )
}
