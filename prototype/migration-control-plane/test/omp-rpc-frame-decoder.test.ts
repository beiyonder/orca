import { describe, expect, it } from 'vitest'
import { OmpRpcChunkSchema } from '../src/omp-rpc-frame-contracts.js'
import {
  OMP_RPC_MAX_PHYSICAL_FRAME_BYTES,
  OmpRpcFrameStreamDecoder,
  OmpRpcProtocolError
} from '../src/omp-rpc-frame-decoder.js'

const ready = {
  type: 'ready',
  protocolVersion: 1,
  supportedProtocolVersions: [1, 2],
  maxFrameBytes: 1024 * 1024,
  maxReassembledFrameBytes: 64 * 1024 * 1024
}

function line(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

function negotiateV2(decoder: OmpRpcFrameStreamDecoder): void {
  decoder.push(line(ready))
  decoder.push(
    line({
      id: 'negotiate-1',
      type: 'response',
      command: 'negotiate_protocol',
      success: true,
      data: { protocolVersion: 2 }
    })
  )
}

function chunkLines(value: unknown, chunkId = 'chunk-1'): string[] {
  const bytes = Buffer.from(JSON.stringify(value))
  const payloadBytes = 256 * 1024
  const count = Math.ceil(bytes.length / payloadBytes)
  return Array.from({ length: count }, (_, index) =>
    line({
      type: 'rpc_chunk',
      chunkId,
      index,
      count,
      byteLength: bytes.length,
      data: bytes.subarray(index * payloadBytes, (index + 1) * payloadBytes).toString('base64')
    })
  )
}

function expectProtocolError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected RPC protocol error')
  } catch (error) {
    if (!(error instanceof OmpRpcProtocolError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

describe('OMP RPC frame stream decoder', () => {
  it('accepts fragmented ready, negotiation, response, and event frames', () => {
    const decoder = new OmpRpcFrameStreamDecoder()
    const encodedReady = line(ready)
    expect(decoder.push(encodedReady.slice(0, 7))).toEqual([])
    expect(decoder.push(encodedReady.slice(7))).toMatchObject([
      { category: 'ready', value: { type: 'ready' } }
    ])
    expect(decoder.push(line({ type: 'agent_start' }))).toMatchObject([
      { category: 'event', value: { type: 'agent_start' } }
    ])
    expect(
      decoder.push(
        line({ id: 'state-1', type: 'response', command: 'get_state', success: true, data: {} })
      )
    ).toMatchObject([{ category: 'response', value: { command: 'get_state' } }])
    expect(decoder.protocolVersion).toBe(1)
    decoder.finish()
  })

  it('negotiates protocol v2 and reassembles a bounded logical event', () => {
    const decoder = new OmpRpcFrameStreamDecoder()
    negotiateV2(decoder)
    expect(decoder.protocolVersion).toBe(2)
    const event = { type: 'notice', level: 'info', message: 'x'.repeat(1_100_000) }
    const chunks = chunkLines(event)
    expect(chunks.length).toBeGreaterThan(1)
    for (const physical of chunks.slice(0, -1)) {
      expect(decoder.push(physical)).toEqual([])
    }
    expect(decoder.push(chunks.at(-1)!)).toMatchObject([
      { category: 'event', value: { type: 'notice', level: 'info' } }
    ])
    decoder.finish()
  })

  it('classifies host-tool call, cancellation, and error frames', () => {
    const decoder = new OmpRpcFrameStreamDecoder()
    decoder.push(line(ready))
    expect(
      decoder.push(
        line({
          type: 'host_tool_call',
          id: 'host-1',
          toolCallId: 'tool-call-1',
          toolName: 'evidence_read',
          arguments: { evidenceId: 'evidence_s1' }
        })
      )
    ).toMatchObject([{ category: 'host-tool-call', value: { toolName: 'evidence_read' } }])
    expect(
      decoder.push(line({ type: 'host_tool_cancel', id: 'cancel-1', targetId: 'host-1' }))
    ).toMatchObject([{ category: 'host-tool-cancel', value: { targetId: 'host-1' } }])
    expect(
      decoder.push(
        line({ type: 'response', command: 'prompt', success: false, error: 'cancelled' })
      )
    ).toMatchObject([{ category: 'error', value: { command: 'prompt' } }])
    expect(
      decoder.push(line({ type: 'rpc_frame_error', error: 'transport overflow' }))
    ).toMatchObject([{ category: 'error', value: { type: 'rpc_frame_error' } }])
  })

  it('fails closed on pre-ready, duplicate-ready, unknown, invalid JSON, and invalid UTF-8', () => {
    const preReady = new OmpRpcFrameStreamDecoder()
    expectProtocolError(() => preReady.push(line({ type: 'agent_start' })), 'ready_required')
    expectProtocolError(() => preReady.push(line(ready)), 'decoder_failed')

    const duplicate = new OmpRpcFrameStreamDecoder()
    duplicate.push(line(ready))
    expectProtocolError(() => duplicate.push(line(ready)), 'duplicate_ready')

    const unknown = new OmpRpcFrameStreamDecoder()
    unknown.push(line(ready))
    expectProtocolError(() => unknown.push(line({ type: 'not_an_omp_frame' })), 'invalid_frame')

    const invalidJson = new OmpRpcFrameStreamDecoder()
    expectProtocolError(() => invalidJson.push('{bad json}\n'), 'invalid_json')

    const invalidUtf8 = new OmpRpcFrameStreamDecoder()
    expectProtocolError(
      () => invalidUtf8.push(Buffer.from([0x7b, 0x22, 0x78, 0x22, 0x3a, 0xff, 0x7d, 0x0a])),
      'invalid_utf8'
    )
  })

  it('rejects physical overflow and unterminated input', () => {
    const overflow = new OmpRpcFrameStreamDecoder()
    expectProtocolError(
      () => overflow.push(Buffer.alloc(OMP_RPC_MAX_PHYSICAL_FRAME_BYTES, 0x78)),
      'physical_frame_too_large'
    )
    const trailing = new OmpRpcFrameStreamDecoder()
    trailing.push(line(ready))
    trailing.push('{"type":"agent_start"}')
    expectProtocolError(() => trailing.finish(), 'trailing_frame')
  })

  it('rejects chunks before negotiation, out of order, interrupted, or incomplete', () => {
    const event = { type: 'notice', level: 'info', message: 'x'.repeat(1_100_000) }
    const chunks = chunkLines(event)

    const protocolOne = new OmpRpcFrameStreamDecoder()
    protocolOne.push(line(ready))
    expectProtocolError(() => protocolOne.push(chunks[0]!), 'chunk_protocol')

    const outOfOrder = new OmpRpcFrameStreamDecoder()
    negotiateV2(outOfOrder)
    expectProtocolError(() => outOfOrder.push(chunks[1]!), 'chunk_start')

    const interrupted = new OmpRpcFrameStreamDecoder()
    negotiateV2(interrupted)
    interrupted.push(chunks[0]!)
    expectProtocolError(() => interrupted.push(line({ type: 'agent_start' })), 'chunk_interrupted')

    const incomplete = new OmpRpcFrameStreamDecoder()
    negotiateV2(incomplete)
    incomplete.push(chunks[0]!)
    expectProtocolError(() => incomplete.finish(), 'incomplete_chunks')
  })

  it('rejects noncanonical base64 and changed chunk metadata', () => {
    const event = { type: 'notice', message: 'x'.repeat(1_100_000) }
    const chunks = chunkLines(event)
    const decoder = new OmpRpcFrameStreamDecoder()
    negotiateV2(decoder)
    const first = { ...OmpRpcChunkSchema.parse(JSON.parse(chunks[0]!)), data: '%%%%' }
    expectProtocolError(() => decoder.push(line(first)), 'invalid_chunk_data')

    const mismatch = new OmpRpcFrameStreamDecoder()
    negotiateV2(mismatch)
    mismatch.push(chunks[0]!)
    const second = {
      ...OmpRpcChunkSchema.parse(JSON.parse(chunks[1]!)),
      chunkId: 'different'
    }
    expectProtocolError(() => mismatch.push(line(second)), 'chunk_mismatch')
  })
})
