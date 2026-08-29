import { canonicalJson, sha256Text } from './canonical-json.js'
import type {
  EvaluationDiagnosisV1,
  SubjectAcceptanceV1
} from './domain/acceptance-correction-contracts.js'
import { LearningCandidateV1Schema, type LearningCandidateV1 } from './domain/learning-contracts.js'

export function createFailureLearningCandidate(input: {
  diagnosis: EvaluationDiagnosisV1
  candidateType: 'memory' | 'skill'
  proposedArtifact: LearningCandidateV1['proposedArtifact']
  createdAt: string
}): LearningCandidateV1 {
  return candidate({
    tenantId: input.diagnosis.tenantId,
    missionId: input.diagnosis.missionId,
    createdAt: input.createdAt,
    candidateType: input.candidateType,
    evaluationResultIds: input.diagnosis.evaluationResultIds,
    evidenceIds: input.diagnosis.failedMeasures.flatMap((measure) => measure.evidenceIds),
    sourceRecordIds: [input.diagnosis.id, ...input.diagnosis.gapIds],
    causalHypothesis: `Failure attribution: ${input.diagnosis.failedMeasures
      .map((measure) => `${measure.name}:${measure.cause}`)
      .join(', ')}.`,
    proposedArtifact: input.proposedArtifact,
    allowedMutationPaths: input.diagnosis.allowedMutationPaths
  })
}

export function createSuccessLearningCandidate(input: {
  acceptance: SubjectAcceptanceV1
  candidateType: 'memory' | 'skill'
  proposedArtifact: LearningCandidateV1['proposedArtifact']
  createdAt: string
}): LearningCandidateV1 {
  if (input.acceptance.status !== 'accepted') {
    throw new TypeError('Success learning candidate requires accepted subject')
  }
  return candidate({
    tenantId: input.acceptance.tenantId,
    missionId: input.acceptance.missionId,
    createdAt: input.createdAt,
    candidateType: input.candidateType,
    evaluationResultIds: input.acceptance.evaluationResultIds,
    evidenceIds: input.acceptance.evidenceIds,
    sourceRecordIds: [input.acceptance.id, input.acceptance.subject.id],
    causalHypothesis: 'Accepted evidence may generalize within the declared envelope.',
    proposedArtifact: input.proposedArtifact,
    allowedMutationPaths: ['/candidate-content']
  })
}

function candidate(input: {
  tenantId: string
  missionId: string
  createdAt: string
  candidateType: 'memory' | 'skill'
  evaluationResultIds: string[]
  evidenceIds: string[]
  sourceRecordIds: string[]
  causalHypothesis: string
  proposedArtifact: LearningCandidateV1['proposedArtifact']
  allowedMutationPaths: string[]
}): LearningCandidateV1 {
  const identity = {
    candidateType: input.candidateType,
    results: input.evaluationResultIds.toSorted(),
    sources: input.sourceRecordIds.toSorted(),
    artifact: input.proposedArtifact.sha256
  }
  return LearningCandidateV1Schema.parse({
    schemaVersion: 1,
    kind: 'learning-candidate',
    id: `learning_${sha256Text(canonicalJson(identity)).slice(0, 32)}`,
    tenantId: input.tenantId,
    missionId: input.missionId,
    createdAt: input.createdAt,
    candidateType: input.candidateType,
    sourceEvaluationResultIds: [...new Set(input.evaluationResultIds)],
    sourceEvidenceIds: [...new Set(input.evidenceIds)],
    sourceRecordIds: [...new Set(input.sourceRecordIds)],
    causalHypothesis: input.causalHypothesis,
    proposedArtifact: input.proposedArtifact,
    targetEnvelope: {
      taskClasses: ['migration-evaluation'],
      modelRoutes: [],
      dataClasses: ['synthetic'],
      environment: 'offline-evaluation'
    },
    allowedMutationPaths: input.allowedMutationPaths,
    authorityDelta: 'none',
    retentionExpiresAt: null,
    state: { status: 'quarantined', usePolicy: 'none', validationStatus: 'not-run' },
    proposedBy: { kind: 'system', id: 'learning-candidate-builder', version: '1' }
  })
}
