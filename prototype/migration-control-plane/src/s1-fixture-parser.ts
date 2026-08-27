import type {
  DuplicateKey,
  ExpectedResults,
  FixtureManifest,
  IdentityMapping,
  IdentityProfile,
  MutationDefinition,
  NegativeCase,
  NegativeCaseClass,
  OmpWorkerContract,
  ProfileRow
} from './s1-fixture-contracts.js'
import {
  parseScalarRecord,
  requireInteger,
  requireRecord,
  requireString,
  requireStringArray
} from './runtime-validation.js'

const NEGATIVE_CASE_CLASSES: Record<NegativeCaseClass, true> = {
  'role-scope': true,
  'tenant-isolation': true,
  'stale-context': true,
  'retrieved-injection': true,
  'candidate-memory-non-use': true,
  'denied-input': true
}

export function parseFixtureManifest(value: unknown): FixtureManifest {
  const record = requireRecord(value, 'fixture manifest')
  if (record.schemaVersion !== 1) throw new TypeError('fixture manifest schemaVersion must be 1')
  if (!Array.isArray(record.files)) throw new TypeError('fixture manifest files must be an array')
  const files = record.files.map((item, index) => {
    const entry = requireRecord(item, `fixture manifest files[${index}]`)
    const sha256 = requireString(entry.sha256, `fixture manifest files[${index}].sha256`)
    if (!/^[a-f0-9]{64}$/.test(sha256)) throw new TypeError(`Invalid fixture digest: ${sha256}`)
    return {
      path: requireString(entry.path, `fixture manifest files[${index}].path`),
      sha256,
      bytes: requireInteger(entry.bytes, `fixture manifest files[${index}].bytes`)
    }
  })
  return {
    schemaVersion: 1,
    fixtureId: requireString(record.fixtureId, 'fixture manifest fixtureId'),
    license: requireString(record.license, 'fixture manifest license'),
    dataClass: requireString(record.dataClass, 'fixture manifest dataClass'),
    createdBy: requireString(record.createdBy, 'fixture manifest createdBy'),
    files
  }
}

export function parseIdentityProfile(value: unknown): IdentityProfile {
  const record = requireRecord(value, 'observed key profile')
  if (record.schemaVersion !== 1)
    throw new TypeError('observed key profile schemaVersion must be 1')
  const columns = requireStringArray(record.columns, 'observed key profile columns')
  if (!Array.isArray(record.rows)) throw new TypeError('observed key profile rows must be an array')
  const rows = record.rows.map((item, index) => parseProfileRow(item, columns, index))
  if (!Array.isArray(record.candidateKeys)) {
    throw new TypeError('observed key profile candidateKeys must be an array')
  }
  const candidateKeys = record.candidateKeys.map((item, index) => {
    const candidate = requireRecord(item, `candidateKeys[${index}]`)
    if (!Array.isArray(candidate.duplicates)) {
      throw new TypeError(`candidateKeys[${index}].duplicates must be an array`)
    }
    return {
      columns: requireStringArray(candidate.columns, `candidateKeys[${index}].columns`),
      distinctCount: requireInteger(
        candidate.distinctCount,
        `candidateKeys[${index}].distinctCount`
      ),
      nullCount: requireInteger(candidate.nullCount, `candidateKeys[${index}].nullCount`),
      duplicates: parseDuplicates(candidate.duplicates, `candidateKeys[${index}].duplicates`)
    }
  })
  return {
    schemaVersion: 1,
    fixtureId: requireString(record.fixtureId, 'observed key profile fixtureId'),
    entity: requireString(record.entity, 'observed key profile entity'),
    observedAt: requireString(record.observedAt, 'observed key profile observedAt'),
    columns,
    rows,
    candidateKeys
  }
}

function parseProfileRow(value: unknown, columns: readonly string[], index: number): ProfileRow {
  const row = requireRecord(value, `observed key profile rows[${index}]`)
  const parsed: ProfileRow = {}
  for (const column of columns) {
    const valueAtColumn = row[column]
    if (valueAtColumn !== null && typeof valueAtColumn !== 'string') {
      throw new TypeError(`observed key profile rows[${index}].${column} must be string or null`)
    }
    parsed[column] = valueAtColumn
  }
  return parsed
}

function parseDuplicates(value: unknown[], label: string): DuplicateKey[] {
  return value.map((item, index) => {
    const duplicate = requireRecord(item, `${label}[${index}]`)
    if (!Array.isArray(duplicate.values)) {
      throw new TypeError(`${label}[${index}].values must be an array`)
    }
    const values = duplicate.values.map((entry) => {
      if (entry !== null && typeof entry !== 'string') {
        throw new TypeError(`${label}[${index}].values contains invalid data`)
      }
      return entry
    })
    if (!Array.isArray(duplicate.rowIndexes)) {
      throw new TypeError(`${label}[${index}].rowIndexes must be an array`)
    }
    return {
      values,
      rowIndexes: duplicate.rowIndexes.map((entry, rowIndex) =>
        requireInteger(entry, `${label}[${index}].rowIndexes[${rowIndex}]`)
      )
    }
  })
}

export function parseExpectedResults(value: unknown): ExpectedResults {
  const record = requireRecord(value, 'expected results')
  if (record.schemaVersion !== 1) throw new TypeError('expected results schemaVersion must be 1')
  const decision = requireRecord(record.decision, 'expected results decision')
  const accepted = requireRecord(record.acceptedMapping, 'expected accepted mapping')
  if (!Array.isArray(record.probeResults))
    throw new TypeError('expected probeResults must be an array')
  return {
    schemaVersion: 1,
    decision: {
      id: requireString(decision.id, 'expected decision id'),
      sourceKey: requireStringArray(decision.sourceKey, 'expected decision sourceKey'),
      evidenceRefs: requireStringArray(decision.evidenceRefs, 'expected decision evidenceRefs')
    },
    probeResults: record.probeResults.map((item, index) => {
      const probe = requireRecord(item, `expected probeResults[${index}]`)
      if (typeof probe.unique !== 'boolean') {
        throw new TypeError(`expected probeResults[${index}].unique must be boolean`)
      }
      if (!Array.isArray(probe.duplicates)) {
        throw new TypeError(`expected probeResults[${index}].duplicates must be an array`)
      }
      return {
        columns: requireStringArray(probe.columns, `expected probeResults[${index}].columns`),
        rowCount: requireInteger(probe.rowCount, `expected probeResults[${index}].rowCount`),
        distinctCount: requireInteger(
          probe.distinctCount,
          `expected probeResults[${index}].distinctCount`
        ),
        nullCount: requireInteger(probe.nullCount, `expected probeResults[${index}].nullCount`),
        unique: probe.unique,
        duplicates: parseDuplicates(probe.duplicates, `expected probeResults[${index}].duplicates`)
      }
    }),
    acceptedMapping: parseIdentityMapping(accepted)
  }
}

export function parseIdentityMapping(record: Record<string, unknown>): IdentityMapping {
  if (record.schemaVersion !== 1) throw new TypeError('identity mapping schemaVersion must be 1')
  const mapping: IdentityMapping = {
    schemaVersion: 1,
    sourceEntity: requireString(record.sourceEntity, 'identity mapping sourceEntity'),
    targetEntity: requireString(record.targetEntity, 'identity mapping targetEntity'),
    sourceKey: requireStringArray(record.sourceKey, 'identity mapping sourceKey'),
    evidenceRefs: requireStringArray(record.evidenceRefs, 'identity mapping evidenceRefs'),
    decisionRef: requireString(record.decisionRef, 'identity mapping decisionRef')
  }
  if (record.description !== undefined) {
    mapping.description = requireString(record.description, 'identity mapping description')
  }
  return mapping
}

export function parseMutations(value: unknown): MutationDefinition[] {
  const record = requireRecord(value, 'mutations')
  if (record.schemaVersion !== 1 || !Array.isArray(record.mutations)) {
    throw new TypeError('mutations fixture is invalid')
  }
  return record.mutations.map((item, index) => {
    const mutation = requireRecord(item, `mutations[${index}]`)
    const className = requireString(mutation.class, `mutations[${index}].class`)
    const operation = requireString(mutation.operation, `mutations[${index}].operation`)
    const expectedVerdict = requireString(
      mutation.expectedVerdict,
      `mutations[${index}].expectedVerdict`
    )
    if (className !== 'critical' && className !== 'benign') {
      throw new TypeError(`Invalid mutation class: ${className}`)
    }
    if (operation !== 'drop-source-key-column' && operation !== 'add-description') {
      throw new TypeError(`Invalid mutation operation: ${operation}`)
    }
    if (expectedVerdict !== 'passed' && expectedVerdict !== 'failed') {
      throw new TypeError(`Invalid mutation verdict: ${expectedVerdict}`)
    }
    const parsed: MutationDefinition = {
      id: requireString(mutation.id, `mutations[${index}].id`),
      class: className,
      operation,
      expectedVerdict,
      expectedFailedMeasures: requireStringArray(
        mutation.expectedFailedMeasures,
        `mutations[${index}].expectedFailedMeasures`
      )
    }
    if (mutation.column !== undefined) {
      parsed.column = requireString(mutation.column, `mutations[${index}].column`)
    }
    if (mutation.description !== undefined) {
      parsed.description = requireString(mutation.description, `mutations[${index}].description`)
    }
    return parsed
  })
}

export function parseNegativeCases(value: unknown): NegativeCase[] {
  const record = requireRecord(value, 'negative cases')
  if (record.schemaVersion !== 1 || !Array.isArray(record.cases)) {
    throw new TypeError('negative cases fixture is invalid')
  }
  return record.cases.map((item, index) => {
    const negative = requireRecord(item, `negative cases[${index}]`)
    const className = requireString(
      negative.class,
      `negative cases[${index}].class`
    ) as NegativeCaseClass
    if (!Object.hasOwn(NEGATIVE_CASE_CLASSES, className)) {
      throw new TypeError(`Invalid negative case class: ${className}`)
    }
    const input = requireRecord(negative.input, `negative cases[${index}].input`)
    const expected = requireRecord(negative.expected, `negative cases[${index}].expected`)
    const parsedInput: Record<string, string> = {}
    for (const [key, inputValue] of Object.entries(input)) {
      parsedInput[key] = requireString(inputValue, `negative cases[${index}].input.${key}`)
    }
    return {
      id: requireString(negative.id, `negative cases[${index}].id`),
      class: className,
      input: parsedInput,
      expected: {
        decision: requireString(expected.decision, `negative cases[${index}].expected.decision`),
        reason: requireString(expected.reason, `negative cases[${index}].expected.reason`)
      }
    }
  })
}

export function parseOmpWorkerContract(value: unknown): OmpWorkerContract {
  const record = requireRecord(value, 'OMP worker contract')
  if (record.schemaVersion !== 1) {
    throw new TypeError('OMP worker contract schemaVersion must be 1')
  }
  const requiredOmp = requireRecord(record.requiredOmp, 'OMP worker contract requiredOmp')
  if (
    !Array.isArray(record.allowedHostTools) ||
    !Array.isArray(record.versionSkewCases) ||
    !Array.isArray(requiredOmp.protocolVersions)
  ) {
    throw new TypeError('OMP worker contract collections are invalid')
  }
  return {
    schemaVersion: 1,
    contractId: requireString(record.contractId, 'OMP worker contract contractId'),
    requiredOmp: {
      version: requireString(requiredOmp.version, 'required OMP version'),
      sourceCommit: requireString(requiredOmp.sourceCommit, 'required OMP sourceCommit'),
      protocolVersions: requiredOmp.protocolVersions.map((entry, index) =>
        requireInteger(entry, `protocolVersions[${index}]`)
      ),
      maxPhysicalFrameBytes: requireInteger(
        requiredOmp.maxPhysicalFrameBytes,
        'maxPhysicalFrameBytes'
      ),
      maxReassembledFrameBytes: requireInteger(
        requiredOmp.maxReassembledFrameBytes,
        'maxReassembledFrameBytes'
      )
    },
    allowedHostTools: record.allowedHostTools.map((item, index) => {
      const tool = requireRecord(item, `allowedHostTools[${index}]`)
      if (typeof tool.strict !== 'boolean') {
        throw new TypeError(`allowedHostTools[${index}].strict must be boolean`)
      }
      return {
        name: requireString(tool.name, `allowedHostTools[${index}].name`),
        approval: requireString(tool.approval, `allowedHostTools[${index}].approval`),
        strict: tool.strict,
        purpose: requireString(tool.purpose, `allowedHostTools[${index}].purpose`)
      }
    }),
    forbiddenTools: requireStringArray(record.forbiddenTools, 'forbiddenTools'),
    output: parseScalarRecord(record.output, 'OMP worker contract output'),
    cancellation: parseScalarRecord(record.cancellation, 'OMP worker contract cancellation'),
    evidenceCapture: parseScalarRecord(
      record.evidenceCapture,
      'OMP worker contract evidenceCapture'
    ),
    versionSkewCases: record.versionSkewCases.map((item, index) => {
      const skew = requireRecord(item, `versionSkewCases[${index}]`)
      return {
        observedVersion: requireString(
          skew.observedVersion,
          `versionSkewCases[${index}].observedVersion`
        ),
        expected: requireString(skew.expected, `versionSkewCases[${index}].expected`)
      }
    })
  }
}
