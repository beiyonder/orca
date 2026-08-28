import { Buffer } from 'node:buffer'

export type BoundedOutputSnapshot = {
  text: string
  bytes: number
  truncated: boolean
}

export class BoundedAgentProcessOutput {
  readonly #maxBytes: number
  readonly #chunks: Buffer[] = []
  #capturedBytes = 0
  #observedBytes = 0

  constructor(maxBytes: number) {
    if (!Number.isSafeInteger(maxBytes) || maxBytes < 0) {
      throw new TypeError('maxBytes must be a nonnegative safe integer')
    }
    this.#maxBytes = maxBytes
  }

  write(raw: Buffer | string): void {
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
    this.#observedBytes += chunk.length
    const remaining = this.#maxBytes - this.#capturedBytes
    if (remaining <= 0) {
      return
    }
    const captured = chunk.length > remaining ? chunk.subarray(0, remaining) : chunk
    this.#chunks.push(captured)
    this.#capturedBytes += captured.length
  }

  snapshot(): BoundedOutputSnapshot {
    return {
      text: Buffer.concat(this.#chunks, this.#capturedBytes).toString('utf8'),
      bytes: this.#observedBytes,
      truncated: this.#observedBytes > this.#capturedBytes
    }
  }
}
