import { canonicalJson, sha256Text } from './canonical-json.js'
import type { EvaluationAssignmentV2 } from './domain/evaluation-assignment-contracts-v2.js'
import type { EvaluationContractV2 } from './domain/evaluation-contracts-v2.js'
import type { EvaluatorDefinitionV2 } from './domain/evaluation-definition-contracts-v2.js'
import { evaluationCoordinationFailure } from './evaluation-coordination-registry.js'

export function stableEvaluationCoordinatorId(prefix: string, input: unknown): string {
  return `${prefix}_${sha256Text(canonicalJson(input)).slice(0, 32)}`
}

function routeIdentity(route: EvaluationAssignmentV2['producer']['modelRoute']): string | null {
  return route === null ? null : `${route.provider}\u0000${route.model}\u0000${route.revision}`
}

function observedDimension(
  applicable: boolean,
  left: string | null,
  right: string | null,
  label: string
): 'different' | 'same' | 'not-applicable' {
  if (!applicable) {
    return 'not-applicable'
  }
  if (left === null || right === null) {
    throw evaluationCoordinationFailure(
      'independence_unobservable',
      `Cannot observe required ${label} independence`
    )
  }
  return left === right ? 'same' : 'different'
}

export function deriveEvaluatorIndependence(input: {
  contract: EvaluationContractV2
  definition: EvaluatorDefinitionV2
  producer: EvaluationAssignmentV2['producer']
  evaluator: EvaluationAssignmentV2['evaluatorExecution']
  sharedCorpus: EvaluationAssignmentV2['independence']['sharedCorpus']
}): EvaluationAssignmentV2['independence'] {
  const { contract, definition, producer, evaluator } = input
  const producerRoute = routeIdentity(producer.modelRoute)
  const evaluatorRoute = routeIdentity(evaluator.modelRoute)
  const modelApplicable =
    contract.independence.model !== 'not-applicable' ||
    definition.independence.model !== 'not-applicable'
  const providerApplicable =
    contract.independence.provider !== 'not-applicable' ||
    definition.independence.provider !== 'not-applicable'
  const credentialApplicable =
    contract.independence.credentials !== 'not-applicable' ||
    definition.independence.credentials !== 'not-applicable'
  const credentialObservation = observedDimension(
    credentialApplicable,
    producer.credentialScopeDigest,
    evaluator.credentialScopeDigest,
    'credential'
  )
  return {
    process:
      contract.independence.process === 'not-applicable' &&
      definition.independence.process === 'not-applicable'
        ? 'not-applicable'
        : producer.processIdentity === evaluator.processIdentity
          ? 'same'
          : 'different',
    model: observedDimension(modelApplicable, producerRoute, evaluatorRoute, 'model'),
    provider: observedDimension(
      providerApplicable,
      producer.modelRoute?.provider ?? null,
      evaluator.modelRoute?.provider ?? null,
      'provider'
    ),
    context: producer.contextDigest === evaluator.contextDigest ? 'same' : 'different',
    credentials:
      credentialObservation === 'not-applicable'
        ? 'not-applicable'
        : credentialObservation === 'same'
          ? 'shared'
          : 'separate',
    producerReasoningVisible: false,
    sharedCorpus: input.sharedCorpus
  }
}
