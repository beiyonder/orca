import { z } from 'zod'
import type { DomainSchemaName } from './domain/domain-contract-registry.js'

export const MissionWorkspaceSectionSchema = z.enum([
  'intake',
  'estate',
  'gaps',
  'decisions',
  'agents',
  'evaluation',
  'exceptions'
])

export type MissionWorkspaceSection = z.infer<typeof MissionWorkspaceSectionSchema>

export const MISSION_WORKSPACE_SECTION_SCHEMAS = {
  estate: [
    'source-access-envelope.v1',
    'source-adapter-definition.v1',
    'source-cdc-analysis.v1',
    'source-cdc-trace.v1',
    'source-claim-comparison.v1',
    'source-code-extract.v1',
    'source-data-profile.v1',
    'source-lineage-snapshot.v1',
    'source-observation.v1',
    'source-request.v1',
    'source-schema-inventory.v1',
    'source-system-inventory.v1',
    'corpus-chunk.v1',
    'corpus-entity.v1',
    'corpus-parse-version.v1',
    'corpus-relation.v1',
    'corpus-source-manifest.v1',
    'context-manifest.v1',
    'evidence-item.v1'
  ],
  gaps: [
    'proposition.v1',
    'assertion.v1',
    'contradiction-set.v1',
    'gap.v1',
    'accepted-finding.v1',
    'discovery-gap-ranking.v1',
    'probe-request.v1',
    'probe-result.v1'
  ],
  decisions: ['decision-record.v1', 'plan-revision.v1', 'migration-proposal.v1'],
  agents: [
    'task-record.v1',
    'assignment-record.v1',
    'assignment-attempt.v1',
    'assignment-result.v1'
  ],
  evaluation: [
    'artifact-version.v1',
    'artifact-build-bundle.v1',
    'artifact-build-evaluation-report.v1',
    'data-movement-evaluation-report.v1',
    'semantic-evaluation-report.v1',
    'evaluation-assignment.v1',
    'evaluation-assignment.v2',
    'subject-acceptance.v1',
    'correction-cycle.v1',
    'correction-request.v1',
    'correction-result.v1',
    'learning-candidate.v1',
    'evaluation-contract.v1',
    'evaluation-contract.v2',
    'evaluation-coordination.v1',
    'evaluation-deterministic-report.v1',
    'evaluation-diagnosis.v1',
    'evaluation-result.v1',
    'evaluation-result.v2',
    'evaluator-definition.v1',
    'evaluator-definition.v2',
    'effect-intent.v1',
    'effect-intent.v2',
    'effect-attempt.v1',
    'effect-receipt.v1',
    'recovery-disposition.v1',
    'compensation.v1'
  ],
  exceptions: ['gap.v1']
} as const satisfies Record<Exclude<MissionWorkspaceSection, 'intake'>, readonly DomainSchemaName[]>
