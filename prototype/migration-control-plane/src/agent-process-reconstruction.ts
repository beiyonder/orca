import { z } from 'zod'
import { canonicalJson, sha256File, sha256Text } from './canonical-json.js'
import { AgentProcessSupervisor } from './agent-process-supervisor.js'
import type { AgentProcessSpec } from './agent-process-contracts.js'
import {
  deliverContextManifest,
  type ContextManifestDeliveryAuthority,
  type ContextManifestSource,
  type DeliveredContextManifest
} from './omp-context-manifest-delivery.js'
import {
  prepareIsolatedOmpEnvironment,
  type PreparedOmpEnvironment
} from './omp-isolated-environment.js'

const Sha256Schema = z.string().regex(/^[a-f0-9]{64}$/)
const PersistedWorkerAuthoritySchema = z.strictObject({
  tenantId: z.string().min(1).max(128),
  missionId: z.string().min(1).max(128),
  assignmentId: z.string().min(1).max(128),
  attemptId: z.string().min(1).max(128),
  fence: z.number().int().positive().max(Number.MAX_SAFE_INTEGER),
  attemptStatus: z.literal('running'),
  contextManifestId: z.string().min(1).max(128),
  expectedContextDeliveryDigest: Sha256Schema.nullable(),
  ledgerPosition: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER),
  ledgerDigest: Sha256Schema,
  executableVersion: z.string().min(1).max(128),
  executableDigest: Sha256Schema,
  program: z.string().min(1).max(4_096),
  argumentTemplate: z.array(z.string().max(32_768)).max(128)
})
export type PersistedWorkerAuthority = z.infer<typeof PersistedWorkerAuthoritySchema>

export type ReconstructAgentProcessInput = {
  baseDirectory: string
  incarnationId: string
  priorIncarnationId: string | null
  parentEnv?: NodeJS.ProcessEnv
  authority: unknown
  contextManifest: unknown
  contextAuthority: ContextManifestDeliveryAuthority
  contextSources: readonly ContextManifestSource[]
  commandId: string
  reconstructedAt: string
  processLimits?: Pick<
    AgentProcessSpec,
    | 'startupTimeoutMs'
    | 'runtimeTimeoutMs'
    | 'cancellationGraceMs'
    | 'forceKillTimeoutMs'
    | 'maxOutputBytes'
  >
}

export type AgentProcessReconstructionRecord = {
  schemaVersion: 1
  type: 'agent_process_reconstruction'
  tenantId: string
  missionId: string
  assignmentId: string
  attemptId: string
  fence: number
  contextManifestId: string
  contextDeliveryDigest: string
  ledgerPosition: number
  ledgerDigest: string
  executableVersion: string
  executableDigest: string
  priorIncarnationId: string | null
  incarnationId: string
  environmentDigest: string
  logicalInvocationDigest: string
  reconstructedAt: string
  digest: string
}

export type ReconstructedAgentProcess = {
  environment: PreparedOmpEnvironment
  delivery: DeliveredContextManifest
  supervisor: AgentProcessSupervisor
  record: AgentProcessReconstructionRecord
  dispose: () => Promise<void>
}

export class AgentProcessReconstructionError extends Error {
  readonly code: string
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'AgentProcessReconstructionError'
    this.code = code
  }
}

function failure(code: string, message: string, cause?: unknown): AgentProcessReconstructionError {
  return new AgentProcessReconstructionError(
    code,
    message,
    cause === undefined ? undefined : { cause }
  )
}

function renderArguments(
  template: readonly string[],
  delivery: DeliveredContextManifest
): readonly string[] {
  return template.map((argument) =>
    argument
      .replaceAll('{CONTEXT_DELIVERY_PATH}', delivery.deliveryPath)
      .replaceAll('{CONTEXT_DELIVERY_DIGEST}', delivery.deliveryDigest)
  )
}

function logicalInvocationDigest(authority: PersistedWorkerAuthority): string {
  return sha256Text(
    canonicalJson({
      tenantId: authority.tenantId,
      missionId: authority.missionId,
      assignmentId: authority.assignmentId,
      attemptId: authority.attemptId,
      fence: authority.fence,
      contextManifestId: authority.contextManifestId,
      contextDeliveryDigest: authority.expectedContextDeliveryDigest,
      ledgerPosition: authority.ledgerPosition,
      ledgerDigest: authority.ledgerDigest,
      executableVersion: authority.executableVersion,
      executableDigest: authority.executableDigest,
      argumentTemplate: authority.argumentTemplate
    })
  )
}

export async function reconstructAgentProcess(
  input: ReconstructAgentProcessInput
): Promise<ReconstructedAgentProcess> {
  let authority: PersistedWorkerAuthority
  try {
    authority = PersistedWorkerAuthoritySchema.parse(input.authority)
  } catch (error) {
    throw failure('invalid_persisted_authority', 'Persisted worker authority is invalid', error)
  }
  if (
    input.contextAuthority.tenantId !== authority.tenantId ||
    input.contextAuthority.missionId !== authority.missionId ||
    input.contextAuthority.assignmentId !== authority.assignmentId ||
    input.contextAuthority.attemptId !== authority.attemptId
  ) {
    throw failure(
      'context_authority_mismatch',
      'Context authority differs from persisted worker authority'
    )
  }
  if ((await sha256File(authority.program)) !== authority.executableDigest) {
    throw failure(
      'executable_digest_mismatch',
      'Worker executable differs from persisted authority'
    )
  }
  const environment = await prepareIsolatedOmpEnvironment({
    baseDirectory: input.baseDirectory,
    incarnationId: input.incarnationId,
    ...(input.parentEnv === undefined ? {} : { parentEnv: input.parentEnv })
  })
  let supervisor: AgentProcessSupervisor | null = null
  try {
    const delivery = await deliverContextManifest({
      workspaceDirectory: environment.directories.workspace,
      commandId: input.commandId,
      manifest: input.contextManifest,
      authority: input.contextAuthority,
      sources: input.contextSources
    })
    if (
      authority.contextManifestId !== delivery.manifest.id ||
      (authority.expectedContextDeliveryDigest !== null &&
        authority.expectedContextDeliveryDigest !== delivery.deliveryDigest)
    ) {
      throw failure(
        'context_reconstruction_mismatch',
        'Reconstructed context differs from persisted authority'
      )
    }
    supervisor = new AgentProcessSupervisor({
      incarnationId: input.incarnationId,
      program: authority.program,
      args: renderArguments(authority.argumentTemplate, delivery),
      cwd: environment.directories.workspace,
      env: environment.env,
      ...input.processLimits
    })
    const recordBody = {
      schemaVersion: 1 as const,
      type: 'agent_process_reconstruction' as const,
      tenantId: authority.tenantId,
      missionId: authority.missionId,
      assignmentId: authority.assignmentId,
      attemptId: authority.attemptId,
      fence: authority.fence,
      contextManifestId: authority.contextManifestId,
      contextDeliveryDigest: delivery.deliveryDigest,
      ledgerPosition: authority.ledgerPosition,
      ledgerDigest: authority.ledgerDigest,
      executableVersion: authority.executableVersion,
      executableDigest: authority.executableDigest,
      priorIncarnationId: input.priorIncarnationId,
      incarnationId: input.incarnationId,
      environmentDigest: environment.manifest.digest,
      logicalInvocationDigest: logicalInvocationDigest({
        ...authority,
        expectedContextDeliveryDigest: delivery.deliveryDigest
      }),
      reconstructedAt: input.reconstructedAt
    }
    const record = { ...recordBody, digest: sha256Text(canonicalJson(recordBody)) }
    return {
      environment,
      delivery,
      supervisor,
      record,
      dispose: async () => {
        await supervisor?.dispose()
        await environment.dispose()
      }
    }
  } catch (error) {
    await supervisor?.dispose()
    await environment.dispose()
    if (error instanceof AgentProcessReconstructionError) {
      throw error
    }
    throw failure('reconstruction_failed', 'Agent process reconstruction failed', error)
  }
}
