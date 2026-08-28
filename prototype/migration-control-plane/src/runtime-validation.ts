import { readFile } from 'node:fs/promises'

export function isUnknownRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!isUnknownRecord(value)) throw new TypeError(`${label} must be an object`)
  return value
}

export function requireString(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string`)
  }
  return value
}

export function requireInteger(value: unknown, label: string): number {
  if (!Number.isSafeInteger(value) || (value as number) < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer`)
  }
  return value as number
}

export function requireStringArray(value: unknown, label: string): string[] {
  if (!Array.isArray(value)) throw new TypeError(`${label} must be an array`)
  const result = value.map((item, index) => requireString(item, `${label}[${index}]`))
  if (new Set(result).size !== result.length)
    throw new TypeError(`${label} must not contain duplicates`)
  return result
}

export function parseScalarRecord(value: unknown, label: string): Record<string, boolean | string> {
  const record = requireRecord(value, label)
  const result: Record<string, boolean | string> = {}
  for (const [key, entry] of Object.entries(record)) {
    if (typeof entry !== 'boolean' && typeof entry !== 'string') {
      throw new TypeError(`${label}.${key} must be boolean or string`)
    }
    result[key] = entry
  }
  return result
}

export async function readJson(path: string): Promise<unknown> {
  return JSON.parse(await readFile(path, 'utf8')) as unknown
}
