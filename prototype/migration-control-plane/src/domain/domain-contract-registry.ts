import { z } from 'zod'
import { ArtifactVersionV1Schema } from './artifact-contracts.js'
import {
  AssignmentAttemptV1Schema,
  AssignmentRecordV1Schema,
  AssignmentResultV1Schema,
  ContextManifestV1Schema,
  TaskRecordV1Schema
} from './assignment-contracts.js'
import {
  CapabilityEnvelopeV1Schema,
  CompensationV1Schema,
  EffectAttemptV1Schema,
  EffectIntentV1Schema,
  EffectReceiptV1Schema,
  PolicyDecisionV1Schema,
  RecoveryDispositionV1Schema,
  SecretLeaseV1Schema,
  TargetObservationV1Schema
} from './effect-contracts.js'
import {
  AcceptedFindingV1Schema,
  AssertionV1Schema,
  ContradictionSetV1Schema,
  EvidenceItemV1Schema,
  GapV1Schema,
  ImpactReviewV1Schema,
  ProbeRequestV1Schema,
  ProbeResultV1Schema,
  PropositionV1Schema
} from './epistemic-contracts.js'
import {
  CorrectionRequestV1Schema,
  CorrectionResultV1Schema,
  EvaluationAssignmentV1Schema,
  EvaluationContractV1Schema,
  EvaluationResultV1Schema,
  EvaluatorDefinitionV1Schema
} from './evaluation-contracts.js'
import {
  CorpusChunkV1Schema,
  CorpusEntityV1Schema,
  CorpusParseVersionV1Schema,
  CorpusRelationV1Schema,
  CorpusSourceManifestV1Schema
} from './knowledge-contracts.js'
import {
  CapabilityManifestV1Schema,
  CapabilityUseV1Schema,
  CertificationResultV1Schema,
  DriftSignalV1Schema,
  LearningCandidateV1Schema,
  PromotionDecisionV1Schema
} from './learning-contracts.js'
import {
  MissionCommandEnvelopeV1Schema,
  MissionEventEnvelopeV1Schema,
  MissionRecordV1Schema
} from './mission-contracts.js'
import { DecisionRecordV1Schema, PlanRevisionV1Schema } from './planning-contracts.js'
import {
  KnowledgeContextManifestV1Schema,
  RetrievalQueryV1Schema,
  RetrievalTraceV1Schema
} from './retrieval-contracts.js'

export const DOMAIN_SCHEMA_REGISTRY = {
  'accepted-finding.v1': AcceptedFindingV1Schema,
  'artifact-version.v1': ArtifactVersionV1Schema,
  'assertion.v1': AssertionV1Schema,
  'assignment-attempt.v1': AssignmentAttemptV1Schema,
  'assignment-record.v1': AssignmentRecordV1Schema,
  'assignment-result.v1': AssignmentResultV1Schema,
  'capability-envelope.v1': CapabilityEnvelopeV1Schema,
  'capability-manifest.v1': CapabilityManifestV1Schema,
  'capability-use.v1': CapabilityUseV1Schema,
  'certification-result.v1': CertificationResultV1Schema,
  'compensation.v1': CompensationV1Schema,
  'context-manifest.v1': ContextManifestV1Schema,
  'contradiction-set.v1': ContradictionSetV1Schema,
  'correction-request.v1': CorrectionRequestV1Schema,
  'correction-result.v1': CorrectionResultV1Schema,
  'corpus-chunk.v1': CorpusChunkV1Schema,
  'corpus-entity.v1': CorpusEntityV1Schema,
  'corpus-parse-version.v1': CorpusParseVersionV1Schema,
  'corpus-relation.v1': CorpusRelationV1Schema,
  'corpus-source-manifest.v1': CorpusSourceManifestV1Schema,
  'decision-record.v1': DecisionRecordV1Schema,
  'drift-signal.v1': DriftSignalV1Schema,
  'effect-attempt.v1': EffectAttemptV1Schema,
  'effect-intent.v1': EffectIntentV1Schema,
  'effect-receipt.v1': EffectReceiptV1Schema,
  'evaluation-assignment.v1': EvaluationAssignmentV1Schema,
  'evaluation-contract.v1': EvaluationContractV1Schema,
  'evaluation-result.v1': EvaluationResultV1Schema,
  'evaluator-definition.v1': EvaluatorDefinitionV1Schema,
  'evidence-item.v1': EvidenceItemV1Schema,
  'gap.v1': GapV1Schema,
  'impact-review.v1': ImpactReviewV1Schema,
  'knowledge-context-manifest.v1': KnowledgeContextManifestV1Schema,
  'learning-candidate.v1': LearningCandidateV1Schema,
  'mission-command.v1': MissionCommandEnvelopeV1Schema,
  'mission-event.v1': MissionEventEnvelopeV1Schema,
  'mission-record.v1': MissionRecordV1Schema,
  'plan-revision.v1': PlanRevisionV1Schema,
  'policy-decision.v1': PolicyDecisionV1Schema,
  'probe-request.v1': ProbeRequestV1Schema,
  'probe-result.v1': ProbeResultV1Schema,
  'promotion-decision.v1': PromotionDecisionV1Schema,
  'proposition.v1': PropositionV1Schema,
  'recovery-disposition.v1': RecoveryDispositionV1Schema,
  'retrieval-query.v1': RetrievalQueryV1Schema,
  'retrieval-trace.v1': RetrievalTraceV1Schema,
  'secret-lease.v1': SecretLeaseV1Schema,
  'target-observation.v1': TargetObservationV1Schema,
  'task-record.v1': TaskRecordV1Schema
} as const satisfies Record<string, z.ZodType>

export type DomainSchemaName = keyof typeof DOMAIN_SCHEMA_REGISTRY

export const DOMAIN_SCHEMA_NAMES = Object.keys(DOMAIN_SCHEMA_REGISTRY).sort() as DomainSchemaName[]

export function parseDomainRecord<TName extends DomainSchemaName>(
  name: TName,
  value: unknown
): z.output<(typeof DOMAIN_SCHEMA_REGISTRY)[TName]> {
  return DOMAIN_SCHEMA_REGISTRY[name].parse(value) as z.output<
    (typeof DOMAIN_SCHEMA_REGISTRY)[TName]
  >
}

export function domainSchemaFileName(name: DomainSchemaName): string {
  return `${name}.schema.json`
}

export function domainSchemaId(name: DomainSchemaName): string {
  return `urn:orca:migration-control-plane:${name}`
}

export function exportDomainJsonSchema(name: DomainSchemaName): Record<string, unknown> {
  const schema = z.toJSONSchema(DOMAIN_SCHEMA_REGISTRY[name], {
    target: 'draft-2020-12',
    unrepresentable: 'throw'
  }) as Record<string, unknown>
  return {
    ...schema,
    $id: domainSchemaId(name),
    title: name,
    'x-orca-contract': {
      registryVersion: 1,
      schemaName: name,
      runtimeInvariantValidationRequired: true
    }
  }
}
