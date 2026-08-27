import { fileURLToPath } from 'node:url'
import { beforeEach, describe, expect, it } from 'vitest'
import {
  buildIdentityMappingBaseline,
  evaluateIdentityMapping
} from '../src/identity-mapping-evaluator.js'
import type { S1IdentityFixture } from '../src/s1-fixture-contracts.js'
import { loadS1IdentityFixture } from '../src/s1-fixture-loader.js'

const fixtureRoot = fileURLToPath(new URL('../fixtures/s1-identity-key', import.meta.url))
let fixture: S1IdentityFixture

beforeEach(async () => {
  fixture = await loadS1IdentityFixture(fixtureRoot)
})

describe('non-agent identity-mapping baseline', () => {
  it('selects the smallest observed unique key and passes all six measures', () => {
    const mapping = buildIdentityMappingBaseline(fixture)
    expect(mapping).toEqual(fixture.expected.acceptedMapping)

    const evaluation = evaluateIdentityMapping(fixture, mapping)
    expect(evaluation.status).toBe('passed')
    expect(evaluation.measures.map((measure) => [measure.name, measure.status])).toEqual([
      ['schema_valid', 'pass'],
      ['decision_alignment', 'pass'],
      ['source_key_complete', 'pass'],
      ['source_key_non_null', 'pass'],
      ['source_key_unique', 'pass'],
      ['evidence_reconstructable', 'pass']
    ])
  })

  it('does not depend on candidate declaration order', () => {
    const reordered: S1IdentityFixture = {
      ...fixture,
      profile: {
        ...fixture.profile,
        candidateKeys: [...fixture.profile.candidateKeys].reverse()
      }
    }
    expect(buildIdentityMappingBaseline(reordered).sourceKey).toEqual([
      'facility_id',
      'patient_num'
    ])
  })

  it('fails explicitly when no observed key is unique', () => {
    const noUniqueKey: S1IdentityFixture = {
      ...fixture,
      profile: {
        ...fixture.profile,
        candidateKeys: [fixture.profile.candidateKeys[0]!]
      }
    }
    expect(() => buildIdentityMappingBaseline(noUniqueKey)).toThrow(
      'No unique non-null source key exists'
    )
  })

  it('returns a failed schema measure instead of throwing on malformed output', () => {
    const evaluation = evaluateIdentityMapping(fixture, { schemaVersion: 1 })
    expect(evaluation.status).toBe('failed')
    expect(evaluation.measures[0]).toMatchObject({ name: 'schema_valid', status: 'fail' })
    expect(evaluation.measures.slice(1).every((measure) => measure.status === 'unknown')).toBe(true)
  })
})
