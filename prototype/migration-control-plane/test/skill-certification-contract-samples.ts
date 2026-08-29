import {
  CANDIDATE_POINTER,
  REGRESSION,
  SKILL_CERTIFICATION
} from './skill-certification-fixture.js'

export const SKILL_CERTIFICATION_CONTRACT_SAMPLES = {
  'skill-certification.v1': SKILL_CERTIFICATION,
  'skill-active-pointer.v1': CANDIDATE_POINTER,
  'skill-regression.v1': REGRESSION.regression
} as const
