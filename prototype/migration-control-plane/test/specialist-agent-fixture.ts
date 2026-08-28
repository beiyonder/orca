import type { SpecialistRole } from '../src/specialist-agent-contracts.js'
import { SPECIALIST_ROLE_CONTRACTS } from '../src/specialist-role-contract-registry.js'

export const specialistFixtureDigest = 'a'.repeat(64)
const scope = { environment: 'synthetic', system: 'identity-migration' }
export const specialistBriefs: Record<SpecialistRole, Record<string, unknown>> = {
  'source-forensics': {
    kind: 'source-forensics',
    sourceSystems: ['legacy-ehr'],
    questions: ['Which keys are observed unique?']
  },
  'platform-architecture': {
    kind: 'platform-architecture',
    candidatePlatforms: ['postgresql'],
    constraints: ['customer-hosted']
  },
  cdc: { kind: 'cdc', streams: ['patient-change'], requiredSemantics: ['delete', 'replay'] },
  mapping: {
    kind: 'mapping',
    sourceEntities: ['legacy_patient'],
    targetEntities: ['patient'],
    invariants: ['identity stable']
  },
  research: {
    kind: 'research',
    questions: ['Which source is current?'],
    allowedSourceClasses: ['primary']
  },
  security: {
    kind: 'security',
    assets: ['patient identity'],
    trustBoundaries: ['customer to control plane']
  },
  build: { kind: 'build', artifactKinds: ['mapping-manifest'], buildTargets: ['synthetic'] },
  evaluation: {
    kind: 'evaluation',
    subjectRefs: ['artifact_version_s1'],
    measureNames: ['source_key_unique']
  },
  recovery: {
    kind: 'recovery',
    failureRefs: ['failure_worker_lost'],
    recoveryObjectives: ['reconstruct without hidden state']
  }
}
export const specialistOutputs: Record<SpecialistRole, Record<string, unknown>> = {
  'source-forensics': { kind: 'source-forensics', inventoryFindings: ['patient table found'] },
  'platform-architecture': {
    kind: 'platform-architecture',
    architectureOptions: ['single PostgreSQL authority']
  },
  cdc: { kind: 'cdc', semanticFindings: ['deletes are explicit'] },
  mapping: { kind: 'mapping', mappingProposals: ['facility_id + patient_num'] },
  research: { kind: 'research', sourcedFindings: ['vendor guide version 3'] },
  security: { kind: 'security', riskFindings: ['cross-tenant read denied'] },
  build: { kind: 'build', buildOutputs: ['identity-mapping.json'] },
  evaluation: { kind: 'evaluation', measureResults: ['source_key_unique passed'] },
  recovery: { kind: 'recovery', recoveryOptions: ['retry from manifest'] }
}

export function specialistAssignment(role: SpecialistRole): Record<string, unknown> {
  const contract = SPECIALIST_ROLE_CONTRACTS[role]
  return {
    schemaVersion: 1,
    type: 'specialist_assignment',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    missionRevision: 7,
    planRevisionId: 'plan_s1',
    assignmentId: `assignment_${role}`,
    parentApexAssignmentId: 'assignment_apex',
    role,
    contractVersion: 1,
    goal: `Complete the bounded ${role} analysis.`,
    brief: specialistBriefs[role],
    ownedScope: [scope],
    readScope: [scope],
    dataClasses: ['synthetic'],
    contextManifestId: 'context_s1',
    allowedTools: contract.allowedToolNames.map((name) => ({
      name,
      version: '1',
      schemaDigest: specialistFixtureDigest,
      approval: name === 'artifact_write' ? 'write' : 'read'
    })),
    budget: {
      tokenLimit: 8_000,
      timeLimitMs: 60_000,
      toolCallLimit: contract.allowedToolNames.length,
      outputByteLimit: 100_000,
      costLimitUsd: 5
    },
    outputSchema: { name: contract.outputSchemaName, version: 1, digest: specialistFixtureDigest },
    evaluatorContractIds: ['evaluation_contract_s1'],
    authority: { mode: 'proposal-only', exclusions: [...contract.authorityExclusions] },
    expiresAt: '2026-01-01T01:00:00.000Z'
  }
}

export function specialistResult(role: SpecialistRole): Record<string, unknown> {
  return {
    schemaVersion: 1,
    type: 'specialist_result',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    missionRevision: 7,
    planRevisionId: 'plan_s1',
    assignmentId: `assignment_${role}`,
    attemptId: `attempt_${role}`,
    fence: 2,
    role,
    contractVersion: 1,
    contextManifestId: 'context_s1',
    outcome: {
      status: 'yielded',
      roleOutput: specialistOutputs[role],
      claims: [
        {
          propositionKey: 'source.identity-key',
          stance: 'supports',
          statement: 'The composite key is unique in the observed fixture.',
          citations: [
            {
              itemId: 'profile_columns',
              evidenceId: 'evidence_profile',
              evidenceVersion: 1,
              evidenceDigest: specialistFixtureDigest,
              span: { kind: 'json-pointer', pointer: '/columns' }
            }
          ],
          limitations: ['Synthetic fixture only.']
        }
      ],
      evidenceIds: ['evidence_profile'],
      artifactRefs: [],
      gapProposals: [],
      proposedFollowups: []
    },
    submittedAt: '2026-01-01T00:01:00.000Z'
  }
}
