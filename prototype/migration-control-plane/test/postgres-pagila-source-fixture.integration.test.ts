import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { Client } from 'pg'
import { afterEach, describe, expect, it } from 'vitest'
import { loadPagilaSourceFixture } from '../src/pagila-source-fixture-loader.js'
import { createPostgresTestDatabase, type PostgresTestDatabase } from './postgres-test-databases.js'

const fixtureRoot = fileURLToPath(new URL('../fixtures/p6-pagila-v3.1.0/', import.meta.url))
const databases: PostgresTestDatabase[] = []

afterEach(async () => {
  await Promise.all(databases.splice(0).map(async (database) => database.drop()))
})

describe('PostgreSQL Pagila source fixture', () => {
  it('loads on the pinned runtime envelope and reproduces the expected estate', async () => {
    const fixture = await loadPagilaSourceFixture(fixtureRoot)
    const database = await createPostgresTestDatabase({ encoding: 'UTF8', collation: 'C' })
    databases.push(database)
    const client = new Client({ connectionString: database.connectionString })
    await client.connect()
    try {
      await client.query(await readFile(fixture.schemaPath, 'utf8'))
      await client.query(await readFile(fixture.dataPath, 'utf8'))
      const runtime = await client.query<{ name: string; setting: string }>(
        `SELECT name, setting
         FROM pg_settings
         WHERE name IN ('server_version_num', 'server_encoding')
         UNION ALL
         SELECT 'database_collation', datcollate
         FROM pg_database
         WHERE datname = current_database()
         ORDER BY name`
      )
      expect(Object.fromEntries(runtime.rows.map((row) => [row.name, row.setting]))).toEqual({
        database_collation: 'C',
        server_encoding: 'UTF8',
        server_version_num: expect.stringMatching(/^16\d{4}$/)
      })

      const relations = await client.query<{ kind: string; name: string }>(
        `SELECT relkind AS kind, relname AS name
         FROM pg_class c
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND relkind IN ('r', 'p', 'v', 'm', 'S')
         ORDER BY relkind, relname`
      )
      const names = (kind: string) =>
        relations.rows.filter((row) => row.kind === kind).map((row) => row.name)
      expect(names('r')).toEqual(fixture.expectedEstate.objects.ordinaryTables)
      expect(names('p')).toEqual(fixture.expectedEstate.objects.partitionedTables)
      expect(names('v')).toEqual(fixture.expectedEstate.objects.views)
      expect(names('m')).toEqual(fixture.expectedEstate.objects.materializedViews)
      expect(names('S')).toEqual(fixture.expectedEstate.objects.sequences)

      const functions = await client.query<{ name: string }>(
        `SELECT p.proname AS name
         FROM pg_proc p
         JOIN pg_namespace n ON n.oid = p.pronamespace
         WHERE n.nspname = 'public'
         ORDER BY p.proname, p.oid`
      )
      expect(functions.rows.map((row) => row.name)).toEqual(
        fixture.expectedEstate.objects.functions
      )
      const triggers = await client.query<{ name: string; table: string }>(
        `SELECT c.relname AS table, t.tgname AS name
         FROM pg_trigger t
         JOIN pg_class c ON c.oid = t.tgrelid
         JOIN pg_namespace n ON n.oid = c.relnamespace
         WHERE n.nspname = 'public' AND NOT t.tgisinternal
         ORDER BY c.relname, t.tgname`
      )
      expect(triggers.rows).toEqual(fixture.expectedEstate.objects.triggers)

      const customTypes = await client.query<{ kind: 'd' | 'e'; name: string }>(
        `SELECT t.typtype AS kind, t.typname AS name
         FROM pg_type t
         JOIN pg_namespace n ON n.oid = t.typnamespace
         WHERE n.nspname = 'public' AND t.typtype IN ('d', 'e')
         ORDER BY t.typtype, t.typname`
      )
      expect(
        customTypes.rows.map((type) => ({
          name: type.name,
          kind: type.kind === 'd' ? 'domain' : 'enum'
        }))
      ).toEqual(fixture.expectedEstate.objects.customTypes)

      const catalogCounts = await client.query<{
        checks: number
        foreign_keys: number
        indexes: number
        partitioned_indexes: number
        primary_keys: number
      }>(
        `SELECT
           (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'i') AS indexes,
           (SELECT count(*)::int FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'public' AND c.relkind = 'I') AS partitioned_indexes,
           (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'p') AS primary_keys,
           (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'f') AS foreign_keys,
           (SELECT count(*)::int FROM pg_constraint c JOIN pg_namespace n ON n.oid = c.connamespace WHERE n.nspname = 'public' AND c.contype = 'c') AS checks`
      )
      expect(catalogCounts.rows[0]).toEqual({
        checks: fixture.expectedEstate.objectCounts.checkConstraints,
        foreign_keys: fixture.expectedEstate.objectCounts.foreignKeyConstraints,
        indexes: fixture.expectedEstate.objectCounts.indexes,
        partitioned_indexes: fixture.expectedEstate.objectCounts.partitionedIndexes,
        primary_keys: fixture.expectedEstate.objectCounts.primaryKeyConstraints
      })

      const expectedRows = Object.keys(fixture.expectedEstate.rowCounts)
      expect(expectedRows.every((table) => /^[a-z0-9_]+$/.test(table))).toBe(true)
      const rowCounts = await client.query<{ count: number; table_name: string }>(
        expectedRows
          .map(
            (table) =>
              `SELECT '${table}' AS table_name, count(*)::int AS count FROM public.${table}`
          )
          .join(' UNION ALL ')
      )
      expect(Object.fromEntries(rowCounts.rows.map((row) => [row.table_name, row.count]))).toEqual(
        fixture.expectedEstate.rowCounts
      )
    } finally {
      await client.end()
    }
  })
})
