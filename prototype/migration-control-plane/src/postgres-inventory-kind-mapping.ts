import type { SourceSchemaInventoryV1 } from './domain/source-inventory-contracts.js'

type RelationKind = SourceSchemaInventoryV1['relations'][number]['kind']
type ConstraintKind = SourceSchemaInventoryV1['constraints'][number]['kind']
type RoutineKind = SourceSchemaInventoryV1['routines'][number]['kind']
type CustomTypeKind = SourceSchemaInventoryV1['customTypes'][number]['kind']

const RELATIONS: Record<string, RelationKind> = {
  r: 'table',
  p: 'partitioned-table',
  v: 'view',
  m: 'materialized-view',
  f: 'foreign-table'
}
const CONSTRAINTS: Record<string, ConstraintKind> = {
  p: 'primary-key',
  f: 'foreign-key',
  u: 'unique',
  c: 'check',
  x: 'exclusion'
}
const ROUTINES: Record<string, RoutineKind> = {
  f: 'function',
  p: 'procedure',
  a: 'aggregate',
  w: 'window'
}
const CUSTOM_TYPES: Record<string, CustomTypeKind> = {
  d: 'domain',
  e: 'enum',
  c: 'composite',
  r: 'range'
}

function required<T>(mapping: Record<string, T>, value: unknown, label: string): T {
  const mapped = mapping[String(value)]
  if (!mapped) {
    throw new TypeError(`Unknown PostgreSQL ${label} kind: ${String(value)}`)
  }
  return mapped
}

export const postgresRelationKind = (value: unknown): RelationKind =>
  required(RELATIONS, value, 'relation')
export const postgresConstraintKind = (value: unknown): ConstraintKind =>
  required(CONSTRAINTS, value, 'constraint')
export const postgresRoutineKind = (value: unknown): RoutineKind =>
  required(ROUTINES, value, 'routine')
export const postgresCustomTypeKind = (value: unknown): CustomTypeKind =>
  required(CUSTOM_TYPES, value, 'custom type')
