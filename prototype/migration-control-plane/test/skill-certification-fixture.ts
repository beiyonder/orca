import { buildSkillLifecycleQualificationFixture } from '../src/skill-lifecycle-qualification-fixture.js'

const fixture = buildSkillLifecycleQualificationFixture(701)

export const BASELINE_SKILL = fixture.baseline
export const CANDIDATE_SKILL = fixture.candidate
export const SKILL_CERTIFICATION = fixture.certification
export const BASELINE_POINTER = fixture.baselinePointer
export const CANDIDATE_POINTER = fixture.candidatePointer
export const REGRESSION = fixture.regression
