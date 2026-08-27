import type { DuplicateKey, KeyProbeResult, S1IdentityFixture } from './s1-fixture-contracts.js'

export function checkCandidateKey(
  fixture: S1IdentityFixture,
  columns: readonly string[]
): KeyProbeResult {
  if (columns.length === 0 || new Set(columns).size !== columns.length) {
    throw new TypeError('Candidate key columns must be non-empty and unique')
  }
  for (const column of columns) {
    if (!fixture.profile.columns.includes(column)) {
      throw new TypeError(`Unknown candidate key column: ${column}`)
    }
  }

  const groups = new Map<string, DuplicateKey>()
  let nullCount = 0
  fixture.profile.rows.forEach((row, rowIndex) => {
    const values = columns.map((column) => row[column] ?? null)
    if (values.some((value) => value === null)) nullCount += 1
    const key = JSON.stringify(values)
    const existing = groups.get(key)
    if (existing) {
      existing.rowIndexes.push(rowIndex)
    } else {
      groups.set(key, { values, rowIndexes: [rowIndex] })
    }
  })

  const duplicates = [...groups.values()]
    .filter((group) => group.rowIndexes.length > 1)
    .map((group) => ({ values: [...group.values], rowIndexes: [...group.rowIndexes] }))
  const evidenceEntry = fixture.manifest.files.find(
    (entry) => entry.path === 'observed-key-profile.json'
  )
  if (!evidenceEntry) throw new Error('Observed profile is missing from fixture manifest')

  return {
    columns: [...columns],
    rowCount: fixture.profile.rows.length,
    distinctCount: groups.size,
    nullCount,
    unique: nullCount === 0 && groups.size === fixture.profile.rows.length,
    duplicates,
    evidenceDigest: evidenceEntry.sha256
  }
}
