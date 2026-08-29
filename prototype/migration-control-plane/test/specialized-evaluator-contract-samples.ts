import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  ARTIFACT_COMPILER_OPTIONS_DIGEST,
  ARTIFACT_TYPESCRIPT_VERSION,
  evaluateArtifactBuild
} from '../src/artifact-build-evaluator.js'
import { ArtifactBuildBundleV1Schema } from '../src/domain/artifact-build-evaluator-contracts.js'
import { DataMovementEvaluationReportV1Schema } from '../src/domain/data-movement-evaluator-contracts.js'
import { SemanticLabeledCorpusV1Schema } from '../src/domain/semantic-evaluator-contracts.js'
import { evaluateSemanticLabels } from '../src/semantic-labeled-evaluator.js'

const createdAt = '2026-01-01T00:20:00.000Z'
const source = `export type Patient = { id: string }\nexport const patientId = (patient: Patient): string => patient.id\n`

export const ARTIFACT_BUILD_BUNDLE = ArtifactBuildBundleV1Schema.parse({
  schemaVersion: 1,
  kind: 'artifact-build-bundle',
  id: 'artifact_build_bundle_fixture_v1',
  tenantId: 'tenant_s1',
  missionId: 'mission_s1',
  createdAt,
  version: 1,
  predecessorBundleId: null,
  entrypoint: 'src/index.ts',
  files: [
    {
      path: 'src/index.ts',
      mediaType: 'application/typescript',
      content: source,
      sha256: sha256Text(source)
    }
  ],
  compiler: {
    name: 'typescript',
    version: ARTIFACT_TYPESCRIPT_VERSION,
    optionsDigest: ARTIFACT_COMPILER_OPTIONS_DIGEST
  },
  provenanceEvidenceIds: ['evidence_artifact_source'],
  generatedBy: { kind: 'specialist', id: 'artifact-builder', version: '1' },
  authority: 'proposal-only'
})
export const ARTIFACT_BUILD_REPORT = await evaluateArtifactBuild({
  bundle: ARTIFACT_BUILD_BUNDLE,
  evaluatedAt: createdAt
})

export const SEMANTIC_LABELED_CORPUS = SemanticLabeledCorpusV1Schema.parse({
  schemaVersion: 1,
  kind: 'semantic-labeled-corpus',
  id: 'semantic_corpus_migration_v1',
  tenantId: 'tenant_s1',
  createdAt,
  version: 1,
  predecessorCorpusId: null,
  split: 'held-out',
  labelsVisibleToProducer: false,
  cases: Array.from({ length: 10 }, (_, index) => ({
    id: `semantic-case-${index + 1}`,
    groupId: `migration-group-${index + 1}`,
    claimClass: 'mapping-safety',
    inputDigest: sha256Text(canonicalJson({ case: index + 1 })),
    label: index % 2 === 0 ? 'accept' : 'reject',
    rationale:
      index % 2 === 0 ? 'Mapping preserves the declared key.' : 'Mapping drops a required key.'
  })),
  minimumAccuracy: 0.8,
  maximumFalseAccepts: 0,
  maximumDisagreements: 0,
  labeledBy: { kind: 'operator', id: 'held-out-labeler', version: '1' },
  limitations: ['Synthetic held-out mapping labels.']
})
export const SEMANTIC_PREDICTIONS = SEMANTIC_LABELED_CORPUS.cases.map((item) => ({
  caseId: item.id,
  primary: item.label,
  secondary: item.label
}))
export const SEMANTIC_EVALUATION_REPORT = evaluateSemanticLabels({
  corpus: SEMANTIC_LABELED_CORPUS,
  predictions: SEMANTIC_PREDICTIONS,
  evaluatorVersion: '1',
  evaluatedAt: createdAt
})

export const DATA_MOVEMENT_REPORT_SAMPLE = DataMovementEvaluationReportV1Schema.parse({
  schemaVersion: 1,
  kind: 'data-movement-evaluation-report',
  id: 'data_movement_report_fixture_v1',
  tenantId: 'tenant_s1',
  createdAt,
  traceId: 'source_cdc_trace_pagila_qualification',
  traceDigest: 'a'.repeat(64),
  analysisId: 'source_cdc_analysis_pagila_qualification',
  analysisDigest: 'b'.repeat(64),
  oracleDigest: 'c'.repeat(64),
  checks: {
    countsExact: true,
    keysExact: true,
    deletesComplete: true,
    orderingValid: true,
    watermarkExact: true,
    replayExact: true,
    dispositionsComplete: true
  },
  observed: {
    initialRecordCount: 0,
    finalRecordCount: 2,
    finalKeyDigests: ['d'.repeat(64), 'e'.repeat(64)],
    appliedDeleteSequences: [6],
    finalPosition: '009',
    finalResumeToken: 'checkpoint-008',
    dispositionCount: 10,
    invalidDispositionCount: 0
  },
  status: 'passed',
  evidenceIds: ['evidence_cdc_report'],
  evaluatedAt: createdAt,
  evaluatedBy: { kind: 'evaluator', id: 'data-movement', version: '1' },
  limitations: ['Synthetic CDC trace.'],
  acceptanceAuthority: 'none'
})

export const SPECIALIZED_EVALUATOR_CONTRACT_SAMPLES = {
  'artifact-build-bundle.v1': ARTIFACT_BUILD_BUNDLE,
  'artifact-build-evaluation-report.v1': ARTIFACT_BUILD_REPORT,
  'data-movement-evaluation-report.v1': DATA_MOVEMENT_REPORT_SAMPLE,
  'semantic-labeled-corpus.v1': SEMANTIC_LABELED_CORPUS,
  'semantic-evaluation-report.v1': SEMANTIC_EVALUATION_REPORT
} as const
