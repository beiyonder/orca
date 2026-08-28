import { canonicalJson, sha256Text } from './canonical-json.js'
import type {
  ContextManifestDeliveryAuthority,
  ContextManifestSource,
  RenderedContextItem
} from './omp-context-manifest-delivery.js'

export const reconstructionBudget = {
  tokenLimit: 4_000,
  timeLimitMs: 30_000,
  toolCallLimit: 2,
  outputByteLimit: 100_000,
  costLimitUsd: 2
}
const sourceBytes = Buffer.from('patient_num repeats across facilities')
const item = {
  itemId: 'profile_finding',
  evidenceId: 'evidence_profile',
  evidenceVersion: 2,
  evidenceDigest: sha256Text(sourceBytes),
  span: { kind: 'whole' as const },
  sourceRole: 'direct-observation',
  dataClass: 'synthetic' as const,
  position: 0,
  trust: 'direct' as const,
  freshness: 'current' as const
}
const renderedContext: readonly RenderedContextItem[] = [
  { metadata: item, content: sourceBytes.toString('utf8'), redactionReason: null }
]
export const reconstructionContextSources: readonly ContextManifestSource[] = [
  { evidenceId: 'evidence_profile', evidenceVersion: 2, bytes: sourceBytes }
]

export function reconstructionContextManifest(): Record<string, unknown> {
  return {
    schemaVersion: 1,
    kind: 'context-manifest',
    id: 'context_reconstruction',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    assignmentId: 'assignment_reconstruction',
    attemptId: 'attempt_reconstruction',
    baseMissionRevision: 7,
    role: 'recovery',
    strategyVersion: 'exact-lexical-v1',
    modelRoute: {
      provider: 'test',
      model: 'deterministic',
      revision: '1',
      effort: 'med',
      dataClasses: ['synthetic']
    },
    budget: reconstructionBudget,
    items: [item],
    excludedEvidence: [],
    redactions: [],
    systemPromptDigest: '1'.repeat(64),
    toolSetDigest: '2'.repeat(64),
    outputSchemaDigest: '3'.repeat(64),
    renderedContextDigest: sha256Text(canonicalJson(renderedContext)),
    compiledBy: { kind: 'system', id: 'context-compiler', version: '1' }
  }
}

export function reconstructionContextAuthority(): ContextManifestDeliveryAuthority {
  return {
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    assignmentId: 'assignment_reconstruction',
    attemptId: 'attempt_reconstruction',
    baseMissionRevision: 7,
    role: 'recovery',
    budget: reconstructionBudget,
    admittedEvidenceIds: ['evidence_profile'],
    excludedEvidenceIds: []
  }
}
