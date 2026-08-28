import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { canonicalJson, sha256Text } from '../src/canonical-json.js'
import {
  applyIdentityMappingMutation,
  buildIdentityMappingBaseline,
  evaluateIdentityMapping
} from '../src/identity-mapping-evaluator.js'
import { checkCandidateKey } from '../src/identity-key-probe.js'
import { validateOmpWorkerContract } from '../src/omp-worker-contract-validation.js'
import { calibrateS1Fixture, inspectOmpWorkerFixture } from '../src/s1-fixture-calibration.js'
import type { S1IdentityFixture } from '../src/s1-fixture-contracts.js'
import { loadS1IdentityFixture } from '../src/s1-fixture-loader.js'
import { evaluateNegativeCase } from '../src/s1-negative-case-policy.js'

const fixtureRoot = fileURLToPath(new URL('../fixtures/s1-identity-key', import.meta.url))
const temporaryRoots: string[] = []
let fixture: S1IdentityFixture
function containmentReport(): Record<string, unknown> {
  const body = {
    schemaVersion: 1,
    experimentId: 'EXP-10',
    runId: 'exp-10-fixture',
    status: 'passed',
    ompVersion: 'omp/18.0.6',
    executableDigest: 'a'.repeat(64),
    protocolVersion: 2,
    maxPhysicalFrameBytes: 1_048_576,
    maxReassembledFrameBytes: 67_108_864,
    contextDeliveryDigest: 'b'.repeat(64),
    measures: [
      'pinned-binary',
      'v2-negotiation',
      'subagent-containment',
      'host-tool-schema',
      'context-host-tool-artifact',
      'context-and-cancellation',
      'post-cancel-tool-effect',
      'flood-and-context-overflow',
      'malformed-frame',
      'crash-replacement',
      'bounded-observation'
    ].map((name) => ({ name, passed: true, evidence: name })),
    protocolFrameCategories: ['ready', 'response', 'event', 'error', 'host-tool-call'],
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: '2026-01-01T00:00:10.000Z'
  }
  return { ...body, reportDigest: sha256Text(canonicalJson(body)) }
}

beforeEach(async () => {
  fixture = await loadS1IdentityFixture(fixtureRoot)
})

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true }))
  )
})

describe('S1 identity-key fixture', () => {
  it('pins synthetic provenance, checksums, six rows, and the contradiction', () => {
    expect(fixture.manifest).toMatchObject({
      schemaVersion: 1,
      fixtureId: 's1-identity-key-v1',
      license: 'MIT',
      dataClass: 'synthetic-no-phi'
    })
    expect(fixture.manifest.files).toHaveLength(8)
    expect(fixture.profile.rows).toHaveLength(6)
    expect(checkCandidateKey(fixture, ['patient_num'])).toMatchObject({
      rowCount: 6,
      distinctCount: 5,
      nullCount: 0,
      unique: false,
      duplicates: [{ values: ['P-100'], rowIndexes: [0, 2] }]
    })
    expect(checkCandidateKey(fixture, ['facility_id', 'patient_num'])).toMatchObject({
      rowCount: 6,
      distinctCount: 6,
      nullCount: 0,
      unique: true,
      duplicates: []
    })
  })

  it('rejects a fixture body whose bytes no longer match the manifest', async () => {
    const root = await mkdtemp(join(tmpdir(), 'orca-s1-fixture-'))
    temporaryRoots.push(root)
    await cp(fixtureRoot, root, { recursive: true })
    await writeFile(join(root, 'customer-architecture.md'), 'tampered\n')
    await expect(loadS1IdentityFixture(root)).rejects.toThrow(
      'Fixture byte size mismatch: customer-architecture.md'
    )
  })

  it('calibrates the deterministic probe, mutations, negatives, and worker contract', () => {
    const calibration = calibrateS1Fixture(fixture)
    expect(calibration.status).toBe('passed')
    expect(calibration.measures).toHaveLength(6)
    expect(calibration.measures.every((measure) => measure.status === 'pass')).toBe(true)
    expect(validateOmpWorkerContract(fixture.workerContract)).toEqual([])

    const worker = inspectOmpWorkerFixture(fixture)
    expect(worker.status).toBe('inconclusive')
    expect(worker.measures).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'worker_contract_valid', status: 'pass' }),
        expect.objectContaining({ name: 'omp_binary_exercised', status: 'unknown' })
      ])
    )
  })

  it('closes WORKER-EXP-01 only with an intact passing real-binary containment report', () => {
    const passed = inspectOmpWorkerFixture(fixture, containmentReport())
    expect(passed).toMatchObject({
      status: 'passed',
      limitations: [],
      measures: [
        { name: 'worker_contract_valid', status: 'pass' },
        { name: 'omp_binary_exercised', status: 'pass' }
      ]
    })
    const tampered = { ...containmentReport(), reportDigest: 'f'.repeat(64) }
    expect(inspectOmpWorkerFixture(fixture, tampered)).toMatchObject({
      status: 'failed',
      measures: [expect.any(Object), { name: 'omp_binary_exercised', status: 'fail' }]
    })
  })

  it('kills the critical mutation and accepts the benign mutation', () => {
    const baseline = buildIdentityMappingBaseline(fixture)
    const critical = fixture.mutations.find((mutation) => mutation.class === 'critical')
    const benign = fixture.mutations.find((mutation) => mutation.class === 'benign')
    expect(critical).toBeDefined()
    expect(benign).toBeDefined()

    const criticalResult = evaluateIdentityMapping(
      fixture,
      applyIdentityMappingMutation(baseline, critical!)
    )
    expect(criticalResult.status).toBe('failed')
    expect(
      criticalResult.measures
        .filter((measure) => measure.status === 'fail')
        .map((measure) => measure.name)
        .sort()
    ).toEqual(['decision_alignment', 'source_key_unique'])

    const benignResult = evaluateIdentityMapping(
      fixture,
      applyIdentityMappingMutation(baseline, benign!)
    )
    expect(benignResult.status).toBe('passed')
  })

  it('enforces every isolation and injection negative deterministically', () => {
    expect(fixture.negativeCases.map((testCase) => testCase.id)).toEqual([
      'NEG-ROLE-SCOPE-001',
      'NEG-TENANT-001',
      'NEG-STALE-CONTEXT-001',
      'NEG-INJECTION-001',
      'NEG-MEMORY-001',
      'NEG-DENIED-INPUT-001'
    ])
    for (const testCase of fixture.negativeCases) {
      expect(evaluateNegativeCase(testCase)).toEqual(testCase.expected)
    }
  })
})
