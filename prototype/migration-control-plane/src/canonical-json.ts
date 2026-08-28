import { createHash } from 'node:crypto'
import { readFile } from 'node:fs/promises'

export type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue }

export function canonicalizeJson(value: unknown, seen = new WeakSet<object>()): JsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('JSON numbers must be finite')
    return value
  }
  if (typeof value !== 'object') {
    throw new TypeError(`Unsupported JSON value: ${typeof value}`)
  }
  if (seen.has(value)) throw new TypeError('Circular JSON value')
  seen.add(value)
  try {
    if (Array.isArray(value)) return value.map((item) => canonicalizeJson(item, seen))
    const source = value as Record<string, unknown>
    const result: Record<string, JsonValue> = {}
    for (const key of Object.keys(source).sort()) {
      result[key] = canonicalizeJson(source[key], seen)
    }
    return result
  } finally {
    seen.delete(value)
  }
}

export function canonicalJson(value: unknown): string {
  return `${JSON.stringify(canonicalizeJson(value), null, 2)}
`
}

export function sha256Text(value: string | Uint8Array): string {
  return createHash('sha256').update(value).digest('hex')
}

export async function sha256File(path: string): Promise<string> {
  return sha256Text(await readFile(path))
}
