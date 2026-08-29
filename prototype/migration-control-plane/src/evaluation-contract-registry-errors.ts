import { canonicalJson } from './canonical-json.js'

export class EvaluationContractRegistryError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'EvaluationContractRegistryError'
    this.code = code
  }
}

export function evaluationRegistryFailure(
  code: string,
  message: string,
  cause?: unknown
): EvaluationContractRegistryError {
  return new EvaluationContractRegistryError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  )
}

export function putImmutableEvaluationRecord<T extends object>(
  map: Map<string, T>,
  id: string,
  value: T
): T {
  const existing = map.get(id)
  if (existing) {
    if (canonicalJson(existing) !== canonicalJson(value)) {
      throw evaluationRegistryFailure(
        'immutable_conflict',
        `Evaluation record differs for reused ID: ${id}`
      )
    }
    return structuredClone(existing)
  }
  const stored = structuredClone(value)
  map.set(id, stored)
  return structuredClone(stored)
}
