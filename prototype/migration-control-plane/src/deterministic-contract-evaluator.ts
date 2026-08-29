import { canonicalJson, sha256Text } from './canonical-json.js'
import { evaluateDeterministicChecks } from './deterministic-evaluator-checks.js'
import { DeterministicEvaluatorSuiteRegistry } from './deterministic-evaluator-registry.js'
import { DataClassSchema, IsoDateTimeSchema } from './domain/common-contracts.js'
import {
  DeterministicEvaluationReportV1Schema,
  DeterministicEvaluatorSuiteV1Schema
} from './domain/deterministic-evaluator-contracts.js'
import { EvaluationAssignmentV2Schema } from './domain/evaluation-assignment-contracts-v2.js'
import { EvaluationContractV2Schema } from './domain/evaluation-contracts-v2.js'
import { EvaluatorDefinitionV2Schema } from './domain/evaluation-definition-contracts-v2.js'
import { EvidenceItemV1Schema } from './domain/epistemic-contracts.js'
import { EvaluationResultV2Schema } from './domain/evaluation-result-contracts-v2.js'
import { reconstructEvaluationContractRegistry } from './evaluation-contract-reconstruction.js'
import { evaluationRecordDigest, evaluationResultDigest } from './evaluation-contract-registry.js'
import { evaluationRegistryFailure } from './evaluation-contract-registry-errors.js'

export type DeterministicEvaluationOutput = {
  report: ReturnType<typeof DeterministicEvaluationReportV1Schema.parse>
  evidence: ReturnType<typeof EvidenceItemV1Schema.parse>
  result: ReturnType<typeof EvaluationResultV2Schema.parse>
}

export function evaluateDeterministicAssignment(input: {
  assignment: unknown
  contract: unknown
  evaluatorDefinition: unknown
  suite: unknown
  subject: unknown
  inputEvidence: readonly unknown[]
  dataClass: unknown
  observedAt: string
}): DeterministicEvaluationOutput {
  const assignment = EvaluationAssignmentV2Schema.parse(input.assignment)
  const contract = EvaluationContractV2Schema.parse(input.contract)
  const definition = EvaluatorDefinitionV2Schema.parse(input.evaluatorDefinition)
  const suite = DeterministicEvaluatorSuiteV1Schema.parse(input.suite)
  const observedAt = IsoDateTimeSchema.parse(input.observedAt)
  const dataClass = DataClassSchema.parse(input.dataClass)
  const suiteRegistry = DeterministicEvaluatorSuiteRegistry.reconstruct({
    definitions: [definition],
    suites: [suite]
  })
  suiteRegistry.registerSuite(suite)
  const evaluationRegistry = reconstructEvaluationContractRegistry({
    definitions: [definition],
    contracts: [contract],
    assignments: [assignment],
    results: []
  })
  if (
    assignment.evaluatorDefinition.id !== suite.evaluatorDefinition.id ||
    assignment.evaluatorDefinition.version !== suite.evaluatorDefinition.version ||
    assignment.evaluatorDefinition.digest !== suite.evaluatorDefinition.digest
  ) {
    throw evaluationRegistryFailure(
      'deterministic_suite_assignment_mismatch',
      'Assignment evaluator differs from deterministic suite'
    )
  }
  const suiteInput = assignment.inputs.find(
    (assignmentInput) =>
      assignmentInput.recordId === suite.id &&
      assignmentInput.recordVersion === suite.version &&
      assignmentInput.schema.name === 'deterministic-evaluator-suite.v1'
  )
  if (!suiteInput || suiteInput.digest !== evaluationRecordDigest(suite)) {
    throw evaluationRegistryFailure(
      'deterministic_suite_input_mismatch',
      'Assignment does not pin the exact deterministic suite'
    )
  }
  const checks = evaluateDeterministicChecks({
    assignment,
    contract,
    definition,
    suite,
    subject: input.subject,
    inputEvidence: input.inputEvidence,
    dataClass
  })
  const stale = Date.parse(observedAt) > Date.parse(assignment.deadlineAt)
  const reportStatus = stale
    ? 'stale'
    : checks.every((check) => check.status === 'pass')
      ? 'passed'
      : 'failed'
  const identity = {
    assignmentId: assignment.id,
    assignmentDigest: evaluationRecordDigest(assignment),
    suiteId: suite.id,
    suiteVersion: suite.version,
    subjectDigest: assignment.subject.digest
  }
  const report = DeterministicEvaluationReportV1Schema.parse({
    schemaVersion: 1,
    kind: 'evaluation-deterministic-report',
    id: `evaluation_report_${sha256Text(canonicalJson(identity)).slice(0, 32)}`,
    tenantId: assignment.tenantId,
    missionId: assignment.missionId,
    createdAt: observedAt,
    assignmentId: assignment.id,
    assignmentDigest: evaluationRecordDigest(assignment),
    evaluatorDefinition: assignment.evaluatorDefinition,
    suite: { id: suite.id, version: suite.version, digest: evaluationRecordDigest(suite) },
    subject: assignment.subject,
    checks,
    status: reportStatus,
    observedAt,
    limitations: suite.limitations,
    acceptanceAuthority: 'none'
  })
  const reportJson = canonicalJson(report)
  const evidence = EvidenceItemV1Schema.parse({
    schemaVersion: 1,
    kind: 'evidence-item',
    id: `evidence_deterministic_${sha256Text(reportJson).slice(0, 32)}`,
    tenantId: assignment.tenantId,
    missionId: assignment.missionId,
    createdAt: observedAt,
    version: 1,
    sourceRole: 'evaluator-result',
    sourceName: suite.suiteKey,
    sourceVersion: String(suite.version),
    content: {
      uri: `domain://evaluation-report/${report.id}`,
      sha256: evaluationRecordDigest(report),
      mediaType: 'application/json',
      bytes: Buffer.byteLength(reportJson, 'utf8'),
      span: { kind: 'whole' }
    },
    scope: {
      environment: 'evaluation',
      system: 'migration-control-plane',
      entity: assignment.subject.id
    },
    dataClass,
    observedAt,
    effectiveFrom: observedAt,
    effectiveUntil: null,
    supersedesEvidenceId: null,
    limitations: suite.limitations
  })
  const evidenceReference = {
    id: evidence.id,
    version: evidence.version,
    digest: evaluationRecordDigest(evidence)
  }
  const contractMeasures = new Map(
    contract.measures
      .filter(
        (measure) =>
          measure.evaluator.id === assignment.evaluatorDefinition.id &&
          measure.evaluator.version === assignment.evaluatorDefinition.version &&
          measure.evaluator.digest === assignment.evaluatorDefinition.digest
      )
      .map((measure) => [measure.name, measure])
  )
  const measures = checks.map((check) => {
    const measure = contractMeasures.get(check.measureName)
    if (!measure) {
      throw evaluationRegistryFailure(
        'deterministic_contract_measure_mismatch',
        `Contract has no exact deterministic measure: ${check.measureName}`
      )
    }
    return {
      name: check.measureName,
      status: check.status,
      valueType: measure.valueType,
      unit: measure.unit,
      value: check.value,
      operator: measure.operator,
      threshold: measure.threshold,
      evidence: [evidenceReference],
      failureCode: check.failureCode
    }
  })
  const resultDraft = EvaluationResultV2Schema.parse({
    schemaVersion: 2,
    kind: 'evaluation-result',
    id: `evaluation_result_deterministic_${sha256Text(canonicalJson(identity)).slice(0, 32)}`,
    tenantId: assignment.tenantId,
    missionId: assignment.missionId,
    createdAt: observedAt,
    assignment: {
      id: assignment.id,
      evaluatorAttemptId: assignment.evaluatorExecution.attemptId,
      evaluatorFence: assignment.evaluatorExecution.fence,
      digest: evaluationRecordDigest(assignment)
    },
    contract: assignment.contract,
    evaluatorDefinition: assignment.evaluatorDefinition,
    subject: assignment.subject,
    status: reportStatus,
    measures,
    coverage: {
      requiredMeasureNames: [...contractMeasures.keys()],
      observedMeasureNames: measures.map((measure) => measure.name),
      missingMeasureNames: [],
      complete: true
    },
    evidence: [evidenceReference],
    limitations: suite.limitations,
    usage: {
      inputTokens: 0,
      outputTokens: 0,
      cacheReadTokens: 0,
      cacheWriteTokens: 0,
      toolCalls: 0,
      wallTimeMs: 0,
      costUsd: 0
    },
    completedAt: observedAt,
    resultDigest: '0'.repeat(64),
    acceptanceAuthority: 'none'
  })
  const result = EvaluationResultV2Schema.parse({
    ...resultDraft,
    resultDigest: evaluationResultDigest(resultDraft)
  })
  evaluationRegistry.recordResult(result)
  return { report, evidence, result }
}
