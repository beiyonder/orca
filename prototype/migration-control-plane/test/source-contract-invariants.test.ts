import { describe, expect, it } from 'vitest'
import type { DomainSchemaName } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_SCHEMA_REGISTRY } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

function sample(name: DomainSchemaName): Record<string, unknown> {
  return structuredClone(DOMAIN_CONTRACT_SAMPLES[name]) as Record<string, unknown>
}

function expectInvalid(name: DomainSchemaName, value: unknown, message?: string): void {
  const result = DOMAIN_SCHEMA_REGISTRY[name].safeParse(value)
  expect(result.success).toBe(false)
  if (!result.success && message) {
    expect(result.error.issues.map((issue) => issue.message)).toContain(message)
  }
}

describe('source adapter governance invariants', () => {
  it('binds adapter identity, unique capability, access expiry, and request parameters', () => {
    const definition = sample('source-adapter-definition.v1')
    definition.artifactDigest = 'f'.repeat(64)
    expectInvalid(
      'source-adapter-definition.v1',
      definition,
      'Source adapter artifact digest differs'
    )

    const duplicate = sample('source-adapter-definition.v1')
    duplicate.operations = ['inventory-system', 'inventory-system']
    expectInvalid(
      'source-adapter-definition.v1',
      duplicate,
      'Source adapter operations must be unique'
    )

    const access = sample('source-access-envelope.v1')
    access.expiresAt = access.issuedAt
    expectInvalid('source-access-envelope.v1', access, 'Source access must expire after issue')

    const request = sample('source-request.v1')
    request.parameters = { schemas: ['other'] }
    expectInvalid('source-request.v1', request, 'Source request parameter digest differs')
  })

  it('keeps denial distinct from absence and success dependent on complete coverage', () => {
    const denied = sample('source-observation.v1')
    denied.outcome = {
      status: 'denied',
      code: 'access-denied',
      denialEvidenceId: 'evidence_denial',
      scope: 'public.secret',
      reason: 'Permission denied.',
      absenceConclusion: true,
      retry: 'after-permission-change'
    }
    expectInvalid('source-observation.v1', denied)

    const incomplete = sample('source-observation.v1')
    const outcome = incomplete.outcome as Record<string, unknown>
    const coverage = outcome.coverage as Record<string, unknown>
    coverage.complete = false
    expectInvalid(
      'source-observation.v1',
      incomplete,
      'Successful observation requires full coverage'
    )
  })
})
