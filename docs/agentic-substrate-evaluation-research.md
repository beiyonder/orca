# Independent Evaluation and Closed Self-Correction Research Card

## Coordinate

`P1-RSCH-07` — independent evaluation and closed self-correction

## Decision summary

Use a **product-owned evaluation registry and coordinator** that assigns versioned evaluators independently from the producer, records typed measures and evidence, and gates acceptance through explicit contracts.

The correction loop is:

```text
subject version produced
→ independent evaluation assignment
→ typed measures/verdict/evidence
→ failed measure creates attributed epistemic gap
→ diagnosis assignment identifies responsible decision/artifact/tool/context/skill
→ correction creates a new subject version
→ same acceptance contract runs again
→ accept, continue correcting within budget, or quarantine
```

Core rules:

- Producer self-review is useful feedback but never acceptance.
- Deterministic checks are preferred whenever the property is deterministic.
- External environment feedback, execution, source/target reads, and fault injection outrank model opinion.
- Model judges are used only for named semantic classes after calibration against held-out labels.
- The evaluator receives exact subject/input/contract versions and independent context.
- Evaluation results are immutable; corrections produce new subject versions.
- The agent cannot lower thresholds or change the evaluator merely because it failed.
- Evaluator changes are separately versioned decisions with regression evidence.
- Missing, failed, contradictory, or stale evaluation means unaccepted—not success.
- Correction cycles are bounded; repeated failure creates quarantine or a capability gap.

S1 uses one deterministic evaluator over a seeded artifact defect. It does not need an LLM judge, expert panel, process reward model, or production evaluator fleet.

## Evaluation taxonomy

### Contract/schema evaluation

Checks:

- type and schema validity;
- required fields/evidence;
- version compatibility;
- policy/authority constraints;
- plan graph and state-transition legality.

Preferred oracle: deterministic code.

### Artifact/build evaluation

Checks:

- clean build or parse;
- static analysis;
- configuration validity;
- reproducible artifact digest;
- declared tests;
- provenance completeness.

Preferred oracle: sandboxed compiler/checker/test runner.

### Data movement evaluation

Checks:

- source/target counts and keys;
- null/duplicate/error disposition;
- deletes/amendments;
- snapshot/CDC ordering and watermarks;
- replay equality;
- schema evolution;
- lineage and downstream contract.

Preferred oracle: deterministic reconciliation against fixture/source/target state.

### External effect evaluation

Checks:

- target identity/resource/request IDs;
- expected pre/post-state;
- authorization and idempotency;
- receipt integrity;
- target readback;
- rollback/repair outcome.

Preferred oracle: independently scoped target read.

### Security/privacy evaluation

Checks:

- tenant/data-class isolation;
- secrets and redaction;
- tool/network/file authority;
- policy denial paths;
- prompt/memory/context injection;
- evidence retention/export.

Preferred oracle: deterministic negative tests, scanners, sandbox traces, and calibrated security review.

### Performance/cost evaluation

Checks:

- throughput, latency, resource use;
- model/tool/token/cost budget;
- source/target impact;
- scaling and queue behavior;
- regression versus pinned baseline.

Preferred oracle: measured workload with statistics and noise treatment.

### Recovery evaluation

Checks:

- crash/restart/replay;
- duplicate/stale results;
- unknown effects;
- partitions/timeouts;
- backup/restore;
- projection/index rebuild;
- skill/memory/evaluator rollback.

Preferred oracle: fault injection and invariant checks.

### Semantic/domain evaluation

Checks:

- mapping meaning;
- business/clinical/claims behavior;
- functional equivalence;
- ambiguity and contraindications.

Preferred oracle: deterministic rules where possible, then held-out expert labels and calibrated independent model judges. Producer confidence is irrelevant.

### Orchestration evaluation

Checks:

- next-action quality;
- gap/probe choice;
- ownership/parallel safety;
- stall/livelock;
- specialist disagreement;
- completion predicate;
- budget and progress.

Preferred oracle: scenario fixtures, state invariants, evidence delta, and task outcome.

### Context/memory/skill evaluation

Checks:

- known-answer retrieval;
- citation grounding;
- stale/poison/cross-tenant exclusion;
- help/harm ablation;
- promotion/demotion;
- downstream impact.

Preferred oracle: held-out fixtures and controlled arms.

## Evaluation contracts

### `EvaluatorDefinition`

```text
evaluator_id
 evaluator_version
 evaluator_type
 implementation/artifact/image/model versions
 supported subject kinds/versions
 required tools/data/access
 independence requirements
 measures[]
 calibration corpus/version
 known limitations
 timeout/cost/resources
 failure and retry policy
```

### `EvaluationContract`

```text
contract_id / version
 subject_kind
 subject_schema/version
 required evaluator definitions
 input/evidence requirements
 measures[]
 thresholds and hard invariants
 composition rule: all | any | weighted advisory | ordered gates
 independence policy
 max_age/freshness
 failure/disagreement handling
 correction budget
 acceptance/repair/quarantine transitions
```

### `EvaluationAssignment`

```text
assignment_id / attempt_id / fence
 subject_id / subject_version / digest
 contract_id / version
 evaluator_id / version
 exact input/evidence refs
 context_manifest_id
 producer identity/model/tool/skill refs
 isolation and data policy
 deadline/budget
```

### `EvaluationMeasure`

```text
name
 value
 unit/type
 pass/fail/unknown
 threshold/operator
 evidence refs
 uncertainty/sample size/confidence interval where statistical
 failure code
```

### `EvaluationResult`

```text
result_id
 assignment/attempt/fence
 subject/version/digest
 evaluator/version
 status: passed | failed | partial | unavailable | contradictory | error | stale
 measures[]
 findings[]
 evidence refs[]
 coverage
 limitations
 recommended diagnosis targets[]
 created_at
 signature/digest
```

### `CorrectionRequest`

```text
correction_id
 failed_subject/version
 evaluation_result_ids[]
 failed measures/findings
 attributed component candidates
 open epistemic gaps
 allowed mutation scope
 unchanged acceptance contract
 max attempts/budget
 required new evidence
```

### `CorrectionResult`

```text
correction_id / attempt
 new_subject_id/version/digest
 changed components/decisions
 added evidence
 unresolved issues
 evaluator contract/version to rerun
 usage/cost
```

## Independence rules

The evaluator is independent enough only when its failure modes do not fully coincide with the producer’s.

Record dimensions separately:

- same/different process;
- same/different model and provider;
- same/different prompt/context;
- same/different tools and credentials;
- read-only versus mutation authority;
- producer reasoning/history visible or hidden;
- deterministic versus generative oracle;
- shared training/corpus contamination risk.

Rules:

1. Producer cannot submit the final evaluation verdict for its own subject.
2. Evaluator does not receive hidden producer reasoning unless the process trace itself is the subject.
3. Target effect evaluation uses separately scoped read credentials where practical.
4. Model judge uses an explicit grader model/role and never silently falls back to the producing model for critical gates.
5. Multiple model judges are not automatically independent; shared weights/provider/prompt/corpus are recorded.
6. Majority vote is advisory unless calibrated for the claim class.
7. Hard deterministic failures cannot be overruled by a model judge.

## Acceptance composition

Example:

```text
schema/contract pass
AND security hard invariants pass
AND build/replay/reconciliation pass
AND required semantic measures pass
AND evidence/citation coverage pass
AND no stale/contradictory required evaluator
```

Advisory scores may rank candidates but cannot compensate for a failed hard invariant.

An evaluator result expires when:

- subject version changes;
- required source/target state changes;
- evaluator or contract is revoked;
- freshness horizon expires;
- calibration regression invalidates the evaluator.

## Self-correction loop

### 1. Attribute failure

Do not send “try again.”

Convert evaluation failures into typed gaps:

- wrong or stale input/context;
- invalid plan/decision;
- missing capability/tool;
- artifact/code defect;
- source/target/environment change;
- evaluator defect/ambiguity;
- unsupported semantic assumption;
- transient infrastructure failure;
- authority or budget failure.

### 2. Select correction scope

Prefer the smallest component that can explain the failed measure.

Examples:

- bad citation → context/retrieval correction;
- schema parser error → artifact correction;
- target mismatch → mapping/transform correction;
- evaluator contradiction → evaluator investigation, not producer retry;
- repeated same failure → plan/capability gap.

### 3. Preserve acceptance contract

The correction attempt receives the failed measures and evidence but not permission to change thresholds.

If the evaluator/threshold is proven defective:

- create an evaluator-change decision;
- version contract/evaluator;
- rerun calibration/regression corpus;
- re-evaluate affected subjects;
- preserve old result history.

### 4. Create new subject version

Never mutate the failed subject in place.

Record:

- exact delta;
- changed decision/tool/context/skill;
- new evidence;
- model/runtime versions;
- correction cost;
- relationship to failed version.

### 5. Re-evaluate

Run the same pinned contract unless separately revised through evaluator governance.

### 6. Stop safely

S1 baseline:

- at most two correction attempts for the same failed measure/failure class;
- repeated failure without new evidence → quarantine and capability/gap record;
- evaluator unavailable/contradictory → unaccepted, not retry storm;
- unrelated mission branches continue.

## Evaluator governance

Evaluators are product capabilities and can fail.

Every evaluator needs:

- labeled calibration corpus;
- seeded critical and benign mutations;
- false-negative and false-positive rates;
- versioned implementation/model/prompt;
- operating envelope;
- known limitations;
- drift monitoring;
- rollback/revocation;
- affected-subject query.

Mutation testing is central: an evaluator should fail when a plausible critical bug is seeded and continue passing benign changes.

For semantic/model judges, measure:

- human/expert agreement;
- position-order sensitivity;
- verbosity/style bias;
- self-enhancement/producer-family bias;
- variance across repeated grading;
- calibration by claim class;
- abstention/disagreement rate;
- prompt/context leakage.

## Process versus outcome evaluation

Outcome evaluation asks whether the final result is correct.

Process evaluation checks observable intermediate artifacts/actions:

- evidence requests and probe results;
- plan revisions;
- tool/effect calls;
- test/reconciliation records;
- state transitions;
- authority checks.

Do not require hidden chain-of-thought. Evaluate durable observable process records.

Use process checks when they defend an invariant or localize failure. Do not reward verbose process for its own sake.

---

# Research synthesis

## Self-Refine

[Self-Refine](https://arxiv.org/abs/2303.17651) iterates generate → self-feedback → refine using the same model.

Useful:

- explicit feedback/refinement loop;
- task-specific stopping criteria;
- new output versions.

Insufficient for product acceptance:

- same model generates, critiques, and revises;
- no guaranteed external feedback;
- shared failure modes and self-confirmation.

Use as a correction proposal technique, never final evaluator.

## CRITIC

[CRITIC](https://arxiv.org/abs/2305.11738) uses external tools—search, code execution, toxicity checks—to critique and amend outputs.

Adopt:

- external environment/tool feedback;
- critique tied to observable evidence;
- iterative repair.

Our product makes tool feedback a durable `EvaluationResult` and keeps acceptance outside the producer.

## Limits of intrinsic self-correction

[Large Language Models Cannot Self-Correct Reasoning Yet](https://arxiv.org/abs/2310.01798) examines intrinsic self-correction without external feedback and reports important limitations.

Adopt:

- no assumption that reflection alone improves reasoning;
- require external evaluator/evidence for critical correction;
- compare correction against no-correction baseline.

## G-Eval and LLM judges

[G-Eval](https://aclanthology.org/2023.emnlp-main.153/) uses GPT-4 with criteria and chain-of-thought-style evaluation for NLG quality and reports improved human alignment.

[MT-Bench/Chatbot Arena judge research](https://arxiv.org/abs/2306.05685) identifies position, verbosity, self-enhancement, and reasoning biases in LLM judges.

Adopt:

- rubric-driven semantic evaluation;
- explicit grader role/model;
- order randomization and repeated arms;
- human/expert calibration.

Do not use an uncalibrated model judge as the sole oracle for critical correctness.

## Process supervision

[Let’s Verify Step by Step](https://arxiv.org/abs/2305.20050) compares outcome and process supervision for mathematical reasoning and demonstrates value from step-level feedback in that setting.

Adopt conceptually:

- evaluate observable intermediate decisions/actions where they help localize failures;
- separate process and outcome measures.

Do not require storing private chain-of-thought. Product process evidence is typed actions/artifacts/state transitions.

## Inspect AI

[Inspect scoring](https://inspect.aisi.org.uk/scoring.html) supports standard/custom/model graders, multiple scorers, metrics, and re-scoring logs.

[Inspect model grading](https://inspect.aisi.org.uk/model-graded.html) supports explicit grader models/roles and warns through configurable grading surfaces.

Potential value:

- experiment/evaluation harness;
- multi-scorer composition;
- model-grader calibration;
- trace/log review.

The product still owns evaluator contracts, versions, acceptance state, and evidence.

## SWE-bench

[SWE-bench](https://arxiv.org/abs/2310.06770) evaluates agent-produced repository changes through real issue fixtures and executable tests in isolated environments.

Adopt:

- outcome-grounded, reproducible environment tasks;
- executable oracle;
- real-world failure diversity;
- clean environment pinning.

Our migration benchmark must similarly use source/target fixtures, fault cases, and independent state checks.

## Mutation testing

Mutation testing seeds plausible defects to measure whether an evaluator/test suite notices them. Research comparing mutants and real faults supports mutation as a useful but imperfect proxy.

Adopt:

- critical and benign mutations;
- mutation kill rate plus false-rejection rate;
- claim-specific realistic defect operators;
- retain real incident failures when available.

---

# OMP implementation map

## Advisor runtime

Files:

- `packages/coding-agent/src/advisor/*`

Present:

- second-model review stream;
- independent advisor context;
- delta batching/coalescing;
- hazardous advisor output quarantine;
- secret obfuscation;
- loop guards and watchdog;
- inline steering back to primary.

Strong pattern:

- producer and advisor are separate agents;
- advisor output itself is untrusted/quarantinable;
- safety and context maintenance are explicit.

Limit:

- advisor produces guidance, not a versioned evaluation contract/verdict;
- primary can disagree and continue;
- no product subject/evaluator version or held-out calibration.

Disposition: adapt as advisory/correction feedback, not acceptance authority.

## TTSR

File:

- `packages/coding-agent/src/session/ttsr-coordinator.ts`

Present:

- stream/tool pattern detection;
- interrupt and rule injection;
- retry/resume gates;
- session event persistence.

Strong pattern:

- fast deterministic guardrails can interrupt bad behavior before completion.

Limit:

- regex/rule triggers are narrow policies, not complete evaluation;
- injected guidance does not prove corrected output.

Disposition: reuse for runtime guardrails; re-evaluate final subject independently.

## Cleanse

Files:

- `packages/coding-agent/src/cleanse/loop.ts`
- `packages/coding-agent/src/cleanse/checkers.ts`

Present:

- discovers deterministic project checkers;
- streams diagnostics;
- assigns bounded repair agents with file ownership;
- late diagnostics/follow-ups;
- post-repair verification pass;
- bounded worker pool.

Strong pattern:

- diagnose → assign correction → deterministic verify;
- checks run after combined edits;
- ownership avoids overlapping file repair.

Disposition: strongest direct implementation precedent for S1 correction loop.

## Security coordinator

Files:

- `packages/coding-agent/src/security/contracts/*`
- `security/coordinator.ts`
- `security/comparison.ts`

Present:

- structured finding/evidence/provenance/occurrence/severity/confidence/taxonomy;
- validation and disposition status;
- coverage and deferred surfaces;
- model/account/knowledge-base refs;
- operation phases and durable bundles;
- producer and lineage comparison.

Strong pattern:

- evaluator/finding provenance;
- coverage and unvalidated/rejected/partial states;
- compare producers and scan lineages.

Limit:

- confidence is categorical but still producer/report metadata;
- security workflow is specialized;
- no universal subject/evaluator/correction contract.

Disposition: adapt contract/provenance/coverage/comparison design.

## Review/task/eval primitives

Present:

- structured reviewer findings with priority/file/line/confidence;
- strict structured subagent schemas;
- independent models/roles;
- eval code kernels and test tools.

Limit:

- reviewer confidence is not calibrated acceptance;
- permissive schema mode exists and must be disabled for product evaluator results.

## Autoresearch and metaharness

Present:

- repeatable experiments;
- baseline/best metrics and noise estimate;
- keep/discard/crash/checks-failed;
- normalized benchmark traces;
- cost/usage capture;
- run resume and artifacts.

Disposition:

- reuse/adapt experiment and comparison harness for evaluator calibration and regression.

## OMP conclusion

OMP contains strong correction/evaluation pieces but no unified product evaluation authority. The best reuse is:

- Cleanse-style deterministic verify loop;
- advisor as independent advisory signal;
- TTSR as runtime guard;
- security finding/provenance/coverage contracts;
- strict subagents and metaharness for calibration.

---

# Orca implementation map

Orca provides:

- durable task/attempt/failure records;
- stale completion rejection;
- circuit breakers and retry counts;
- exact worker/process identity;
- artifact and transcript capture;
- source-control/test/CI visibility;
- extensive contract/e2e tests and fault fixtures;
- operator surfaces for reviewing outputs.

Missing:

- general evaluator definition/contract/version registry;
- independent evaluation assignments;
- subject-version acceptance state;
- evaluator coverage/calibration/drift;
- failed-measure diagnosis and correction requests;
- mutation corpus and false-positive/negative tracking;
- impact query when evaluator is revoked.

Disposition:

- reuse task/attempt/evidence/UI and testing patterns;
- build evaluation coordinator/registry as new product authority.

---

# Architecture comparison

| Approach | Strength | Failure for this product | Decision |
| --- | --- | --- | --- |
| Producer self-review only | Cheap and immediate. | Shared failure mode; intrinsic correction may degrade reasoning. | Advisory only. |
| Second-model critic | Different context/model possible. | Bias, correlation, uncalibrated verdict, no environment truth. | Advisory or calibrated semantic evaluator. |
| Deterministic validators/tests | Reproducible, inspectable, cheap. | Cannot cover irreducible semantics or unknown requirements. | Preferred oracle where applicable. |
| Environment/target readback | Measures external reality. | May be incomplete/ambiguous and needs scope/identity. | Required for effects/data state. |
| Human/expert labels | Strong for irreducible semantics/accountability. | Expensive, slow, variable, unavailable at scale. | Held-out calibration and true exceptions. |
| Composite product evaluator contract | Combines hard invariants and calibrated semantic measures. | Requires registry, fixtures, governance and operations. | **Selected.** |

## Selected S1 evaluation flow

```text
Artifact V1 produced by specialist
→ evaluator assignment with exact subject/input/contract
→ deterministic seeded-defect check fails
→ EvaluationResult records failed measure and evidence
→ epistemic gap + CorrectionRequest
→ fresh correction specialist produces Artifact V2
→ same evaluator contract runs unchanged
→ V2 passes
→ kernel accepts V2
→ FailureLessonCandidate created and quarantined
```

S1 excludes:

- model judge as gate;
- human expert workflow;
- process reward model;
- skill/model promotion;
- production evaluator fleet;
- automatic evaluator synthesis.

---

# Experiment suite

## `EVAL-EXP-01` — Critical and benign mutations

Fixture:

- baseline artifact;
- critical mutations in schema, mapping, delete, precision, identity, security and recovery;
- benign refactors/format/order changes.

Pass:

- every S1 critical mutation killed;
- benign false-rejection below declared threshold;
- failure points to exact measure/evidence;
- evaluator version and fixture seed recorded.

## `EVAL-EXP-02` — Evaluator outage and disagreement

Fixture:

- deterministic evaluator unavailable;
- two semantic evaluators disagree;
- one result arrives stale.

Pass:

- subject remains unaccepted;
- exact missing/contradictory/stale status recorded;
- unrelated work continues;
- no majority vote silently resolves a hard claim;
- re-evaluation uses current subject/contract.

## `EVAL-EXP-03` — Producer/evaluator separation

Fixture:

- producer attempts to grade own output;
- evaluator shares producer context/model;
- evaluator receives hidden reasoning containing answer hints.

Pass:

- critical gate rejects non-independent evaluator assignment;
- independence dimensions recorded;
- deterministic oracle remains usable;
- no producer result field can set acceptance.

## `EVAL-EXP-04` — Closed correction with fixed contract

Fixture:

- V1 fails one seeded critical measure;
- correction worker receives failure evidence;
- worker attempts to lower threshold/change evaluator;
- V2 fixes defect.

Pass:

- threshold/evaluator change rejected;
- V2 is new immutable subject version;
- same contract passes V2;
- full delta and cost recorded;
- V1 remains rejected history.

## `EVAL-EXP-05` — Correction overfitting

Fixture:

- visible failing example;
- hidden related and counterexample cases;
- correction that special-cases visible input.

Pass:

- held-out evaluator catches special case;
- correction quarantined or revised;
- no acceptance from visible test alone;
- new evidence/gap identifies overfit failure class.

## `EVAL-EXP-06` — Model-judge bias

Fixture:

- answer order swapped;
- verbose versus concise equivalent answers;
- producer-family versus other-family outputs;
- repeated grades.

Pass:

- position/verbosity/self-family sensitivity reported;
- judge cannot gate claim classes whose calibrated error exceeds threshold;
- deterministic/human labels remain source of calibration;
- disagreement yields partial/unknown, not forced verdict.

## `EVAL-EXP-07` — Evaluator regression and revocation

Fixture:

- evaluator V1 accepted prior subjects;
- V2 misses a seeded critical mutation;
- V2 had evaluated new subjects.

Pass:

- V2 revoked/demoted;
- affected subjects found by evaluator version;
- required re-evaluations/impact reviews created once;
- V1 or fixed V3 restored under versioned contract;
- history unchanged.

## `EVAL-EXP-08` — Composite acceptance

Fixture:

- schema pass;
- security hard fail;
- semantic high score;
- evidence coverage partial.

Pass:

- hard failure prevents acceptance regardless of advisory score;
- composition rule and every measure inspectable;
- partial coverage remains explicit;
- exact unsatisfied predicates returned.

## `EVAL-EXP-09` — Process versus outcome

Fixture:

- correct outcome through prohibited effect;
- wrong outcome through apparently good process;
- correct outcome with minimal valid process.

Pass:

- prohibited process fails security/authority even if outcome looks right;
- wrong outcome fails;
- verbosity is not rewarded;
- observable intermediate records localize failure without chain-of-thought dependency.

## `EVAL-EXP-10` — Correction budget and quarantine

Fixture:

- same failure persists through two correction attempts without new evidence;
- evaluator remains valid.

Pass:

- no infinite loop;
- scope quarantined after budget;
- capability/gap record created;
- unrelated work continues;
- smallest external exception generated only if applicable.

## S1 required subset

S1 requires:

- `EVAL-EXP-01` mutation detection;
- `EVAL-EXP-02` outage behavior;
- `EVAL-EXP-03` independence;
- `EVAL-EXP-04` fixed-contract correction;
- `EVAL-EXP-05` overfit protection;
- `EVAL-EXP-08` hard-gate composition;
- `EVAL-EXP-10` bounded correction.

Model-judge calibration and evaluator-regression operations may follow immediately after S1 if seams remain intact.

## Reversal conditions

Revisit the selected coordinator if:

- evaluator contracts cannot express domain-specific acceptance without excessive custom code;
- an external evaluation platform passes provenance/version/independence/state contracts with lower complexity;
- deterministic mutation suites fail to correlate with real incidents;
- model judges become sufficiently calibrated for named claim classes;
- evaluation throughput/operations require a separate service boundary.

## Next coordinate

`P1-RSCH-08` — research governed self-improvement and skill learning.
