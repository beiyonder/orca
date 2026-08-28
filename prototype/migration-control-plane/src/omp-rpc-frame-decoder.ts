import { Buffer } from 'node:buffer'
import { z } from 'zod'
import {
  OmpRpcChunkSchema,
  classifyOmpRpcFrame,
  type OmpRpcChunk,
  type OmpRpcFrame
} from './omp-rpc-frame-contracts.js'

export const OMP_RPC_MAX_PHYSICAL_FRAME_BYTES = 1024 * 1024
export const OMP_RPC_MAX_REASSEMBLED_FRAME_BYTES = 64 * 1024 * 1024
const OMP_RPC_CHUNK_PAYLOAD_BYTES = 256 * 1024

const NegotiatedProtocolSchema = z.strictObject({ protocolVersion: z.literal(2) })

type PendingChunks = {
  chunkId: string
  count: number
  byteLength: number
  nextIndex: number
  chunks: Buffer[]
  receivedBytes: number
}

export class OmpRpcProtocolError extends Error {
  readonly code: string

  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'OmpRpcProtocolError'
    this.code = code
  }
}

function protocolError(code: string, message: string, cause?: unknown): OmpRpcProtocolError {
  return new OmpRpcProtocolError(code, message, cause === undefined ? undefined : { cause })
}

function decodeBase64(data: string): Buffer {
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    throw protocolError('invalid_chunk_data', 'RPC chunk data is not canonical base64')
  }
  const decoded = Buffer.from(data, 'base64')
  if (decoded.length === 0 || decoded.toString('base64') !== data) {
    throw protocolError('invalid_chunk_data', 'RPC chunk data is not canonical base64')
  }
  return decoded
}

function parseJsonObject(bytes: Buffer): unknown {
  let text: string
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
  } catch (error) {
    throw protocolError('invalid_utf8', 'RPC frame is not valid UTF-8', error)
  }
  try {
    return JSON.parse(text) as unknown
  } catch (error) {
    throw protocolError('invalid_json', 'RPC frame is not valid JSON', error)
  }
}

export class OmpRpcFrameStreamDecoder {
  #buffer = Buffer.alloc(0)
  #pending: PendingChunks | null = null
  #ready = false
  #protocolVersion: 1 | 2 = 1
  #failed = false

  get protocolVersion(): 1 | 2 {
    return this.#protocolVersion
  }

  get ready(): boolean {
    return this.#ready
  }

  push(raw: Buffer | string): OmpRpcFrame[] {
    if (this.#failed) {
      throw protocolError('decoder_failed', 'RPC decoder is failed closed')
    }
    const chunk = Buffer.isBuffer(raw) ? raw : Buffer.from(raw)
    if (chunk.length > OMP_RPC_MAX_REASSEMBLED_FRAME_BYTES) {
      return this.#fail('input_chunk_too_large', 'RPC input chunk exceeds the logical frame limit')
    }
    try {
      const frames: OmpRpcFrame[] = []
      this.#buffer = Buffer.concat([this.#buffer, chunk])
      let newline = this.#buffer.indexOf(0x0a)
      while (newline >= 0) {
        const physicalBytes = newline + 1
        if (physicalBytes > OMP_RPC_MAX_PHYSICAL_FRAME_BYTES) {
          throw protocolError('physical_frame_too_large', 'RPC physical frame exceeds 1 MiB')
        }
        const line = this.#buffer.subarray(0, newline)
        this.#buffer = this.#buffer.subarray(physicalBytes)
        if (line.length === 0) {
          throw protocolError('empty_frame', 'RPC stream contains an empty frame')
        }
        const frame = this.#processPhysicalFrame(parseJsonObject(line))
        if (frame) {
          frames.push(frame)
        }
        newline = this.#buffer.indexOf(0x0a)
      }
      if (this.#buffer.length >= OMP_RPC_MAX_PHYSICAL_FRAME_BYTES) {
        throw protocolError('physical_frame_too_large', 'Unterminated RPC frame exceeds 1 MiB')
      }
      return frames
    } catch (error) {
      this.#failed = true
      this.#buffer = Buffer.alloc(0)
      this.#pending = null
      throw error instanceof OmpRpcProtocolError
        ? error
        : protocolError('invalid_frame', 'RPC frame failed schema validation', error)
    }
  }

  finish(): void {
    if (this.#failed) {
      throw protocolError('decoder_failed', 'RPC decoder is failed closed')
    }
    if (this.#buffer.length > 0) {
      this.#failed = true
      throw protocolError('trailing_frame', 'RPC stream ended with an unterminated frame')
    }
    if (this.#pending) {
      this.#failed = true
      this.#pending = null
      throw protocolError('incomplete_chunks', 'RPC stream ended during chunk reassembly')
    }
  }

  #fail(code: string, message: string): never {
    this.#failed = true
    this.#buffer = Buffer.alloc(0)
    this.#pending = null
    throw protocolError(code, message)
  }

  #processPhysicalFrame(input: unknown): OmpRpcFrame | null {
    const chunk = OmpRpcChunkSchema.safeParse(input)
    if (chunk.success) {
      return this.#processChunk(chunk.data)
    }
    if (this.#pending) {
      throw protocolError('chunk_interrupted', 'RPC chunk sequence was interrupted')
    }
    const frame = classifyOmpRpcFrame(input)
    if (!this.#ready) {
      if (frame.category !== 'ready') {
        throw protocolError('ready_required', 'RPC ready frame must be first')
      }
      this.#ready = true
      return frame
    }
    if (frame.category === 'ready') {
      throw protocolError('duplicate_ready', 'RPC ready frame may appear only once')
    }
    if (
      frame.category === 'response' &&
      frame.value.command === 'negotiate_protocol' &&
      frame.value.success
    ) {
      NegotiatedProtocolSchema.parse(frame.value.data)
      this.#protocolVersion = 2
    }
    return frame
  }

  #processChunk(chunk: OmpRpcChunk): OmpRpcFrame | null {
    if (!this.#ready || this.#protocolVersion !== 2) {
      throw protocolError('chunk_protocol', 'RPC chunks require negotiated protocol v2')
    }
    if (
      chunk.byteLength < OMP_RPC_MAX_PHYSICAL_FRAME_BYTES ||
      chunk.count !== Math.ceil(chunk.byteLength / OMP_RPC_CHUNK_PAYLOAD_BYTES) ||
      chunk.index >= chunk.count
    ) {
      throw protocolError('invalid_chunk_metadata', 'RPC chunk metadata is inconsistent')
    }
    const bytes = decodeBase64(chunk.data)
    if (bytes.length > OMP_RPC_CHUNK_PAYLOAD_BYTES) {
      throw protocolError('chunk_payload_too_large', 'RPC chunk payload exceeds 256 KiB')
    }
    if (!this.#pending) {
      if (chunk.index !== 0) {
        throw protocolError('chunk_start', 'RPC chunk sequence must start at index 0')
      }
      this.#pending = {
        chunkId: chunk.chunkId,
        count: chunk.count,
        byteLength: chunk.byteLength,
        nextIndex: 0,
        chunks: [],
        receivedBytes: 0
      }
    }
    const pending = this.#pending
    if (
      pending.chunkId !== chunk.chunkId ||
      pending.count !== chunk.count ||
      pending.byteLength !== chunk.byteLength ||
      pending.nextIndex !== chunk.index
    ) {
      throw protocolError('chunk_mismatch', 'RPC chunk sequence metadata or order changed')
    }
    pending.chunks.push(bytes)
    pending.receivedBytes += bytes.length
    pending.nextIndex += 1
    if (pending.receivedBytes > pending.byteLength) {
      throw protocolError('chunk_length', 'RPC chunks exceed their declared byte length')
    }
    if (pending.nextIndex < pending.count) {
      return null
    }
    if (pending.receivedBytes !== pending.byteLength) {
      throw protocolError('chunk_length', 'RPC chunks do not match their declared byte length')
    }
    this.#pending = null
    return this.#processPhysicalFrame(parseJsonObject(Buffer.concat(pending.chunks)))
  }
}
