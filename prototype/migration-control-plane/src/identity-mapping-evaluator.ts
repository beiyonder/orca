import { canonicalizeJson } from './canonical-json.js'
import {
  createEvaluationMeasure as measure,
  type ExperimentResult
} from './experiment-contracts.js'
import { checkCandidateKey } from './identity-key-probe.js'
import { requireRecord } from './runtime-validation.js'
import type {
  IdentityMapping,
  MutationDefinition,
  S1IdentityFixture
} from './s1-fixture-contracts.js'
import { parseIdentityMapping } from './s1-fixture-parser.js'

export function buildIdentityMappingBaseline(fixture: S1IdentityFixture): IdentityMapping {
  const probes = fixture.profile.candidateKeys
    .map((candidate) => checkCandidateKey(fixture, candidate.columns))
    .filter((probe) => probe.unique)
    .sort((left, right) => {
      const width = left.columns.length - right.columns.length
      return width === 0
        ? left.columns.join('\u0000').localeCompare(right.columns.join('\u0000'))
        : width
    })
  const selected = probes[0]
  if (!selected) throw new Error('No unique non-null source key exists in the fixture')
  return {
    schemaVersion: 1,
    sourceEntity: fixture.profile.entity,
    targetEntity: 'patient',
    sourceKey: [...selected.columns],
    evidenceRefs: [...fixture.expected.decision.evidenceRefs],
    decisionRef: fixture.expected.decision.id
  }
}

export function evaluateIdentityMapping(
  fixture: S1IdentityFixture,
  subject: unknown
): ExperimentResult {
  let mapping: IdentityMapping
  try {
    mapping = parseIdentityMapping(requireRecord(subject, 'identity mapping subject'))
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return {
      status: 'failed',
      summary: 'Identity mapping schema is invalid.',
      measures: [
        measure(
          'schema_valid',
          'fail',
          { error: message },
          'valid identity-mapping schemaVersion=1',
          ['identity-mapping.schema.json']
        ),
        ...[
          'decision_alignment',
          'source_key_complete',
          'source_key_non_null',
          'source_key_unique',
          'evidence_reconstructable'
        ].map((name) => measure(name, 'unknown', null, 'schema_valid must pass first', []))
      ],
      outputs: {},
      limitations: []
    }
  }

  const decision = fixture.expected.decision
  const decisionAligned =
    mapping.sourceKey.length === decision.sourceKey.length &&
    mapping.sourceKey.every((value, index) => value === decision.sourceKey[index]) &&
    mapping.decisionRef === decision.id &&
    decision.evidenceRefs.every((reference) => mapping.evidenceRefs.includes(reference))
  const complete = mapping.sourceKey.every((column) => fixture.profile.columns.includes(column))
  const probe = complete ? checkCandidateKey(fixture, mapping.sourceKey) : null
  const manifestPaths = new Set(fixture.manifest.files.map((entry) => entry.path))
  const evidenceReconstructable =
    mapping.evidenceRefs.every((reference) => manifestPaths.has(reference)) &&
    mapping.decisionRef === decision.id

  const measures = [
    measure('schema_valid', 'pass', true, 'valid identity-mapping schemaVersion=1', [
      'identity-mapping.schema.json'
    ]),
    measure(
      'decision_alignment',
      decisionAligned ? 'pass' : 'fail',
      { sourceKey: mapping.sourceKey, decisionRef: mapping.decisionRef },
      `sourceKey=${decision.sourceKey.join('+')} and decisionRef=${decision.id}`,
      ['expected-results.json']
    ),
    measure(
      'source_key_complete',
      complete ? 'pass' : 'fail',
      mapping.sourceKey,
      'every source key column exists in observed profile',
      ['observed-key-profile.json']
    ),
    measure(
      'source_key_non_null',
      probe ? (probe.nullCount === 0 ? 'pass' : 'fail') : 'unknown',
      probe?.nullCount ?? null,
      'nullCount == 0',
      ['observed-key-profile.json']
    ),
    measure(
      'source_key_unique',
      probe ? (probe.unique ? 'pass' : 'fail') : 'unknown',
      probe
        ? {
            rowCount: probe.rowCount,
            distinctCount: probe.distinctCount,
            duplicates: probe.duplicates
          }
        : null,
      'distinctCount == rowCount and duplicates == []',
      ['observed-key-profile.json']
    ),
    measure(
      'evidence_reconstructable',
      evidenceReconstructable ? 'pass' : 'fail',
      mapping.evidenceRefs,
      'every evidence ref resolves and decisionRef is current',
      ['fixture-manifest.json', 'expected-results.json']
    )
  ]
  const failed = measures.filter((entry) => entry.status !== 'pass')
  return {
    status: failed.length === 0 ? 'passed' : 'failed',
    summary:
      failed.length === 0
        ? 'Identity mapping satisfies every deterministic acceptance measure.'
        : `Identity mapping failed: ${failed.map((entry) => entry.name).join(', ')}.`,
    measures,
    outputs: {
      mapping: canonicalizeJson(mapping),
      probe: canonicalizeJson(probe)
    },
    limitations: ['Synthetic six-row profile; no clinical or production data semantics.']
  }
}

export function applyIdentityMappingMutation(
  mapping: IdentityMapping,
  mutation: MutationDefinition
): IdentityMapping {
  if (mutation.operation === 'drop-source-key-column') {
    if (!mutation.column) throw new Error(`${mutation.id} is missing its column`)
    return {
      ...mapping,
      sourceKey: mapping.sourceKey.filter((column) => column !== mutation.column)
    }
  }
  if (!mutation.description) throw new Error(`${mutation.id} is missing its description`)
  return { ...mapping, description: mutation.description }
}
