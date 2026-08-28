import { z } from 'zod'
import { canonicalJson, sha256Text } from './canonical-json.js'
import { OmpHostToolAuthority } from './omp-host-tool-authority.js'
import { OmpHostToolBridge } from './omp-host-tool-bridge.js'

export type OmpContainmentToolGateProbe = {
  passed: boolean
  starts: number
  uses: number
  cancellationAcknowledged: boolean
  resultIsError: boolean
}

export async function probePostCancellationToolGate(
  acknowledgedAt: string
): Promise<OmpContainmentToolGateProbe> {
  const parameters = {
    type: 'object',
    additionalProperties: false,
    properties: { evidenceId: { type: 'string' } },
    required: ['evidenceId']
  }
  const argumentsValue = { evidenceId: 'evidence_profile' }
  const parameterDigest = sha256Text(canonicalJson(argumentsValue))
  const reference = {
    name: 'evidence_read',
    version: '1',
    schemaDigest: sha256Text(canonicalJson(parameters)),
    approval: 'read' as const
  }
  const target = {
    provider: 'fixture',
    account: 'synthetic',
    project: null,
    region: null,
    resourceType: 'evidence-item',
    resourceId: 'evidence_profile'
  }
  const expiresAt = '2099-01-01T00:00:00.000Z'
  const budget = {
    tokenLimit: 1_000,
    timeLimitMs: 10_000,
    toolCallLimit: 1,
    outputByteLimit: 10_000,
    costLimitUsd: 1
  }
  const policyDecision = {
    schemaVersion: 1,
    kind: 'policy-decision',
    id: 'policy_containment',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    createdAt: acknowledgedAt,
    effectId: 'effect_containment',
    intentDigest: '1'.repeat(64),
    policyBundleVersion: '1',
    policyBundleDigest: '2'.repeat(64),
    structuredInputDigest: '3'.repeat(64),
    decision: 'allow',
    grant: {
      target,
      adapterName: 'fixture-evidence',
      adapterMethod: 'read',
      parameterDigest,
      toolNames: ['evidence_read'],
      networkDestinations: [],
      secretScopes: [],
      maxUses: 1,
      expiresAt
    },
    obligations: [],
    ruleIds: ['containment.read'],
    reasons: ['Containment probe only.'],
    decidedBy: { kind: 'system', id: 'policy-engine', version: '1' },
    expiresAt
  }
  const capabilityEnvelope = {
    schemaVersion: 1,
    kind: 'capability-envelope',
    id: 'envelope_containment',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    createdAt: acknowledgedAt,
    effectId: 'effect_containment',
    intentDigest: '1'.repeat(64),
    policyDecisionId: 'policy_containment',
    workload: {
      assignmentId: 'assignment_reconstruction',
      attemptId: 'attempt_reconstruction',
      fence: 5,
      audience: 'omp:specialist'
    },
    target,
    adapterName: 'fixture-evidence',
    adapterMethod: 'read',
    parameterDigest,
    allowedTools: [reference],
    allowedNetworkDestinations: [],
    dataClasses: ['synthetic'],
    secretLeaseIds: [],
    budget,
    maxUses: 1,
    issuedAt: acknowledgedAt,
    expiresAt,
    revokedAt: null
  }
  const authority = new OmpHostToolAuthority({
    attempt: {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      assignmentId: 'assignment_reconstruction',
      attemptId: 'attempt_reconstruction',
      fence: 5,
      status: 'running'
    },
    capabilityEnvelope,
    policyDecision
  })
  let starts = 0
  const bridge = new OmpHostToolBridge({
    authority,
    tools: [
      {
        reference,
        description: 'Reads exact admitted evidence.',
        parameters,
        parameterSchema: z.strictObject({ evidenceId: z.literal('evidence_profile') }),
        execute: () => {
          starts += 1
          return { evidenceId: 'evidence_profile' }
        }
      }
    ]
  })
  const cancellationAcknowledged = bridge.acknowledgeCancellation(acknowledgedAt)
  const result = await bridge.handleCall(
    {
      type: 'host_tool_call',
      id: 'post-cancel-call',
      toolCallId: 'post-cancel-model-call',
      toolName: 'evidence_read',
      arguments: argumentsValue
    },
    acknowledgedAt
  )
  const resultIsError = result.isError === true
  return {
    passed: cancellationAcknowledged && resultIsError && starts === 0 && authority.uses === 0,
    starts,
    uses: authority.uses,
    cancellationAcknowledged,
    resultIsError
  }
}
