import { EvaluationContractIdSchema, EvaluationResultIdSchema } from './domain/common-contracts.js'
import { SkillVersionV1Schema } from './domain/skill-contracts.js'
import {
  certifySkill,
  demoteRegressedSkill,
  initializeSkillPointer,
  promoteCertifiedSkill
} from './skill-certification-controller.js'

const DIGEST_A = 'a'.repeat(64)
const DIGEST_B = 'b'.repeat(64)
const DIGEST_C = 'c'.repeat(64)
const DIGEST_D = 'd'.repeat(64)
const DIGEST_E = 'e'.repeat(64)

export function buildSkillLifecycleQualificationFixture(seed: number) {
  const baseline = SkillVersionV1Schema.parse({
    schemaVersion: 1,
    kind: 'skill-version',
    id: 'skill_version_s1',
    tenantId: 'tenant_s1',
    createdAt: '2026-01-01T00:00:00.000Z',
    skillId: 'skill_s1',
    version: 1,
    artifact: {
      uri: 'artifact://s1/source',
      sha256: DIGEST_A,
      mediaType: 'application/json',
      bytes: 128,
      span: { kind: 'whole' }
    },
    artifactDigest: DIGEST_A,
    description: 'Builds a cited identity mapping proposal.',
    discoveryKeywords: ['identity', 'mapping'],
    contract: {
      input: { name: 'specialist-assignment.v1', version: 1, digest: DIGEST_A },
      output: { name: 'specialist-result.v1', version: 1, digest: DIGEST_B },
      contractDigest: DIGEST_A
    },
    compatibleModelRoutes: [
      {
        provider: 'local',
        model: 'deterministic',
        revision: '1',
        effort: 'med',
        dataClasses: ['synthetic']
      }
    ],
    compatibleRuntimes: [
      { runtime: 'omp-rpc', versionConstraint: '18.0.6', harness: 'migration-control-plane' }
    ],
    requiredTools: [
      { name: 'evidence_read', version: '1', schemaDigest: DIGEST_A, approval: 'read' }
    ],
    evaluationContractIds: ['evaluation_contract_s1'],
    dataClasses: ['synthetic'],
    authorityEnvelope: {
      toolNames: ['evidence_read'],
      networkDestinations: [],
      filesystemScopes: [],
      secretScopes: [],
      effectClasses: []
    },
    dependencyVersionIds: [],
    supportedTaskClasses: ['identity-mapping'],
    unsupportedTaskClasses: [],
    predecessorVersionId: null,
    license: 'MIT',
    signer: null,
    createdBy: { kind: 'system', id: 'system_s1' }
  })
  const candidate = SkillVersionV1Schema.parse({
    ...structuredClone(baseline),
    id: 'skill_version_s2',
    createdAt: '2026-01-01T00:40:00.000Z',
    version: 2,
    artifact: {
      ...baseline.artifact,
      uri: 'artifact://skills/identity-mapping/v2',
      sha256: DIGEST_B,
      bytes: 256
    },
    artifactDigest: DIGEST_B,
    predecessorVersionId: baseline.id
  })
  const certification = certifySkill({
    tenantId: baseline.tenantId,
    createdAt: '2026-01-01T00:41:00.000Z',
    skillId: baseline.skillId,
    skillVersionId: candidate.id,
    baselineSkillVersionId: baseline.id,
    candidateArtifactDigest: candidate.artifactDigest,
    baselineArtifactDigest: baseline.artifactDigest,
    corpora: {
      selection: {
        uri: 'artifact://corpora/selection',
        sha256: DIGEST_B,
        mediaType: 'application/json',
        bytes: 100,
        span: { kind: 'whole' }
      },
      heldOut: {
        uri: 'artifact://corpora/held-out',
        sha256: DIGEST_C,
        mediaType: 'application/json',
        bytes: 100,
        span: { kind: 'whole' }
      },
      adversarial: {
        uri: 'artifact://corpora/adversarial',
        sha256: DIGEST_D,
        mediaType: 'application/json',
        bytes: 100,
        span: { kind: 'whole' }
      }
    },
    evaluatorContracts: [
      {
        id: EvaluationContractIdSchema.parse('evaluation_contract_s1'),
        version: 1,
        digest: DIGEST_E
      }
    ],
    evaluationResultIds: [EvaluationResultIdSchema.parse('evaluation_result_skill_certification')],
    metrics: [
      {
        name: 'held_out_accuracy',
        baseline: 0.8,
        candidate: 0.95,
        minimumDelta: 0.1,
        hard: true,
        status: 'pass'
      }
    ],
    protectedSlices: { adversarial: 'pass', cross_tenant: 'pass' },
    safetyGates: [
      { name: 'authority_non_escalation', passed: true },
      { name: 'evidence_complete', passed: true }
    ],
    envelope: {
      taskClasses: ['identity-mapping'],
      dataClasses: ['synthetic'],
      runtime: 'omp-rpc@18.0.6',
      modelFamily: 'deterministic-fixture'
    },
    performance: {
      baselineCostUsd: 1,
      candidateCostUsd: 0.9,
      maximumCostUsd: 1.1,
      baselineLatencyMs: 100,
      candidateLatencyMs: 90,
      maximumLatencyMs: 110
    },
    repetitions: 3,
    seeds: [seed, seed + 1, seed + 2],
    rollbackSkillVersionId: baseline.id,
    status: 'passed',
    certifiedAt: '2026-01-01T00:41:00.000Z',
    certifiedBy: { kind: 'system', id: 'skill-certifier', version: '1' },
    limitations: ['Synthetic held-out skill fixture.'],
    acceptanceAuthority: 'skill-registry-only'
  })
  const baselinePointer = initializeSkillPointer({
    baseline,
    changedAt: '2026-01-01T00:39:00.000Z'
  })
  const candidatePointer = promoteCertifiedSkill({
    current: baselinePointer,
    candidate,
    certification,
    changedAt: '2026-01-01T00:42:00.000Z'
  })
  const regression = demoteRegressedSkill({
    current: candidatePointer,
    certification,
    failedMetrics: ['held_out_accuracy'],
    affectedUseIds: ['capability_use_skill_s2'],
    affectedOutputIds: ['artifact_output_skill_s2'],
    reEvaluationResultIds: ['evaluation_result_skill_regression'],
    detectedAt: '2026-01-01T00:43:00.000Z'
  })
  return { baseline, candidate, certification, baselinePointer, candidatePointer, regression }
}
