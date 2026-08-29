import { canonicalJson, canonicalizeJson, sha256Text, type JsonValue } from './canonical-json.js'
import type { DeterministicEvaluatorSuiteV1 } from './domain/deterministic-evaluator-contracts.js'
import type { EvaluationAssignmentV2 } from './domain/evaluation-assignment-contracts-v2.js'
import type { EvaluationContractV2 } from './domain/evaluation-contracts-v2.js'
import type { EvaluatorDefinitionV2 } from './domain/evaluation-definition-contracts-v2.js'
import { EvidenceItemV1Schema } from './domain/epistemic-contracts.js'
import { DOMAIN_SCHEMA_REGISTRY, type DomainSchemaName } from './domain/domain-contract-registry.js'
import { evaluationRecordDigest } from './evaluation-contract-registry.js'

type CheckOutcome = {
  passed: boolean
  details: JsonValue
}

export type DeterministicCheckResult = {
  measureName: string
  check: DeterministicEvaluatorSuiteV1['operations'][number]['check']
  status: 'pass' | 'fail'
  value: boolean
  failureCode: string | null
  details: JsonValue
}

function record(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}
const NON_EFFECT_AUTHORITIES = new Set(['none', 'proposal-only', 'read-only'])

function safeSubjectJson(subject: unknown): { json: string | null; error: string | null } {
  try {
    return { json: canonicalJson(subject), error: null }
  } catch (error) {
    return { json: null, error: error instanceof Error ? error.message : String(error) }
  }
}

function exactSchema(
  left: DeterministicEvaluatorSuiteV1['subject']['schema'],
  right: DeterministicEvaluatorSuiteV1['subject']['schema']
): boolean {
  return left.name === right.name && left.version === right.version && left.digest === right.digest
}

export function evaluateDeterministicChecks(input: {
  assignment: EvaluationAssignmentV2
  contract: EvaluationContractV2
  definition: EvaluatorDefinitionV2
  suite: DeterministicEvaluatorSuiteV1
  subject: unknown
  inputEvidence: readonly unknown[]
  dataClass: EvaluatorDefinitionV2['requiredDataClasses'][number]
}): DeterministicCheckResult[] {
  const { assignment, contract, definition, suite } = input
  const subjectRecord = record(input.subject)
  const serialized = safeSubjectJson(input.subject)
  const subjectBytes = serialized.json === null ? null : Buffer.byteLength(serialized.json, 'utf8')
  const subjectDigest = serialized.json === null ? null : sha256Text(serialized.json)
  const schema = DOMAIN_SCHEMA_REGISTRY[suite.subject.schema.name as DomainSchemaName]
  const parsedSubject = schema?.safeParse(input.subject)
  const structural = {
    passed:
      serialized.json !== null &&
      subjectRecord !== null &&
      typeof subjectRecord.schemaVersion === 'number' &&
      typeof subjectRecord.kind === 'string' &&
      typeof subjectRecord.id === 'string',
    details: canonicalizeJson({
      object: subjectRecord !== null,
      hasSchemaVersion: typeof subjectRecord?.schemaVersion === 'number',
      hasKind: typeof subjectRecord?.kind === 'string',
      hasId: typeof subjectRecord?.id === 'string',
      serializationError: serialized.error
    })
  } satisfies CheckOutcome
  const runtimeTypes = {
    passed: parsedSubject?.success === true,
    details: canonicalizeJson(
      parsedSubject?.success === false
        ? parsedSubject.error.issues.slice(0, 32).map((issue) => ({
            path: issue.path.map(String).join('/'),
            message: issue.message
          }))
        : { schemaRegistered: schema !== undefined }
    )
  } satisfies CheckOutcome

  const evidenceReferences = assignment.inputs.flatMap(
    (assignmentInput) => assignmentInput.evidence
  )
  const expectedEvidence = new Map<string, (typeof evidenceReferences)[number]>()
  let evidenceValid = input.inputEvidence.length <= suite.executionPolicy.maximumEvidenceItems
  for (const reference of evidenceReferences) {
    const existing = expectedEvidence.get(reference.id)
    if (
      existing &&
      (existing.version !== reference.version || existing.digest !== reference.digest)
    ) {
      evidenceValid = false
    }
    expectedEvidence.set(reference.id, reference)
  }
  const evidenceById = new Map<string, ReturnType<typeof EvidenceItemV1Schema.parse>>()
  for (const candidate of input.inputEvidence) {
    const parsed = EvidenceItemV1Schema.safeParse(candidate)
    if (!parsed.success) {
      evidenceValid = false
      continue
    }
    if (evidenceById.has(parsed.data.id)) {
      evidenceValid = false
      continue
    }
    evidenceById.set(parsed.data.id, parsed.data)
  }
  if (evidenceById.size !== expectedEvidence.size) {
    evidenceValid = false
  }
  for (const [id, reference] of expectedEvidence) {
    const evidence = evidenceById.get(id)
    if (
      !evidence ||
      evidence.version !== reference.version ||
      evaluationRecordDigest(evidence) !== reference.digest
    ) {
      evidenceValid = false
    }
  }
  const boundInput = assignment.inputs.find(
    (assignmentInput) =>
      assignmentInput.recordId === assignment.subject.id &&
      assignmentInput.recordVersion === assignment.subject.version
  )
  const contractLineage = {
    passed:
      subjectDigest === assignment.subject.digest &&
      boundInput?.digest === assignment.subject.digest &&
      evidenceValid,
    details: canonicalizeJson({
      subjectDigestMatches: subjectDigest === assignment.subject.digest,
      subjectInputBound: boundInput?.digest === assignment.subject.digest,
      evidenceValid,
      evidenceReferenceCount: evidenceReferences.length
    })
  } satisfies CheckOutcome
  const compatibility = {
    passed:
      schema !== undefined &&
      exactSchema(assignment.subject.schema, suite.subject.schema) &&
      exactSchema(contract.subject.schema, suite.subject.schema) &&
      assignment.subject.kind === suite.subject.kind &&
      contract.subject.kind === suite.subject.kind &&
      subjectRecord?.schemaVersion === suite.subject.schema.version &&
      subjectRecord?.kind === suite.subject.kind,
    details: canonicalizeJson({
      schemaRegistered: schema !== undefined,
      assignmentSchemaMatches: exactSchema(assignment.subject.schema, suite.subject.schema),
      contractSchemaMatches: exactSchema(contract.subject.schema, suite.subject.schema),
      subjectSchemaVersion: subjectRecord?.schemaVersion ?? null,
      requiredSchemaVersion: suite.subject.schema.version
    })
  } satisfies CheckOutcome
  const noAccess = canonicalJson(definition.requiredAccess) === canonicalJson(['none'])
  const missionMatches =
    subjectRecord !== null &&
    (subjectRecord.missionId === undefined || subjectRecord.missionId === assignment.missionId)
  const declaredAuthority = subjectRecord?.authority
  const authorityAllowed =
    declaredAuthority === undefined ||
    (typeof declaredAuthority === 'string' && NON_EFFECT_AUTHORITIES.has(declaredAuthority))
  const embeddedAcceptanceAuthority = subjectRecord?.acceptanceAuthority
  const embeddedAcceptanceAllowed =
    embeddedAcceptanceAuthority === undefined || embeddedAcceptanceAuthority === 'none'
  const policy = {
    passed:
      subjectBytes !== null &&
      subjectBytes <= suite.executionPolicy.maximumSubjectBytes &&
      definition.requiredDataClasses.includes(input.dataClass) &&
      noAccess &&
      definition.requiredTools.length === 0 &&
      definition.implementation.modelRoute === null &&
      assignment.evaluatorExecution.actor.kind === 'evaluator' &&
      assignment.acceptanceAuthority === 'none' &&
      subjectRecord?.tenantId === assignment.tenantId &&
      missionMatches &&
      authorityAllowed &&
      embeddedAcceptanceAllowed,
    details: canonicalizeJson({
      subjectBytes,
      maximumSubjectBytes: suite.executionPolicy.maximumSubjectBytes,
      dataClassAllowed: definition.requiredDataClasses.includes(input.dataClass),
      noAccess,
      noTools: definition.requiredTools.length === 0,
      noModel: definition.implementation.modelRoute === null,
      evaluatorActor: assignment.evaluatorExecution.actor.kind,
      tenantMatches: subjectRecord?.tenantId === assignment.tenantId,
      missionMatches,
      authorityAllowed,
      embeddedAcceptanceAllowed
    })
  } satisfies CheckOutcome
  const outcomes: Record<DeterministicCheckResult['check'], CheckOutcome> = {
    'structural-schema': structural,
    'runtime-types': runtimeTypes,
    'contract-lineage': contractLineage,
    'version-compatibility': compatibility,
    'authority-policy': policy
  }
  return suite.operations.map((operation) => {
    const outcome = outcomes[operation.check]
    return {
      measureName: operation.measureName,
      check: operation.check,
      status: outcome.passed ? 'pass' : 'fail',
      value: outcome.passed,
      failureCode: outcome.passed
        ? null
        : `deterministic_${operation.check.replaceAll('-', '_')}_failed`,
      details: outcome.details
    }
  })
}
