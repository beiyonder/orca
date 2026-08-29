import { describe, expect, it } from 'vitest'
import {
  SourceAdapterRegistry,
  SourceAdapterRegistryError
} from '../src/source-adapter-registry.js'
import { SOURCE_CONTRACT_SAMPLES } from './source-contract-samples.js'

const definition = () => structuredClone(SOURCE_CONTRACT_SAMPLES['source-adapter-definition.v1'])
const access = () => structuredClone(SOURCE_CONTRACT_SAMPLES['source-access-envelope.v1'])
const request = () => structuredClone(SOURCE_CONTRACT_SAMPLES['source-request.v1'])
const observation = () => structuredClone(SOURCE_CONTRACT_SAMPLES['source-observation.v1'])

function expectRegistryError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected source adapter registry error')
  } catch (error) {
    if (!(error instanceof SourceAdapterRegistryError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

function activeRegistry(): SourceAdapterRegistry {
  const registry = new SourceAdapterRegistry()
  registry.registerDefinition(definition())
  registry.issueAccess(access())
  return registry
}

describe('source adapter registry', () => {
  it('records immutable definitions, access, requests, observations, and reconstruction', () => {
    const registry = activeRegistry()
    registry.admitRequest(request())
    registry.recordObservation(observation())
    expect(() => registry.registerDefinition(definition())).not.toThrow()
    expect(() => registry.issueAccess(access())).not.toThrow()
    expect(() => registry.admitRequest(request())).not.toThrow()
    expect(() => registry.recordObservation(observation())).not.toThrow()
    expect(() =>
      SourceAdapterRegistry.reconstruct({
        definitions: [definition()],
        accessEnvelopes: [access()],
        requests: [request()],
        observations: [observation()]
      })
    ).not.toThrow()
  })

  it('rejects expanded operation, data, limits, endpoint, and unsupported source version', () => {
    const definitionOnly = new SourceAdapterRegistry()
    definitionOnly.registerDefinition(definition())
    for (const changed of [
      { ...access(), allowedOperations: ['inspect-cdc'] },
      { ...access(), dataClasses: ['confidential'] },
      { ...access(), limits: { ...access().limits, queryLimit: 201 } },
      { ...access(), networkEndpointDigests: ['c'.repeat(64)] },
      { ...access(), source: { ...access().source, engineVersion: '17.0' } }
    ]) {
      expect(() => definitionOnly.issueAccess(changed)).toThrow(SourceAdapterRegistryError)
    }
  })

  it('rejects request authority mismatch, expiry, revocation, and exhausted use', () => {
    const registry = activeRegistry()
    expectRegistryError(
      () => registry.admitRequest({ ...request(), operation: 'inspect-cdc' }),
      'request_not_authorized'
    )
    expectRegistryError(
      () =>
        registry.admitRequest({
          ...request(),
          id: 'source_request_pagila_expired',
          createdAt: '2026-01-01T01:00:00.000Z'
        }),
      'request_not_authorized'
    )
    registry.admitRequest(request())
    registry.admitRequest({ ...request(), id: 'source_request_pagila_inventory_2' })
    expectRegistryError(
      () => registry.admitRequest({ ...request(), id: 'source_request_pagila_inventory_3' }),
      'access_exhausted'
    )
  })

  it('rejects mismatched, over-limit, and duplicate observations', () => {
    const registry = activeRegistry()
    registry.admitRequest(request())
    expectRegistryError(
      () =>
        registry.recordObservation({
          ...observation(),
          requestId: 'source_request_other'
        }),
      'request_mismatch'
    )
    expectRegistryError(
      () =>
        registry.recordObservation({
          ...observation(),
          usage: { ...observation().usage, queryCount: 21 }
        }),
      'observation_limit_exceeded'
    )
    registry.recordObservation(observation())
    expectRegistryError(
      () =>
        registry.recordObservation({
          ...observation(),
          id: 'source_observation_pagila_inventory_2'
        }),
      'observation_exists'
    )
  })
})
