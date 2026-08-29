import { canonicalJson, sha256Text } from './canonical-json.js'
import type { EvaluationAssignmentV2 } from './domain/evaluation-assignment-contracts-v2.js'
import type {
  EvaluationContractMeasureV2,
  EvaluationInputRequirementV2
} from './domain/evaluation-contracts-v2.js'
import type {
  EvaluatorDefinitionV2,
  EvaluatorIndependenceRequirementV2
} from './domain/evaluation-definition-contracts-v2.js'
import type { EvaluationResultV2 } from './domain/evaluation-result-contracts-v2.js'

export function evaluationRecordDigest(record: unknown): string {
  return sha256Text(canonicalJson(record))
}

export function evaluationResultDigest(
  result: EvaluationResultV2 | Omit<EvaluationResultV2, 'resultDigest'>
): string {
  const payload = { ...result } as Partial<EvaluationResultV2>
  delete payload.resultDigest
  return evaluationRecordDigest(payload)
}

export function evaluationBudgetWithinDefinition(
  requested: EvaluationAssignmentV2['budget'],
  allowed: EvaluatorDefinitionV2['budget']
): boolean {
  return (Object.keys(requested) as (keyof EvaluationAssignmentV2['budget'])[]).every(
    (key) => requested[key] <= allowed[key]
  )
}

export function evaluationRecordActiveAt(
  record: { createdAt: string; revokedAt: string | null },
  at: string
): boolean {
  return (
    Date.parse(at) >= Date.parse(record.createdAt) &&
    (record.revokedAt === null || Date.parse(at) < Date.parse(record.revokedAt))
  )
}

export function evaluationIndependenceMeets(
  assignment: EvaluationAssignmentV2,
  required: EvaluatorIndependenceRequirementV2
): boolean {
  const observed = assignment.independence
  return (
    !required.producerMayEvaluate &&
    !observed.producerReasoningVisible &&
    (required.process !== 'different-required' || observed.process === 'different') &&
    (required.model !== 'different-required' || observed.model === 'different') &&
    (required.provider !== 'different-required' || observed.provider === 'different') &&
    observed.context === 'different' &&
    (required.credentials !== 'separate-required' || observed.credentials === 'separate') &&
    (required.sharedCorpus !== 'separate-required' || observed.sharedCorpus === 'separate')
  )
}

export function exactEvaluationRecordReference(
  record: { id: string; version: number },
  reference: { id: string; version: number; digest: string }
): boolean {
  return (
    record.id === reference.id &&
    record.version === reference.version &&
    evaluationRecordDigest(record) === reference.digest
  )
}

export function exactEvaluationSchemaReference(
  left: { name: string; version: number; digest: string },
  right: { name: string; version: number; digest: string }
): boolean {
  return left.name === right.name && left.version === right.version && left.digest === right.digest
}

export function exactEvaluationMeasure(
  actual: EvaluationResultV2['measures'][number],
  definition: EvaluationContractMeasureV2
): boolean {
  return (
    actual.name === definition.name &&
    actual.valueType === definition.valueType &&
    actual.unit === definition.unit &&
    actual.operator === definition.operator &&
    canonicalJson(actual.threshold) === canonicalJson(definition.threshold) &&
    (!definition.evidenceRequired || actual.evidence.length > 0)
  )
}

export function exactEvaluationInput(
  assignment: EvaluationAssignmentV2,
  requirement: EvaluationInputRequirementV2
): boolean {
  const input = assignment.inputs.find((candidate) => candidate.name === requirement.name)
  if (!input) {
    return !requirement.required
  }
  const ageMs = Date.parse(assignment.createdAt) - Date.parse(input.observedAt)
  return (
    input.recordKind === requirement.recordKind &&
    exactEvaluationSchemaReference(input.schema, requirement.schema) &&
    (!requirement.bindsSubject ||
      (input.recordId === assignment.subject.id &&
        input.recordVersion === assignment.subject.version &&
        input.digest === assignment.subject.digest)) &&
    input.evidence.length >= requirement.minimumEvidenceCount &&
    ageMs >= 0 &&
    (requirement.maxAgeMs === null || ageMs <= requirement.maxAgeMs)
  )
}
