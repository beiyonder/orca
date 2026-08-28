import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { performance } from 'node:perf_hooks'
import { canonicalJson, sha256File, sha256Text } from './canonical-json.js'
import type {
  OmpContainmentExperimentInput,
  OmpContainmentMeasure,
  OmpContainmentReport
} from './omp-containment-contracts.js'
import { startOmpContainmentModelServer } from './omp-containment-model-server.js'
import { OmpContainmentRuntime } from './omp-containment-runtime.js'
import {
  OMP_RPC_MAX_PHYSICAL_FRAME_BYTES,
  OMP_RPC_MAX_REASSEMBLED_FRAME_BYTES
} from './omp-rpc-frame-decoder.js'
import { OmpRpcProcessError, type OmpRpcProcessClient } from './omp-rpc-process-client.js'
import { probePostCancellationToolGate } from './omp-containment-tool-gate-probe.js'

function responseSucceeded(frame: Awaited<ReturnType<OmpRpcProcessClient['command']>>): boolean {
  return frame.category === 'response' && frame.value.success
}

export async function runOmpContainmentExperiment(
  input: OmpContainmentExperimentInput
): Promise<OmpContainmentReport> {
  const executableDigest = await sha256File(input.executable)
  if (executableDigest !== input.requiredExecutableDigest) {
    throw new Error('Pinned OMP executable digest mismatch')
  }
  const modelServer = await startOmpContainmentModelServer()
  const runtime = new OmpContainmentRuntime({
    executable: input.executable,
    baseDirectory: input.baseDirectory,
    ...(input.parentEnv === undefined ? {} : { parentEnv: input.parentEnv }),
    contextManifest: input.contextManifest,
    contextAuthority: input.contextAuthority,
    contextSources: input.contextSources,
    modelBaseUrl: modelServer.baseUrl
  })
  const measures: OmpContainmentMeasure[] = []
  try {
    const ompVersion = await runtime.readVersion()
    measures.push({
      name: 'pinned-binary',
      passed: ompVersion === `omp/${input.requiredVersion}`,
      evidence: `${ompVersion}; sha256=${executableDigest}`
    })

    const baseline = await runtime.launch('exp10-baseline')
    const negotiation = await baseline.client.command({
      id: 'negotiate-v2',
      type: 'negotiate_protocol',
      protocolVersion: 2
    })
    measures.push({
      name: 'v2-negotiation',
      passed: responseSucceeded(negotiation) && baseline.client.protocolVersion === 2,
      evidence: `protocol=${baseline.client.protocolVersion}`
    })
    const subagents = await baseline.client.command({ id: 'get-subagents', type: 'get_subagents' })
    measures.push({
      name: 'subagent-containment',
      passed: responseSucceeded(subagents),
      evidence:
        'Real pinned binary returned a typed get_subagents response in an empty isolated root.'
    })
    const hostTools = await baseline.client.command({
      id: 'set-host-tools',
      type: 'set_host_tools',
      tools: [
        {
          name: 'evidence_read',
          description: 'Reads one manifest-admitted evidence span.',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: { evidenceId: { type: 'string' } },
            required: ['evidenceId']
          }
        },
        {
          name: 'artifact_write',
          description: 'Writes one candidate artifact in the isolated workspace.',
          parameters: {
            type: 'object',
            additionalProperties: false,
            properties: {
              path: { type: 'string' },
              content: { type: 'string' }
            },
            required: ['path', 'content']
          }
        }
      ]
    })
    measures.push({
      name: 'host-tool-schema',
      passed: responseSucceeded(hostTools),
      evidence: 'Real pinned binary accepted strict evidence and artifact host-tool definitions.'
    })
    const contextMessage = canonicalJson({
      contextDeliveryDigest: baseline.deliveryDigest,
      deliveryPayload: baseline.deliveryMessage
    })
    const prompt = await baseline.client.command(
      { id: 'context-prompt', type: 'prompt', message: contextMessage },
      15_000
    )
    const hostCall = await baseline.client.waitForFrame(
      (frame) => frame.category === 'host-tool-call',
      15_000
    )
    let artifactDigest = ''
    let artifactCallValid = false
    if (hostCall.category === 'host-tool-call') {
      const path = hostCall.value.arguments.path
      const content = hostCall.value.arguments.content
      artifactCallValid =
        hostCall.value.toolName === 'artifact_write' &&
        path === 'artifacts/identity-mapping.json' &&
        typeof content === 'string' &&
        Buffer.byteLength(content) <= 10_000
      if (artifactCallValid && typeof content === 'string') {
        const artifactDirectory = join(baseline.workspace, 'artifacts')
        const artifactPath = join(artifactDirectory, 'identity-mapping.json')
        await mkdir(artifactDirectory, { mode: 0o700 })
        await writeFile(artifactPath, content, { encoding: 'utf8', flag: 'wx', mode: 0o600 })
        artifactDigest = await sha256File(artifactPath)
      }
      await baseline.client.sendRaw(
        `${JSON.stringify({
          type: 'host_tool_result',
          id: hostCall.value.id,
          result: {
            content: [
              {
                type: 'text',
                text: artifactCallValid ? `artifact sha256=${artifactDigest}` : 'artifact denied'
              }
            ],
            details: { artifactDigest }
          },
          isError: !artifactCallValid
        })}\n`
      )
    }
    await baseline.client.waitForFrame(
      (frame) => frame.category === 'event' && frame.value.type === 'agent_end',
      15_000
    )
    const modelReceivedContext = modelServer.requestBodies.some((body) =>
      body.includes(baseline.deliveryDigest)
    )
    measures.push({
      name: 'context-host-tool-artifact',
      passed:
        responseSucceeded(prompt) &&
        modelReceivedContext &&
        artifactCallValid &&
        artifactDigest.length === 64,
      evidence: `context=${baseline.deliveryDigest}; artifact=${artifactDigest}`
    })
    const cancelPrompt = await baseline.client.command(
      { id: 'cancel-prompt', type: 'prompt', message: 'CANCEL_PROBE' },
      15_000
    )
    await modelServer.waitForRequest('CANCEL_PROBE', 15_000)
    const abort = await baseline.client.command({ id: 'abort-context', type: 'abort' })
    await modelServer.waitForCancellation(15_000)
    measures.push({
      name: 'context-and-cancellation',
      passed:
        responseSucceeded(cancelPrompt) &&
        responseSucceeded(abort) &&
        modelServer.cancelledRequests() > 0,
      evidence: `context=${baseline.deliveryDigest}; cancelledRequests=${modelServer.cancelledRequests()}`
    })
    const postCancellation = await probePostCancellationToolGate(input.startedAt)
    measures.push({
      name: 'post-cancel-tool-effect',
      passed: responseSucceeded(abort) && postCancellation.passed,
      evidence: `starts=${postCancellation.starts}; uses=${postCancellation.uses}; denied=${postCancellation.resultIsError}`
    })

    let floodRejected = false
    try {
      await baseline.client.sendRaw(Buffer.alloc(OMP_RPC_MAX_PHYSICAL_FRAME_BYTES + 2, 'x'))
    } catch (error) {
      floodRejected =
        error instanceof OmpRpcProcessError && error.code === 'outgoing_frame_too_large'
    }
    const aliveAfterFlood = await baseline.client.command({
      id: 'after-flood',
      type: 'get_subagents'
    })
    measures.push({
      name: 'flood-and-context-overflow',
      passed: floodRejected && responseSucceeded(aliveAfterFlood),
      evidence: 'Gateway rejected >1 MiB before write; real OMP remained responsive.'
    })

    const malformed = await runtime.launch('exp10-malformed')
    const malformedStart = performance.now()
    await malformed.client.sendRaw('{"type":\n')
    let malformedExplicit = false
    try {
      await malformed.client.waitForFrame((candidate) => candidate.category === 'error', 10_000)
      malformedExplicit = true
    } catch (error) {
      malformedExplicit =
        error instanceof OmpRpcProcessError &&
        (error.code === 'process_exited' || error.code === 'invalid_omp_output')
    }
    measures.push({
      name: 'malformed-frame',
      passed: malformedExplicit && performance.now() - malformedStart < 30_000,
      evidence: `Malformed JSON disposition frames=${malformed.client.frames
        .map((frame) => `${frame.category}:${frame.value.type}`)
        .join(',')}.`
    })

    const crash = await runtime.launch('exp10-crash')
    const crashStart = performance.now()
    await crash.client.close()
    await crash.client.waitForExit()
    const replacement = await runtime.launch('exp10-replacement')
    const replacementNegotiation = await replacement.client.command({
      id: 'replacement-v2',
      type: 'negotiate_protocol',
      protocolVersion: 2
    })
    measures.push({
      name: 'crash-replacement',
      passed:
        performance.now() - crashStart < 30_000 &&
        responseSucceeded(replacementNegotiation) &&
        replacement.deliveryDigest === crash.deliveryDigest,
      evidence: `replacement context=${replacement.deliveryDigest}`
    })

    const allFrames = runtime.frames
    const maximumObservedFrame = Math.max(
      0,
      ...allFrames.map((frame) => Buffer.byteLength(canonicalJson(frame.value)))
    )
    measures.push({
      name: 'bounded-observation',
      passed: maximumObservedFrame <= OMP_RPC_MAX_PHYSICAL_FRAME_BYTES,
      evidence: `max observed frame=${maximumObservedFrame} bytes`
    })

    const completedAt = new Date().toISOString()
    const status: OmpContainmentReport['status'] = measures.every((measure) => measure.passed)
      ? 'passed'
      : 'failed'
    const reportBody = {
      schemaVersion: 1 as const,
      experimentId: 'EXP-10' as const,
      runId: `exp-10-${sha256Text(canonicalJson({ executableDigest, startedAt: input.startedAt })).slice(0, 20)}`,
      status,
      ompVersion,
      executableDigest,
      protocolVersion: 2 as const,
      maxPhysicalFrameBytes: OMP_RPC_MAX_PHYSICAL_FRAME_BYTES,
      maxReassembledFrameBytes: OMP_RPC_MAX_REASSEMBLED_FRAME_BYTES,
      contextDeliveryDigest: baseline.deliveryDigest,
      measures,
      protocolFrameCategories: [...new Set(allFrames.map((frame) => frame.category))].toSorted(),
      startedAt: input.startedAt,
      completedAt
    }
    return { ...reportBody, reportDigest: sha256Text(canonicalJson(reportBody)) }
  } finally {
    await runtime.dispose()
    await modelServer.close()
  }
}
