import {
  AUTHORITY_EXCLUSIONS,
  SpecialistAssignmentSchema,
  type SpecialistAssignment,
  type SpecialistRole
} from './specialist-agent-contracts.js'

export type SpecialistRoleContract = {
  role: SpecialistRole
  version: 1
  allowedToolNames: readonly string[]
  outputSchemaName: string
  maxBudget: SpecialistAssignment['budget']
  authorityExclusions: readonly (typeof AUTHORITY_EXCLUSIONS)[number][]
  evidenceObligation: 'cite-every-material-claim'
  abstention: 'required-when-material-evidence-is-missing'
}

const defaultMaxBudget = Object.freeze({
  tokenLimit: 32_000,
  timeLimitMs: 900_000,
  toolCallLimit: 64,
  outputByteLimit: 4 * 1024 * 1024,
  costLimitUsd: 50
})
const toolsByRole: Record<SpecialistRole, readonly string[]> = {
  'source-forensics': ['evidence_read', 'check_candidate_key'],
  'platform-architecture': ['evidence_read'],
  cdc: ['evidence_read', 'check_candidate_key'],
  mapping: ['evidence_read', 'check_candidate_key', 'artifact_write'],
  research: ['evidence_read'],
  security: ['evidence_read'],
  build: ['evidence_read', 'artifact_write'],
  evaluation: ['evidence_read', 'check_candidate_key'],
  recovery: ['evidence_read']
}

function roleContract(role: SpecialistRole): SpecialistRoleContract {
  return Object.freeze({
    role,
    version: 1,
    allowedToolNames: Object.freeze(toolsByRole[role]),
    outputSchemaName: `${role}-result.v1`,
    maxBudget: defaultMaxBudget,
    authorityExclusions: AUTHORITY_EXCLUSIONS,
    evidenceObligation: 'cite-every-material-claim',
    abstention: 'required-when-material-evidence-is-missing'
  })
}

export const SPECIALIST_ROLE_CONTRACTS: Readonly<Record<SpecialistRole, SpecialistRoleContract>> =
  Object.freeze({
    'source-forensics': roleContract('source-forensics'),
    'platform-architecture': roleContract('platform-architecture'),
    cdc: roleContract('cdc'),
    mapping: roleContract('mapping'),
    research: roleContract('research'),
    security: roleContract('security'),
    build: roleContract('build'),
    evaluation: roleContract('evaluation'),
    recovery: roleContract('recovery')
  })

export class SpecialistContractError extends Error {
  readonly code: string
  constructor(code: string, message: string) {
    super(message)
    this.name = 'SpecialistContractError'
    this.code = code
  }
}

function exceedsBudget(
  actual: SpecialistAssignment['budget'],
  maximum: SpecialistAssignment['budget']
): boolean {
  return (
    actual.tokenLimit > maximum.tokenLimit ||
    actual.timeLimitMs > maximum.timeLimitMs ||
    actual.toolCallLimit > maximum.toolCallLimit ||
    actual.outputByteLimit > maximum.outputByteLimit ||
    actual.costLimitUsd > maximum.costLimitUsd
  )
}

export function validateSpecialistAssignment(input: unknown): SpecialistAssignment {
  const assignment = SpecialistAssignmentSchema.parse(input)
  const contract = SPECIALIST_ROLE_CONTRACTS[assignment.role]
  const actualTools = assignment.allowedTools.map((tool) => tool.name)
  if (
    actualTools.length !== contract.allowedToolNames.length ||
    actualTools.some((name, index) => name !== contract.allowedToolNames[index])
  ) {
    throw new SpecialistContractError(
      'tool_contract_mismatch',
      'Allowed tools do not match the role contract'
    )
  }
  if (
    assignment.outputSchema.name !== contract.outputSchemaName ||
    assignment.outputSchema.version !== contract.version
  ) {
    throw new SpecialistContractError(
      'output_contract_mismatch',
      'Output schema does not match the role contract'
    )
  }
  if (exceedsBudget(assignment.budget, contract.maxBudget)) {
    throw new SpecialistContractError('role_budget_exceeded', 'Assignment exceeds the role budget')
  }
  if (
    assignment.authority.exclusions.some(
      (value, index) => value !== contract.authorityExclusions[index]
    )
  ) {
    throw new SpecialistContractError(
      'authority_expansion',
      'Assignment authority exclusions are incomplete'
    )
  }
  return assignment
}
