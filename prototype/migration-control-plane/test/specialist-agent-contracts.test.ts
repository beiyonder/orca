import { describe, expect, it } from 'vitest'
import {
  SpecialistAssignmentSchema,
  SpecialistResultSchema,
  SpecialistRoleSchema
} from '../src/specialist-agent-contracts.js'
import {
  SPECIALIST_ROLE_CONTRACTS,
  SpecialistContractError,
  validateSpecialistAssignment
} from '../src/specialist-role-contract-registry.js'
import {
  specialistAssignment as assignment,
  specialistBriefs as briefs,
  specialistFixtureDigest as digest,
  specialistOutputs as outputs,
  specialistResult as result
} from './specialist-agent-fixture.js'

function expectContractError(operation: () => unknown, code: string): void {
  try {
    operation()
    throw new Error('Expected specialist contract error')
  } catch (error) {
    if (!(error instanceof SpecialistContractError)) {
      throw error
    }
    expect(error.code).toBe(code)
  }
}

describe('specialist agent contracts', () => {
  it('registers exactly nine proposal-only evidence and abstention contracts', () => {
    expect(SpecialistRoleSchema.options).toEqual([
      'source-forensics',
      'platform-architecture',
      'cdc',
      'mapping',
      'research',
      'security',
      'build',
      'evaluation',
      'recovery'
    ])
    for (const role of SpecialistRoleSchema.options) {
      const contract = SPECIALIST_ROLE_CONTRACTS[role]
      expect(contract).toMatchObject({
        role,
        version: 1,
        evidenceObligation: 'cite-every-material-claim',
        abstention: 'required-when-material-evidence-is-missing'
      })
      expect(contract.authorityExclusions).toEqual([
        'mission-state-mutation',
        'assignment-dispatch',
        'effect-execution',
        'self-acceptance',
        'policy-mutation'
      ])
      expect(Object.isFrozen(contract)).toBe(true)
    }
  })

  it('validates the typed brief, scope, tools, output, budget, and authority for every role', () => {
    for (const role of SpecialistRoleSchema.options) {
      expect(validateSpecialistAssignment(assignment(role))).toMatchObject({
        role,
        brief: { kind: role },
        authority: { mode: 'proposal-only' }
      })
    }
  })

  it('accepts a role-matched yielded result with claim-level manifest citations', () => {
    for (const role of SpecialistRoleSchema.options) {
      expect(SpecialistResultSchema.parse(result(role))).toMatchObject({
        role,
        outcome: {
          status: 'yielded',
          roleOutput: { kind: role },
          evidenceIds: ['evidence_profile']
        }
      })
    }
  })

  it('rejects a brief, yielded payload, or citation owned outside its typed result', () => {
    expect(() =>
      SpecialistAssignmentSchema.parse({ ...assignment('mapping'), brief: briefs.security })
    ).toThrow()
    const mismatched = result('mapping')
    const yielded = mismatched.outcome as Record<string, unknown>
    expect(() =>
      SpecialistResultSchema.parse({
        ...mismatched,
        outcome: { ...yielded, roleOutput: outputs.security }
      })
    ).toThrow()
    expect(() =>
      SpecialistResultSchema.parse({
        ...mismatched,
        outcome: { ...yielded, evidenceIds: ['evidence_document'] }
      })
    ).toThrow()
  })

  it('rejects tool, output schema, budget, and authority expansion', () => {
    const base = assignment('mapping')
    for (const [changed, code] of [
      [{ ...base, allowedTools: [] }, 'tool_contract_mismatch'],
      [
        { ...base, outputSchema: { name: 'security-result.v1', version: 1, digest } },
        'output_contract_mismatch'
      ],
      [
        { ...base, budget: { ...(base.budget as object), costLimitUsd: 51 } },
        'role_budget_exceeded'
      ],
      [
        {
          ...base,
          authority: {
            mode: 'proposal-only',
            exclusions: [
              ...SPECIALIST_ROLE_CONTRACTS.mapping.authorityExclusions.slice(0, -1),
              'mission-state-mutation'
            ]
          }
        },
        'authority_expansion'
      ]
    ] as const) {
      expectContractError(() => validateSpecialistAssignment(changed), code)
    }
  })

  it('allows explicit abstention only with a concrete missing-evidence list', () => {
    const base = result('research')
    const abstained = {
      ...base,
      outcome: {
        status: 'abstained',
        reason: 'Current primary source unavailable.',
        missingEvidence: ['Current vendor release note.'],
        evidenceIds: []
      }
    }
    expect(SpecialistResultSchema.parse(abstained)).toMatchObject({
      outcome: { status: 'abstained' }
    })
    expect(() =>
      SpecialistResultSchema.parse({
        ...abstained,
        outcome: { ...(abstained.outcome as object), missingEvidence: [] }
      })
    ).toThrow()
    expect(() => SpecialistResultSchema.parse({ ...abstained, accepted: true })).toThrow()
  })
})
