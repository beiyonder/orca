import { describe, expect, it } from 'vitest'
import { runSpecialistDisagreementExperiment } from '../src/specialist-disagreement-experiment.js'

describe('EXP-05 specialist disagreement benchmark', () => {
  it('meets supported-choice, citation, and true-tie abstention thresholds', () => {
    const result = runSpecialistDisagreementExperiment(413)
    expect(result).toMatchObject({
      status: 'passed',
      summary: '15/15 resolvable choices correct; 20/20 cited; 5/5 true ties explicit.',
      measures: [
        {
          name: 'supported_choice_accuracy',
          status: 'pass',
          value: { correct: 15, total: 15 }
        },
        {
          name: 'choice_citation_coverage',
          status: 'pass',
          value: { cited: 20, total: 20 }
        },
        {
          name: 'true_tie_abstention',
          status: 'pass',
          value: { explicit: 5, total: 5 }
        }
      ]
    })
  })

  it('preserves all 20 traces with 15 probes, five ties, and no selected stance', () => {
    const result = runSpecialistDisagreementExperiment(413)
    const cases = result.outputs.cases as unknown as {
      resolvable: boolean
      choiceCorrect: boolean
      citationsComplete: boolean
      tieExplicit: boolean
      resolution: { resolution: { status: string }; evidenceIds: string[]; selectedStance?: string }
    }[]
    expect(cases).toHaveLength(20)
    expect(cases.filter((testCase) => testCase.choiceCorrect)).toHaveLength(15)
    expect(cases.filter((testCase) => testCase.tieExplicit)).toHaveLength(5)
    expect(cases.every((testCase) => testCase.citationsComplete)).toBe(true)
    expect(cases.every((testCase) => testCase.resolution.evidenceIds.length === 2)).toBe(true)
    expect(cases.every((testCase) => testCase.resolution.selectedStance === undefined)).toBe(true)
  })

  it('replays byte-equivalent results for the same seed', () => {
    expect(runSpecialistDisagreementExperiment(413)).toEqual(
      runSpecialistDisagreementExperiment(413)
    )
  })
})
