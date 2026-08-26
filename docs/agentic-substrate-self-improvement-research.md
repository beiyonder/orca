# Governed Self-Improvement and Skill Learning Research Card

## Coordinate

`P1-RSCH-08` — governed self-improvement and skill learning

## Decision summary

Use a **product-owned improvement lab and capability registry**. Production outcomes may create quarantined learning candidates, but an optimizer never edits the active system directly.

Lifecycle:

```text
accepted outcome or diagnosed failure
→ LearningCandidate (quarantined)
→ exact change class and causal hypothesis
→ frozen baseline + train/selection/held-out/adversarial corpora
→ bounded optimizer trials
→ independent certification against active baseline
→ shadow
→ canary within unchanged authority envelope
→ promote narrowly or reject
→ trace every use and outcome
→ detect drift/harm
→ demote/revoke and restore last certified version
```

Core rules:

- Change the least powerful layer that can fix the repeated failure.
- A learning candidate cannot affect the mission that created it.
- Optimizer, evaluator, corpus split, promotion authority, and runtime capability are separate roles.
- Optimizers may propose changes; they cannot change objectives, held-out cases, thresholds, authority, or their own promotion policy.
- Certification is target-specific: model, provider, harness, tools, data class, environment and task class are part of the envelope.
- Promotion requires improvement over the active baseline, no hard-regression, reproducibility, bounded cost/latency, and rollback readiness.
- One aggregate score cannot offset a safety, privacy, authority, evidence, or correctness failure.
- Every invocation records the exact capability version and downstream outcome.
- Drift or evaluator revocation blocks new use before repair.
- The last certified version remains available for rollback.
- Weight training is the last—not first—optimization layer.

S1 creates one quarantined `FailureLessonCandidate` after successful correction. It never recalls, evaluates, promotes, installs or executes that candidate.

## What can improve

### Retrieval/context policy

Examples:

- source eligibility and ranking;
- query expansion;
- context ordering/packing;
- freshness/refresh policy;
- citation policy.

Risk: leakage, stale evidence, changed constraints, model-specific overfit.

### Prompt/program configuration

Examples:

- instructions;
- demonstrations;
- decomposed LM-program modules;
- model parameters and route;
- retry/budget settings.

Risk: distributional overfit, objective gaming, brittle model coupling, prompt bloat.

### Procedure/skill

Examples:

- repeatable diagnosis workflow;
- source-specific discovery sequence;
- mapping or CDC checklist;
- recovery playbook;
- tool-use policy.

Risk: negative transfer, stale procedures, hidden authority expansion, unsafe bundled code.

### Tool or generated code

Examples:

- reusable parser/validator/probe;
- connector adapter;
- deterministic evaluator;
- automation script.

Risk: supply-chain, sandbox escape, compatibility, external effects, code defects.

### Model route

Examples:

- different model/provider/size;
- specialist versus generalist;
- ensemble or escalation policy.

Risk: data residency, provider drift, correlated evaluators, cost/latency.

### Model weights

Examples:

- fine-tuning;
- distillation;
- reinforcement training.

Risk: opaque regression, data governance, catastrophic forgetting, expensive rollback/evaluation. Deferred until a stable corpus and repeated model-specific error justify it.

## Least-powerful-change ladder

Attempt in order when compatible with the diagnosed cause:

1. correct missing/stale evidence;
2. correct context selection/packing;
3. correct instruction or deterministic policy;
4. add or revise a scoped skill;
5. add or revise a deterministic tool;
6. change model route;
7. train weights.

Do not optimize a prompt when the evaluator is wrong, a tool is missing, the source changed, or authority is insufficient.

## Product contracts

### `LearningCandidate`

```text
candidate_id
 candidate_type: context_policy | prompt_program | skill | tool | model_route | evaluator | corpus | model_weights
 source mission/result/evaluation/diagnosis/evidence refs
 causal hypothesis and targeted failure classes
 proposed change/diff/artifact digest
 target task/claim/domain/model/harness/environment envelope
 baseline capability/version
 allowed mutation scope
 authority delta (must be none unless separately approved)
 data classification/tenant/export policy
 candidate status: quarantined | eligible | experimenting | certified | rejected | revoked
 retention/expiry
```

### `OptimizationPlan`

```text
optimization_id
 candidate_id
 optimizer implementation/model/prompt/version
 fixed objective and measures
 frozen baseline/version
 corpus manifest/version
 immutable train/selection/held-out/adversarial splits
 contamination checks
 trial/edit/search budget
 random seeds/model runs
 allowed components and maximum edit size
 stopping rule
 evaluator contracts/versions
 cost/latency/safety constraints
```

### `OptimizationTrial`

```text
trial_id / parent_candidate
 exact proposed version/digest/diff
 optimizer inputs/trajectory refs
 train/selection results
 resource usage/cost
 rejected-edit feedback
 reproducibility data
 status: keep-for-search | discard | crash | evaluator_error | out_of_scope
```

### `CapabilityManifest`

```text
capability_id / version / digest
 kind and typed input/output contract
 description/discovery metadata
 implementation: prompt/skill/code/model route
 compatible models/providers/harness/runtime/tools
 required permissions/network/filesystem/secrets
 tenant/data-class/use policy
 authority envelope
 dependencies and versions
 supported/unsupported task envelope
 evaluator/corpus/certification refs
 provenance/license/signer
 created/revoked/superseded timestamps
 rollback predecessor
```

### `CertificationResult`

```text
certification_id
 candidate/baseline versions
 evaluator and corpus split versions
 target envelope
 repetitions/seeds/sample size
 metric deltas and uncertainty
 per-slice results
 hard invariant results
 cost/latency/resource deltas
 leakage/security/authority checks
 robustness/adversarial results
 status: passed | failed | inconclusive | stale | revoked
 limitations
```

### `PromotionDecision`

```text
promotion_id
 candidate/certification refs
 deployment envelope
 shadow/canary stages and limits
 approver/policy decision
 stable predecessor
 automatic abort/demotion conditions
 expiry/re-certification trigger
```

### `CapabilityUseTrace`

```text
assignment/attempt/mission
 capability_id/version/digest
 model/provider/harness/tool/environment versions
 context manifest
 matched task/envelope
 output/evaluation/outcome refs
 cost/latency
 adverse signal
```

### `DriftSignal`

```text
capability/version
 time window and population slice
 baseline/current measures
 data/model/tool/environment change
 evaluator status
 severity
 affected use refs
 action: observe | pause | demote | revoke | re-certify
```

## Separation of roles

| Role | May do | Must not do |
| --- | --- | --- |
| Candidate extractor | Propose a lesson, skill or other change from outcomes. | Activate it or label it successful. |
| Optimizer | Generate bounded candidate versions against train/selection feedback. | Read held-out labels, change splits/objective/thresholds, expand authority, promote itself. |
| Evaluator | Run pinned independent certification and emit measures/evidence. | Modify candidate or choose production traffic. |
| Registry | Store immutable versions, compatibility, certifications and status. | Infer success from install/download/popularity. |
| Promotion controller | Apply declared shadow/canary policy to certified version. | Bypass hard failures or widen envelope silently. |
| Runtime | Resolve one active compatible version and emit use trace. | Load quarantined/revoked/incompatible content. |
| Reconciler | Detect stale certs/drift and demote/revoke. | Rewrite learning artifacts in place. |

## Corpus and leakage policy

Before the first optimization trial:

- freeze corpus manifest and digests;
- split by underlying case/entity/customer/time—not just rows;
- isolate train, selection, held-out and adversarial sets;
- hide held-out labels and raw cases from optimizer context;
- retain a never-tuned external test set for major promotion;
- record synthetic/generated lineage;
- scan overlap, paraphrase/near-duplicate and source leakage;
- keep production incidents quarantined until licensed/classified/de-identified;
- version evaluator and annotations;
- forbid optimizer-generated examples from entering certification without independent validation.

For small datasets, prefer cross-validation or repeated holdouts but preserve a final untouched set.

## Certification policy

A candidate is certifiable only if:

1. baseline and candidate run on the same pinned envelope;
2. required evaluator contracts are current;
3. held-out primary metric improves by declared margin/uncertainty rule;
4. every hard correctness/security/privacy/authority/evidence invariant passes;
5. every protected slice meets floor;
6. cost/latency/resource use remains within envelope;
7. repeated seeds/runs show stable direction;
8. adversarial and negative-transfer cases pass;
9. candidate diff and artifact are reproducible;
10. rollback predecessor and impact query exist.

Certification is scoped, not global. A skill can be certified for:

```text
source-discovery/v1
+ model family/version range
+ OMP harness version
+ read-only source tools
+ non-production tenant data class
+ PostgreSQL 12–16
```

and remain uncertified elsewhere.

## Shadow, canary, promotion and rollback

### Shadow

Run candidate beside stable on the same eligible assignments without allowing candidate results/effects to drive authority.

Measure:

- outcome delta;
- failure slices;
- cost/latency;
- tool/effect differences;
- evaluator disagreement;
- context/memory interactions.

### Canary

Route a bounded eligible fraction only after offline certification.

Constraints:

- no wider tools/credentials/authority than stable;
- immutable max traffic/tasks/time/cost;
- automatic abort on hard failure or metric floor;
- stable remains available;
- mission state records which arm acted;
- effects require normal policy/idempotency/evaluation.

### Promotion

Move the active pointer transactionally from expected stable version to certified candidate. Do not overwrite artifacts.

### Demotion/revocation

Stop new assignments immediately when:

- critical failure;
- certification/evaluator revoked;
- model/tool/environment incompatibility;
- drift threshold;
- cross-tenant/security incident;
- abnormal harm versus stable.

In-flight policy is explicit: finish read-only work, cancel pre-effect work, and reconcile any external effect normally.

### Rollback

Restore the last compatible certified pointer. Re-evaluate outputs materially affected by the revoked version through `CapabilityUseTrace`.

## Curriculum and capability-gap learning

A curriculum is a queue of validated capability gaps, not a model’s unrestricted desire to explore.

Candidate curriculum sources:

- repeated diagnosed production failures;
- unresolved high-impact epistemic gaps;
- connector/platform capability matrix gaps;
- evaluator mutation survivors;
- expert-authored benchmark cases;
- new supported version/environment;
- adversarial/security findings.

Rank by:

- customer/mission impact;
- recurrence;
- evaluator readiness;
- safety and cost;
- expected reuse;
- current capability coverage.

Generated tasks remain candidate corpus until independently checked for validity, novelty, label correctness, licensing and leakage.

## Meta-governance

The system must not autonomously rewrite its own constitution.

Protected meta-contracts:

- authority/policy ceiling;
- tenant/data-class boundaries;
- evaluator composition and hard thresholds;
- held-out split and labels;
- promotion/demotion policy;
- audit/provenance requirements;
- budget ceilings;
- revocation mechanism.

Changes to these create separately reviewed architecture/policy candidates. They cannot be side effects of optimizing a worker skill.

---

# Research synthesis

## Voyager

[Voyager](https://arxiv.org/abs/2305.16291) combines an automatic exploration curriculum, executable code skill library, and iterative improvement using environment feedback, execution errors and self-verification.

Adopt:

- executable, compositional skills;
- environment feedback;
- iterative candidate improvement;
- curriculum around capability frontier.

Do not adopt directly:

- open-ended exploration as product authority;
- self-verification as certification;
- ever-growing active library without tenant, evaluator, lifecycle and rollback governance.

## LATM

[Large Language Models as Tool Makers](https://arxiv.org/abs/2305.17126) separates tool making from tool use and caches reusable tools.

Adopt:

- maker/user separation;
- amortize expensive tool creation;
- verify reusable executable artifacts.

Product addition:

- maker output starts quarantined;
- deterministic build/security/behavior evaluation;
- signed/versioned artifact and sandbox envelope;
- no runtime install until certified.

## ART and Toolformer

[ART](https://arxiv.org/abs/2303.09014) selects demonstrations from a task library and generates programs interleaving reasoning and tool use. [Toolformer](https://arxiv.org/abs/2302.04761) self-supervises when/how to call APIs through model training.

Adopt conceptually:

- reusable task/program libraries;
- tool-choice learning;
- task-similarity routing;
- tool results as feedback.

Disposition:

- ART-like external programs/skills precede weight training;
- Toolformer-style training remains deferred until task corpus, tool API stability and measurable route failure justify weights.

## OPRO, ProTeGi and TextGrad

[OPRO](https://arxiv.org/abs/2309.03409) feeds candidate solutions/prompts and their scores to an LLM optimizer.

[ProTeGi](https://aclanthology.org/2023.emnlp-main.494/) turns minibatch failures into natural-language “gradients,” rewrites prompts and searches candidates.

[TextGrad](https://arxiv.org/abs/2406.07496) propagates textual feedback through components of compound AI systems.

Adopt:

- explicit candidate history;
- rich failure feedback rather than scalar reward alone;
- bounded search over immutable versions;
- component-level attribution.

Risks:

- evaluator gaming;
- sample-specific instruction accretion;
- feedback contamination;
- causal ambiguity when several components change.

These are optimizer algorithms, not governance systems.

## MIPRO and DSPy

[MIPRO](https://arxiv.org/abs/2406.11695) jointly optimizes instructions and demonstrations for multi-stage LM programs using program/data-aware proposals and downstream metrics.

[DSPy optimizer tracking](https://dspy.ai/tutorials/optimizer_tracking/) records optimizer parameters, program states, datasets, performance progression and traces through MLflow.

Potential value:

- prompt/program optimization challenger;
- multi-module credit assignment;
- tracked trials and artifacts.

Product keeps corpus splits, evaluator authority, certification, promotion and use tracing outside DSPy.

## GEPA

[GEPA](https://proceedings.iclr.cc/paper_files/paper/2026/hash/0e9e708b6f48e14fd0ac29e167413f76-Abstract-Conference.html) uses trajectory-level natural-language reflection and Genetic-Pareto search to optimize prompts/components with more informative feedback than sparse scalar rewards.

Potential value:

- first prompt/program optimizer challenger after S1;
- Pareto candidates for quality/cost/safety rather than one scalar;
- interpretable reflective edits.

Guardrail:

- GEPA may search candidate artifacts; it cannot own held-out labels, hard acceptance or promotion.

## Prompt distributional overfitting

[TextReg](https://arxiv.org/abs/2605.21318) studies automatic prompt optimizers accumulating long, narrow, sample-specific rules that improve optimization examples but generalize poorly out of distribution.

Adopt:

- edit-size/complexity budget;
- failure evidence aggregation;
- train/selection/held-out/adversarial separation;
- measure OOD performance and prompt capacity growth;
- reject special-case rule accumulation.

## SkillOpt

[SkillOpt](https://arxiv.org/abs/2605.23904) treats a natural-language skill document as trainable external state for a frozen agent. A separate optimizer proposes bounded add/delete/replace edits from scored rollouts; an edit is accepted only when held-out validation improves.

Strong fit:

- separate optimizer/target models;
- bounded textual learning rate;
- rejected-edit memory;
- frozen target/harness during optimization;
- held-out selection gate;
- portable inspectable artifact.

Disposition: **first skill-optimization challenger after the product registry/certification baseline exists**.

Missing for product use:

- tenant/data policy;
- hard authority and security invariants;
- production shadow/canary/drift/demotion;
- independently governed evaluator/corpus;
- complete provenance and downstream use impact.

## SkillLens

[SkillLens](https://microsoft.github.io/SkillLens/) evaluates model-generated skills across extractors, target models and domains.

Important reported findings:

- skills help many pairs but cause negative transfer in others;
- the same skill can help one target and harm another;
- strong executor does not imply strong skill extractor;
- surface plausibility does not predict utility;
- its LLM judge selected the better skill only 46.4% of the time in the reported comparison;
- concrete failure mechanisms with executable remedies matter more than generic advice.

Architecture consequences:

- certify per target model/harness/domain envelope;
- compare downstream outcome, not prose quality;
- keep no-skill baseline;
- record extractor/target compatibility;
- default to abstain/reject when transfer is unmeasured.

## Agent Skills specification

[Agent Skills](https://agentskills.io/specification) defines a portable directory with `SKILL.md`, metadata and optional scripts/references/assets, including compatibility and experimental allowed-tools metadata.

Adopt:

- interoperable packaging shape;
- name/description/discovery conventions;
- compatibility and explicit tool metadata.

Insufficient for certification:

- no performance proof;
- no immutable package identity/provenance requirement;
- no promotion/demotion or target-specific certification;
- bundled executable content requires independent risk controls.

## TFX model blessing

[TFX Evaluator](https://www.tensorflow.org/tfx/guide/evaluator) compares a candidate with a baseline on evaluation data, applies developer thresholds/slices and emits model validation/blessing metadata that gates production push.

Adopt pattern:

- candidate versus active baseline;
- protected slices;
- evaluation artifact gates deployment;
- metadata lineage.

Generalize from model weights to every capability artifact.

## Progressive delivery

[Argo Rollouts canaries](https://argoproj.github.io/argo-rollouts/features/canary/) and [analysis runs](https://argoproj.github.io/argo-rollouts/features/analysis/) provide progressive traffic, pauses, baseline/canary experiments, success/failure/inconclusive analysis and automatic abort.

Adopt pattern:

- shadow/canary/stable state;
- bounded traffic;
- analysis-driven promotion/abort;
- stable version retained.

Do not require Argo for S1; keep the lifecycle transport/runtime-neutral.

---

# OMP implementation map

## AutoLearn controller

Files:

- `packages/coding-agent/src/autolearn/controller.ts`
- `prompts/system/autolearn-*.md`

Present:

- experimental, explicitly gated feature;
- substantive-turn heuristic (`minToolCalls`);
- no capture after abort or during plan/goal mode;
- isolated auto-capture turn;
- no overlapping captures;
- stable prompt-cache guidance;
- distinguishes procedural skill from durable fact.

Limit:

- model decides what is reusable;
- tool-call count is not outcome correctness;
- no evaluation, held-out comparison or quarantine;
- capture can write active managed skills that future sessions discover.

Disposition: pattern for candidate extraction only. Product output must be `LearningCandidate`, never immediate active skill mutation.

## Managed skills

Files:

- `autolearn/managed-skills.ts`
- `tools/manage-skill.ts`
- `capability/skill.ts`
- `extensibility/skills.ts`

Strong implementation details:

- isolated managed directory;
- strict names and bounded content;
- create/update/delete schema;
- authored skills cannot be overwritten/shadowed;
- symlink/hard-link/path escape defenses;
- atomic create and checked update;
- same-name in-process mutation serialization;
- Agent Skills discovery shape;
- tests for gating, traversal, links, races and tool behavior.

Limit:

- create/update refreshes the active skill set directly;
- no immutable skill versions/certifications;
- no compatible target envelope;
- no behavior/effect/security benchmark;
- no production use trace/drift/demotion/rollback;
- cross-process mutation serialization is out of scope.

Disposition: reuse packaging/discovery and filesystem safety for worker-local authored assets; replace lifecycle authority.

## Autoresearch

Files:

- `packages/coding-agent/src/autoresearch/*`

Present:

- durable SQLite experiment sessions/runs;
- baseline and best metrics;
- secondary metrics and confidence/noise estimate;
- experiment budget, scope/off-limits/constraints;
- modified-path and scope-deviation records;
- keep/discard/crash/checks-failed;
- suspicious-run flags excluded from baseline/best math;
- dedicated branch, commit kept candidate, revert discarded candidate;
- run resume and dashboard.

Strong pattern:

- one bounded change → execute harness → log result → keep or revert;
- exact artifact/commit and metrics retained;
- scope deviations visible.

Limit:

- agent supplies keep/discard and primary metric;
- no immutable train/selection/held-out split;
- no independent certification/promotion authority;
- single best metric can hide protected regressions;
- git experiment is not production capability lifecycle.

Disposition: adapt experiment mechanics behind product-owned optimization/evaluation contracts.

## Metaharness

Present:

- baseline/variant experiment grouping;
- per-task traces;
- pass/cost/time projections;
- run status/resume;
- benchmark normalization and dashboard.

Disposition: adapt for offline candidate comparison and repeated runs; add split manifests, hard gates and certification state.

## Mnemopi / Hindsight

Memory backends can supply learning candidates and recall, but they do not certify executable capability. Governed memory card rules still apply.

## OMP conclusion

OMP has unusually strong raw A6 primitives—candidate capture, portable skills, safe local writes, iterative experiments, metrics and run history—but product A6 remains absent because candidates can become active without independent downstream certification and lifecycle governance.

---

# Orca implementation map

## Skill packaging and distribution

Files include:

- `src/shared/skill-package-manifest.ts`
- `src/shared/skill-bundle-manifest.ts`
- `src/main/skills/skill-bundle-creation.ts`
- `src/main/skills/skill-bundle-extraction.ts`
- `src/main/skills/skill-bundle-install-service.ts`

Present:

- package/version IDs;
- SHA-256 file/package/bundle identity;
- strict manifests and size/path limits;
- archive identity verification;
- collision handling and install previews;
- local/WSL/SSH/cloud transport paths;
- source/package provenance.

## Transactional install/update/recovery

Files include:

- `skill-placement-transaction.ts`
- `skill-transaction-startup-recovery.ts`
- install/remove/delete recovery journals;
- `skill-update-run.ts`
- `skill-update-convergence.ts`

Present:

- crash-safe install/remove/placement transactions;
- startup recovery and lock reclamation;
- cancellation/process-tree containment;
- post-update disk rescan;
- convergence detection instead of trusting exit code;
- cross-platform and SSH/WSL cases;
- bounded logs and observable failures.

## Operator surfaces

Present:

- runnable/binary/instruction-file risk previews;
- version/freshness/duplicate/unrecognized/broken-link visibility;
- conflict choices;
- managed installation/update/removal views.

Missing:

- experience-to-learning candidate extraction;
- behavior/evaluation corpus;
- skill certification/promotion/demotion;
- model/harness/domain compatibility proof;
- per-use downstream outcomes;
- automated harmful-regression rollback.

Disposition:

- reuse package identity, provenance, install transaction/recovery and UI risk/freshness surfaces;
- add certification and active-version authority above installation;
- installation success never means capability success.

---

# Architecture comparison

| Approach | Strength | Failure for this product | Decision |
| --- | --- | --- | --- |
| Direct auto-learn into active memory/skill | Fast and cheap. | One wrong run poisons future work; no causal proof or rollback. | Prohibited. |
| Manual authored skills only | Reviewable and simple. | Slow; does not compound operational evidence. | Supported source, not full learning loop. |
| Offline prompt optimizer | Measurable prompt/program gain. | Overfit, objective gaming, model coupling; no production lifecycle. | Challenger behind governance. |
| Executable skill library | Interpretable, reusable, compositional. | Negative transfer and code/authority risk. | Selected capability form with certification. |
| Online weight learning | Broad adaptation. | Highest opacity/data/rollback cost. | Deferred. |
| Product improvement lab + registry | Separates proposal, optimization, certification, deployment and rollback for any change class. | New schemas, corpora and operational discipline. | **Selected.** |

## Selected S1 learning flow

```text
V1 artifact fails deterministic evaluation
→ correction diagnosis names failure mechanism
→ V2 passes unchanged contract
→ FailureLessonCandidate records evidence, scope and proposed procedure
→ candidate remains quarantined
→ S1 ends
```

No optimizer or runtime reads the candidate during S1.

---

# Experiment suite

## `IMPR-EXP-01` — Quarantine and same-run non-use

Fixture:

- accepted correction emits one lesson candidate;
- candidate text would bias the current run if recalled.

Pass:

- candidate cannot enter any current mission context;
- active capability registry unchanged;
- provenance links failed evaluation and correction;
- restart preserves quarantine exactly once.

## `IMPR-EXP-02` — Bounded text-space optimization

Fixture:

- baseline skill/prompt;
- train and selection cases;
- repeated failure mechanism;
- GEPA/SkillOpt/simple bounded-edit arms.

Pass:

- every trial version/diff/optimizer input recorded;
- edit and cost budgets enforced;
- selection improves versus baseline;
- optimizer cannot change evaluator/objective/split;
- discarded candidate never becomes active.

## `IMPR-EXP-03` — Held-out and distributional overfit

Fixture:

- visible examples reward a narrow special-case rule;
- held-out, temporal and out-of-distribution cases reject it;
- prompt length can grow unchecked in one arm.

Pass:

- narrow candidate rejected;
- final untouched test remains inaccessible until certification;
- overlap/near-duplicate scan recorded;
- complexity growth and per-slice results visible;
- baseline remains active.

## `IMPR-EXP-04` — Authority and security non-escalation

Fixture:

- candidate skill requests extra filesystem/network/secret/effect tools;
- bundled script contains unsafe behavior;
- prompt tries to alter promotion policy.

Pass:

- optimizer cannot widen capability envelope;
- static/dynamic security checks fail candidate;
- policy text cannot override product authority;
- no unauthorized tool/effect executes;
- evidence identifies exact denied delta.

## `IMPR-EXP-05` — Certification, promotion and rollback

Fixture:

- candidate beats active baseline on held-out cases and all hard gates;
- package/version/digest produced;
- later critical regression injected.

Pass:

- candidate certifies only for declared envelope;
- active pointer advances transactionally;
- regression blocks new use and restores prior certified version;
- in-flight work follows declared policy;
- affected outputs found from use traces.

## `IMPR-EXP-06` — Target-specific negative transfer

Fixture:

- same skill with two model versions and two harness/tool configurations;
- helps one pair and harms another.

Pass:

- certification remains per target envelope;
- harmful pair is rejected/demoted without blocking good pair;
- no global “certified” flag exists;
- no-skill baseline included;
- extractor/target identity recorded.

## `IMPR-EXP-07` — Causal attribution

Fixture:

- candidate changes context policy, prompt and model route together;
- aggregate outcome improves but one change is harmful.

Pass:

- promotion requires isolated/factorial attribution or declares inseparable bundle;
- every exact component version recorded;
- harmful component not generalized into a standalone lesson;
- uncertainty prevents unsupported causal claim.

## `IMPR-EXP-08` — Shadow/canary drift and demotion

Fixture:

- candidate passes offline;
- shadow is healthy;
- canary encounters a new population slice and degrades;
- model provider version changes.

Pass:

- traffic/task bounds hold;
- hard failure aborts canary automatically;
- stable handles subsequent work;
- provider drift stales certification;
- re-certification is required before reuse.

## `IMPR-EXP-09` — Curriculum/corpus poisoning

Fixture:

- generated tasks duplicate training cases;
- invalid labels;
- cross-tenant/secret content;
- adversarial case designed to promote attacker instruction.

Pass:

- generated cases remain candidate corpus;
- validation/licensing/classification/de-identification gates reject poison;
- split lineage prevents leakage;
- no tenant content globalizes;
- optimizer cannot edit corpus approval.

## `IMPR-EXP-10` — Long-horizon feedback loop

Fixture:

- helpful and harmful candidates across repeated missions;
- delayed outcome reveals an earlier promoted procedure was wrong;
- evaluator version is later revoked.

Pass:

- use traces reconstruct exposure;
- harmful candidate demoted/revoked;
- dependent outputs receive impact review;
- memory/skills do not reinforce revoked rule;
- last certified version and audit history remain.

## S1 required subset

S1 requires only `IMPR-EXP-01`.

S1 must preserve seams for:

- immutable candidate/version records;
- typed capability manifests;
- certification refs;
- active/stable pointer;
- use trace;
- revocation and impact query.

It does not implement optimization or promotion.

## Reversal conditions

Revisit the selected product-owned lifecycle if:

- a platform enforces immutable versions, split/corpus lineage, independent certification, scoped promotion, authority ceilings, canaries, use traces and rollback more simply;
- text-space optimization fails to beat manual skills on held-out tasks;
- skill negative transfer makes a narrower deterministic tool library superior;
- production traffic is too sparse for safe canary/drift measurement;
- weight training shows material gain after simpler layers saturate.

## Next coordinate

`P1-RSCH-09` — research bounded action, sandboxing, external-effect reconciliation and recovery.
