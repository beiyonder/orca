import { z } from 'zod'
import { canonicalJson, sha256Text, type JsonValue } from '../src/canonical-json.js'
import type { OmpHostToolAuthorityInput } from '../src/omp-host-tool-authority.js'
import type { OmpHostToolDefinition } from '../src/omp-host-tool-bridge.js'

const issuedAt = '2026-01-01T00:00:00.000Z'
const expiresAt = '2026-01-01T01:00:00.000Z'
const target = {
  provider: 'fixture',
  account: 'synthetic',
  project: null,
  region: null,
  resourceType: 'evidence-item',
  resourceId: 'evidence_s1'
}
export const now = '2026-01-01T00:01:00.000Z'
export const parameters = {
  type: 'object',
  additionalProperties: false,
  properties: { evidenceId: { type: 'string' } },
  required: ['evidenceId']
}
export const allowedArguments = { evidenceId: 'evidence_s1' }
const parameterDigest = sha256Text(canonicalJson(allowedArguments))
const expectedPreStateDigest = sha256Text(canonicalJson({ admitted: true }))
const runnerDigest = '4'.repeat(64)
const reference = {
  name: 'evidence_read',
  version: '1',
  schemaDigest: sha256Text(canonicalJson(parameters)),
  approval: 'read' as const
}
export const budget = {
  tokenLimit: 1_000,
  timeLimitMs: 10_000,
  toolCallLimit: 2,
  outputByteLimit: 10_000,
  costLimitUsd: 1
}

export function policy(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    kind: 'policy-decision',
    id: 'policy_s1',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    createdAt: issuedAt,
    effectId: 'effect_s1',
    intentDigest: '1'.repeat(64),
    policyBundleVersion: '1',
    policyBundleDigest: '2'.repeat(64),
    structuredInputDigest: '3'.repeat(64),
    decision: 'allow',
    grant: {
      target,
      adapterName: 'fixture-evidence',
      adapterVersion: '1',
      adapterMethod: 'read',
      parameterDigest,
      expectedPreStateDigest,
      subjectVersion: 'evidence-s1-v1',
      runnerDigest,
      toolNames: ['evidence_read'],
      networkDestinations: [],
      secretScopes: [],
      budget,
      maxUses: 2,
      expiresAt
    },
    obligations: [],
    ruleIds: ['fixture.read'],
    reasons: ['Assignment may read its admitted evidence.'],
    decidedBy: { kind: 'system', id: 'policy-engine', version: '1' },
    expiresAt,
    ...overrides
  }
}

export function envelope(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    schemaVersion: 2,
    kind: 'capability-envelope',
    id: 'envelope_s1',
    tenantId: 'tenant_s1',
    missionId: 'mission_s1',
    createdAt: issuedAt,
    effectId: 'effect_s1',
    intentDigest: '1'.repeat(64),
    policyDecisionId: 'policy_s1',
    workload: {
      assignmentId: 'assignment_s1',
      attemptId: 'attempt_s1',
      fence: 4,
      issuer: 'spiffe://migration-lab',
      subject: 'spiffe://migration-lab/omp-s1',
      audience: 'omp:specialist'
    },
    target,
    adapterName: 'fixture-evidence',
    adapterVersion: '1',
    adapterMethod: 'read',
    parameterDigest,
    expectedPreStateDigest,
    subjectVersion: 'evidence-s1-v1',
    runnerDigest,
    allowedTools: [reference],
    allowedNetworkDestinations: [],
    dataClasses: ['synthetic'],
    secretLeaseIds: [],
    budget,
    maxUses: 2,
    issuedAt,
    expiresAt,
    revokedAt: null,
    ...overrides
  }
}

export function authorityInput(
  overrides: Partial<OmpHostToolAuthorityInput> = {}
): OmpHostToolAuthorityInput {
  return {
    attempt: {
      tenantId: 'tenant_s1',
      missionId: 'mission_s1',
      assignmentId: 'assignment_s1',
      attemptId: 'attempt_s1',
      fence: 4,
      issuer: 'spiffe://migration-lab',
      subject: 'spiffe://migration-lab/omp-s1',
      audience: 'omp:specialist',
      subjectVersion: 'evidence-s1-v1',
      runnerDigest,
      status: 'running'
    },
    capabilityEnvelope: envelope(),
    policyDecision: policy(),
    ...overrides
  }
}

export function hostToolCall(
  id: string,
  argumentsValue: Record<string, JsonValue> = allowedArguments,
  toolName = 'evidence_read'
) {
  return {
    type: 'host_tool_call' as const,
    id,
    toolCallId: `model-${id}`,
    toolName,
    arguments: argumentsValue
  }
}

export function evidenceReadTool(execute: OmpHostToolDefinition['execute']): OmpHostToolDefinition {
  return {
    reference,
    label: 'Evidence read',
    description: 'Reads one admitted evidence item.',
    parameters,
    parameterSchema: z.strictObject({ evidenceId: z.string().min(1) }),
    execute
  }
}
