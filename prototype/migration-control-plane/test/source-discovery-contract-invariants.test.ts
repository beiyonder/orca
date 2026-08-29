import { describe, expect, it } from 'vitest'
import type { DomainSchemaName } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_SCHEMA_REGISTRY } from '../src/domain/domain-contract-registry.js'
import { DOMAIN_CONTRACT_SAMPLES } from './domain-contract-samples.js'

function sample(name: DomainSchemaName): Record<string, unknown> {
  return structuredClone(DOMAIN_CONTRACT_SAMPLES[name]) as Record<string, unknown>
}

function expectInvalid(name: DomainSchemaName, value: unknown, message: string): void {
  const result = DOMAIN_SCHEMA_REGISTRY[name].safeParse(value)
  expect(result.success).toBe(false)
  if (!result.success) {
    expect(result.error.issues.map((issue) => issue.message)).toContain(message)
  }
}

describe('source discovery contract invariants', () => {
  it('requires unique inventory identities and internally consistent profile coverage', () => {
    const inventory = sample('source-schema-inventory.v1')
    const relations = inventory.relations as Record<string, unknown>[]
    relations.push(structuredClone(relations[0]!))
    expectInvalid(
      'source-schema-inventory.v1',
      inventory,
      'Inventory relation identities must be unique'
    )

    const profile = sample('source-data-profile.v1')
    const coverage = profile.coverage as Record<string, unknown>
    coverage.profiled = 0
    expectInvalid('source-data-profile.v1', profile, 'Source profile coverage counts disagree')
  })

  it('binds extracted code to artifact bytes and exact coverage', () => {
    const digest = sample('source-code-extract.v1')
    digest.contentDigest = 'f'.repeat(64)
    expectInvalid('source-code-extract.v1', digest, 'Source code artifact digest differs')

    const coverage = sample('source-code-extract.v1')
    const state = coverage.coverage as Record<string, unknown>
    state.extracted = 0
    expectInvalid('source-code-extract.v1', coverage, 'Source code coverage count disagrees')
  })

  it('requires unique lineage identities and existing edge endpoints', () => {
    const endpoint = sample('source-lineage-snapshot.v1')
    const edges = endpoint.edges as Record<string, unknown>[]
    edges[0]!.toNodeId = 'relation:public.missing'
    expectInvalid('source-lineage-snapshot.v1', endpoint, 'Lineage edge endpoint is missing')

    const duplicate = sample('source-lineage-snapshot.v1')
    const nodes = duplicate.nodes as Record<string, unknown>[]
    nodes.push(structuredClone(nodes[0]!))
    expectInvalid('source-lineage-snapshot.v1', duplicate, 'Lineage node identities must be unique')
  })
})
