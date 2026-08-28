# Slice S1 Implementation and Evaluation Contract

## Coordinate

`P1-RSCH-15` — freeze the first integrated agentic-substrate slice.

## Selection

**Selected: Slice S1 — Evidence-correcting mission loop.**

S1 is the smallest vertical slice that proves the missing product center while reusing mature edges:

```text
product durable state
+ explicit conflicting evidence/gap
+ replaceable apex
+ two product-owned specialist assignments through OMP
+ exact context manifests/citations
+ deterministic probe
+ versioned decision/artifact
+ independent deterministic evaluator
+ fixed-contract correction
+ quarantined learning candidate
+ crash/restart/replay
```

S1 intentionally does not migrate data or execute a customer target effect.

## Why this slice

Smaller alternatives fail to prove the system:

- durable state alone does not prove evidence-seeking/adaptive reasoning;
- OMP integration alone does not prove product authority;
- retrieval alone does not prove contradiction/gap handling;
- artifact generation alone does not prove correctness;
- evaluator alone does not prove correction;
- memory capture alone risks learning from unverified output.

Larger alternatives hide substrate faults behind connectors, CDC, cloud credentials, domain semantics and external-effect complexity.

## Scope lock

S1 includes:

- A0 product worker adapter at isolated proof;
- A1 exact context/session reconstruction;
- A2 minimal durable mission kernel;
- A3 one apex and two specialist assignments;
- A4 minimal epistemic ledger/context compiler;
- A5 one deterministic evaluator and correction loop;
- A6 one quarantined candidate with no recall;
- A7 worker authority/tool restriction seams only;
- A8 one integrated repeatable run.

S1 excludes every item in `docs/agentic-substrate-s1-deferred-register.md` unless formally promoted through its trigger procedure.

Phase 2 implemented `prototype/migration-control-plane/` as an independent Node 24+/strict TypeScript lab with deterministic runtime/fault/artifact primitives, the frozen S1 fixture, a native deterministic evaluator baseline, and a one-command runner. This does not select the final production service language.

---

# Synthetic fixture

## Mission objective

```text
Produce a source-to-target patient identity mapping manifest whose source key
is stable and unique for every synthetic legacy row, explain the evidence,
and correct any independently detected critical defect.
```

This is a technical identity-key fixture, not a clinical/claims semantic capability pack.

## Evidence artifact A — `customer-architecture.md`

Synthetic customer document, exact assertion:

```text
legacy_patient.patient_num is the global, non-null patient identifier.
Use patient_num as the source key in downstream mappings.
```

Metadata:

- role: customer-supplied design claim;
- freshness: deliberately older than observed profile;
- trust: relevant but unverified;
- expected assertion: `patient_num` is globally unique.

## Evidence artifact B — `observed-key-profile.json`

Synthetic read-only source observation:

```json
{
  "entity": "legacy_patient",
  "rowCount": 6,
  "columns": ["facility_id", "patient_num"],
  "candidateKeys": [
    {
      "columns": ["patient_num"],
      "distinctCount": 5,
      "nullCount": 0,
      "duplicates": [
        { "patient_num": "P-100", "facility_ids": ["FAC-A", "FAC-B"] }
      ]
    },
    {
      "columns": ["facility_id", "patient_num"],
      "distinctCount": 6,
      "nullCount": 0,
      "duplicates": []
    }
  ]
}
```

Metadata:

- role: direct synthetic observation;
- freshness: current fixture revision;
- expected assertion: `patient_num` alone is not globally unique; composite key is unique.

## Output artifact contract — `identity-mapping.json`

```json
{
  "schemaVersion": 1,
  "sourceEntity": "legacy_patient",
  "targetEntity": "patient",
  "sourceKey": ["facility_id", "patient_num"],
  "evidenceRefs": ["..."],
  "decisionRef": "..."
}
```

Required fields are exact. Optional explanatory metadata is allowed and does not affect the evaluator.

## Seeded critical mutation

Mutation ID: `S1-MUT-KEY-001`.

Operation:

```text
remove "facility_id" from sourceKey
```

Mutated V1:

```json
"sourceKey": ["patient_num"]
```

Purpose: simulate a generator that follows the plausible but stale customer document instead of the accepted current finding/decision.

The mutation is applied by the deterministic lab harness after the first valid proposal. It does not depend on convincing a model to make a specific mistake.

## Benign mutation

Mutation ID: `S1-MUT-BENIGN-001`.

Operation:

- add an optional `description` field;
- vary JSON whitespace/object formatting without changing required values.

Purpose: prove the evaluator detects the critical semantic key defect without rejecting irrelevant formatting/metadata.

---

# Product roles and assignments

## Apex assignment

Role: `s1-apex`.

Inputs:

- mission snapshot/base version;
- current epistemic state/gaps;
- assignment/result/evaluation summary;
- exact context manifest;
- no direct product database or external-effect authority.

Outputs:

- one typed next action or `PlanDelta`;
- proposed assertion/gap/probe/decision/artifact relationships;
- evidence refs and rationale;
- no authoritative status mutation.

Lifecycle:

- replaceable between turns;
- reconstruction from product state only;
- hidden session history cannot be required for correctness.

## Specialist assignment 1 — document analyst

Role: `s1-document-analyst`.

Owned scope:

- extract assertions from artifact A.

Read scope:

- artifact A only plus output schema/role instructions.

Tools:

- product-hosted read-only evidence read;
- strict result submission.

Output:

```text
assertion: patient_num is globally unique
polarity: supports
source/span/citation
limitations: customer design claim; not independently observed
```

It cannot:

- read artifact B;
- accept a finding;
- mutate artifact/product state;
- spawn product assignments;
- execute effects.

## Specialist assignment 2 — profile and artifact engineer

Role: `s1-profile-artifact-engineer`.

Owned scope:

- analyze artifact B;
- request/run the deterministic key-profile probe;
- propose `identity-mapping.json`;
- respond to one bounded `CorrectionRequest` as a new attempt/version.

Read scope:

- artifact B;
- accepted finding/decision after the apex/reconciler commits them;
- V1 + failed measures for correction;
- exact output schema.

Tools:

- read-only evidence read;
- deterministic `check_candidate_key` probe;
- isolated artifact write;
- strict result submission.

It cannot:

- set acceptance;
- change evaluator/threshold;
- read hidden labels beyond its failed measures;
- create/activate memory/skills;
- execute external effects.

## Assignment count invariant

S1 has:

- one apex assignment identity with replaceable attempts;
- two product-owned specialist assignment identities;
- specialist assignment 2 may receive a correction attempt under the same owned scope;
- OMP nested subagents, if enabled for diagnostics, remain worker-local micro-work and do not create product assignments.

---

# Deterministic probe

Tool: `check_candidate_key`.

Input:

```text
evidence_item_id
candidate columns[]
expected evidence digest
```

Output:

```text
row_count
distinct_count
null_count
duplicate examples (bounded)
unique: boolean
source/digest/timestamp
```

S1 implementation reads the synthetic profile fixture; it does not connect to a database.

Acceptance:

- composite candidate returns `6/6`, zero nulls, no duplicates;
- single column returns `5/6` and the bounded duplicate example;
- exact input/evidence digest is recorded;
- denied/missing input becomes unavailable evidence, not absence/uniqueness.

---

# Epistemic records

S1 implements the minimum complete lifecycle:

1. `EvidenceItem(A)` — immutable customer document body/digest/span.
2. `EvidenceItem(B)` — immutable observed profile body/digest.
3. `Proposition(P1)` — `patient_num` is globally unique for `legacy_patient`.
4. `Assertion(A1)` — artifact A supports P1.
5. `Assertion(A2)` — artifact B refutes P1.
6. `Proposition(P2)` — `(facility_id, patient_num)` is globally unique.
7. `Assertion(A3)` — artifact B/probe supports P2.
8. `ContradictionSet(C1)` — P1 support conflicts with observed refutation.
9. `Gap(G1)` — stable source identity key unresolved; blocks mapping decision.
10. `ProbeCandidate(PR1)` — deterministic candidate-key check.
11. `AcceptedFinding(F1)` — P1 rejected for current fixture; P2 accepted with scope/freshness/coverage.
12. `ImpactReview` — identifies mapping decision/artifact as dependent.

Rules:

- source document claim never becomes fact by wording;
- observation denial/error is not absence;
- contradiction is not averaged into confidence;
- accepted finding cites exact assertions/evidence/probe;
- changed evidence would invalidate F1 and reopen impact.

---

# Decision and plan records

## `DecisionRecord D1`

```text
question: source identity key
options:
- patient_num
- facility_id + patient_num
selected: facility_id + patient_num
evidence: F1, A2, A3, PR1 result
assumptions: synthetic profile covers fixture rows
impact: identity-mapping artifact
reversal: profile/schema changes or counterexample
```

## Plan revisions

Minimal immutable revisions:

- `R0`: investigate key claim;
- `R1`: add document/profile assignments in parallel;
- `R2`: add discriminating probe and block artifact acceptance;
- `R3`: commit decision and artifact proposal/evaluation;
- `R4`: failed measure adds correction attempt;
- `R5`: V2 accepted; mission slice terminal.

Each revision references its base. Stale revisions are rejected; accepted history is never edited in place.

---

# Artifact versions

## V1

- starts from a schema-valid proposal;
- deterministic mutation `S1-MUT-KEY-001` removes `facility_id`;
- immutable digest recorded;
- status: `evaluating` then `rejected`;
- never overwritten.

## V2

- produced by specialist assignment 2 correction attempt;
- includes both composite columns and exact evidence/decision refs;
- immutable new digest/version;
- status: `evaluating` then `accepted` if all measures pass.

No alias or in-place mutation from V1 to V2.

---

# Evaluation contract

## Evaluator definition

```text
id: s1-identity-key-evaluator
version: 1
kind: deterministic
implementation digest: pinned by run manifest
supported subject: identity-mapping/schemaVersion=1
calibration corpus: S1 critical + benign mutations
independence: separate process/module; read-only product/evidence state; no producer verdict input
```

The evaluator is not an LLM and does not read hidden producer reasoning.

## Contract

```text
id: s1-identity-mapping-acceptance
version: 1
composition: ALL hard measures
correction budget: 2 attempts for same failure class
stale on: subject/evidence/decision/evaluator/contract version change
```

## Measures

### `schema_valid`

Pass:

- exact schema version/entity/array/reference types;
- required fields present;
- no malformed/duplicate key column.

### `decision_alignment`

Pass:

- `sourceKey` equals selected columns in `DecisionRecord D1` in declared order;
- `decisionRef` is D1;
- required evidence refs include F1/probe evidence lineage.

### `source_key_complete`

Pass:

- selected columns exist in artifact B schema/profile.

### `source_key_non_null`

Pass:

- profile `nullCount == 0` for candidate key.

### `source_key_unique`

Pass:

```text
distinctCount == rowCount == 6
and duplicates == []
```

### `evidence_reconstructable`

Pass:

- every referenced evidence/finding/decision/artifact digest resolves;
- exact evaluator inputs can be reloaded from run bundle.

## V1 expected result

```text
schema_valid: pass
decision_alignment: fail
source_key_complete: pass
source_key_non_null: pass
source_key_unique: fail (5/6; P-100 duplicate)
evidence_reconstructable: pass
verdict: failed
```

## V2 expected result

All six measures pass; verdict `passed`.

## Benign mutation expected result

All six measures remain passed.

## Hard rules

- producer cannot set verdict;
- no score averaging;
- one hard failure prevents acceptance;
- evaluator unavailable/error/stale leaves artifact unaccepted;
- threshold cannot change during correction;
- changed evaluator/contract requires a separately recorded version decision and rerun.

---

# Correction contract

V1 failure creates:

- attributed `Gap G2`: artifact key omitted decision-required facility scope;
- `CorrectionRequest CR1`:
  - subject V1/digest;
  - failed measures/evidence;
  - allowed mutation: `sourceKey`, evidence/decision refs only;
  - unchanged evaluator/contract/version;
  - required new subject version;
  - remaining budget.

Specialist assignment 2 correction attempt receives only:

- V1;
- D1/F1/probe evidence;
- failed measures/failure codes;
- schema;
- allowed scope/budget.

It produces V2 plus an exact delta.

No generic “try again” prompt and no threshold/evaluator mutation.

Repeated same failure without new evidence after budget creates quarantine/capability gap and stops; it does not loop forever.

---

# Learning candidate

After V2 passes and is accepted, create exactly one:

```text
kind: FailureLessonCandidate
status: quarantined
source: V1 failed EvaluationResult + CR1 + V2 accepted result
proposed lesson: customer-declared identifiers require observed scope/uniqueness verification before mapping acceptance
scope: synthetic identity-mapping tasks only
tenant: S1 synthetic tenant
validation: not run
use policy: none
active capability: false
```

Invariants:

- candidate is created after acceptance, never from V1 alone;
- cannot enter any S1 context manifest;
- cannot create/update an OMP managed skill;
- cannot be promoted/consolidated/recalled;
- restart/replay creates one logical candidate;
- active memory/skill set is unchanged.

---

# Minimal durable records

S1 needs versioned schemas for:

- `Mission` / `MissionEvent` / current projection;
- `EvidenceItem` / `Proposition` / `Assertion`;
- `ContradictionSet` / `Gap` / `ProbeResult` / `AcceptedFinding` / `ImpactReview`;
- `DecisionRecord` / `PlanRevision`;
- `Assignment` / `AssignmentAttempt` / lease/fence / `ContextManifest` / typed result;
- `ArtifactVersion`;
- `EvaluatorDefinition` / `EvaluationContract` / `EvaluationAssignment` / `EvaluationResult` / measures;
- `CorrectionRequest` / correction result;
- `LearningCandidate`;
- outbox/inbox/dedup records;
- run manifest/fault record.

S1 may omit physical effect/secret/target tables if compiled contracts preserve the future identifiers/status vocabulary without pretending an effect occurred.

`P3-KERN-01` implements these as 41 strict V1 Zod/runtime and Draft 2020-12 schemas in the isolated lab. Future effect/secret/target records compile as non-executable seams; physical tables and behavior remain deferred to their roadmap coordinates.

## Authority invariants

- expected mission/base versions on commands/plan changes;
- one current attempt/fence per assignment;
- worker output is proposal/evidence;
- only deterministic reconciler applies validated transitions;
- task/artifact acceptance requires current attempt and required passed evaluation;
- duplicate identical command/result replays;
- mismatched ID reuse rejects;
- stale result remains evidence only;
- no model process owns durable state.

---

# OMP worker contract

## Version

Baseline source/runtime target: OMP `18.0.6` / pinned commit `b4e8e856ad40294167679a3f88417c07429fe59b`.

Installed `18.0.4` is not assumed compatible. `WORKER-EXP-01` must either align the binary or record supported skew before S1 agent execution.

## Invocation

Every OMP assignment pins:

- assignment/attempt/fence IDs;
- role/system instructions;
- exact rendered context + manifest/digest;
- model/provider/version/effort;
- exact host tool schemas/versions;
- strict output schema/mode;
- token/time/tool/evidence/output budgets;
- workspace/artifact paths;
- data class/tenant;
- OMP executable/protocol fingerprint.

## Host tools

S1 exposes only:

- `evidence_read` — exact evidence IDs/spans/digests from manifest;
- `check_candidate_key` — deterministic fixture probe where role permits;
- `artifact_write` — isolated versioned candidate body for assignment 2;
- strict result/yield mechanism.

No:

- general Bash;
- network/web;
- arbitrary filesystem read/write;
- product database mutation;
- cloud/source/target credentials;
- memory/skill mutation;
- external effect.

## Result admission

Host validates:

- RPC/schema/protocol;
- assignment/attempt/fence current;
- artifact/evidence refs within owned/read scope;
- output size/digest;
- citations resolve to manifest spans;
- no authority-bearing fields.

Valid output still remains a proposal until reconciled/evaluated.

---

# Context manifest contract

For every apex/specialist/evaluator invocation record:

```text
tenant/mission/base version
role and owned/read scope
model/tool/skill/evaluator versions
source item IDs/versions/digests/spans/roles/freshness
retrieval queries/ranks
ordered rendered positions
exclusions and reasons
redactions
system/tool/output-schema digests
budget and strategy version
rendered context digest
```

S1 retrieval is exact structured/lexical lookup; no vector search.

Required checks:

- same state/policy/compiler inputs produce same non-model manifest;
- document analyst cannot read profile evidence;
- profile/artifact engineer sees only current allowed state;
- evaluator context is independent and read-only;
- learning candidate never appears;
- every used claim/citation resolves to included span/digest.

---

# Event sequence

Expected logical event sequence (retries may add attempts but not duplicate logical transitions):

```text
MissionCreated
EvidenceRecorded(A)
EvidenceRecorded(B)
PropositionRegistered(P1/P2)
GapOpened(G1)
PlanRevisionCommitted(R1)
AssignmentCreated(document)
AssignmentCreated(profile-artifact)
AssignmentResultAdmitted(document)
AssignmentResultAdmitted(profile-artifact)
ContradictionOpened(C1)
ProbeRequested(PR1)
ProbeResultRecorded
FindingAccepted(F1)
DecisionCommitted(D1)
ArtifactVersionRecorded(V1)
EvaluationRequested(V1)
EvaluationFailed(V1)
GapOpened(G2)
CorrectionRequested(CR1)
CorrectionAttemptStarted
ArtifactVersionRecorded(V2)
EvaluationRequested(V2)
EvaluationPassed(V2)
ArtifactAccepted(V2)
LearningCandidateQuarantined
MissionSliceCompleted
```

Every event includes tenant/mission/aggregate version/command correlation/time/actor/causation.

---

# Fault and replay matrix

Required named kill points:

1. after mission event before projection/outbox visibility;
2. after assignment outbox commit before dispatch;
3. after OMP starts before result;
4. after worker result before inbox commit;
5. after result ingest before epistemic transition;
6. after V1 artifact before evaluation assignment;
7. after failed evaluation before correction request;
8. after V2 artifact before evaluation pass ingest;
9. after evaluation pass before artifact acceptance;
10. after acceptance before learning candidate;
11. after learning candidate before terminal mission event;
12. OMP worker killed and reconstructed at each assignment attempt boundary.

Pass for every seed:

- no lost accepted state;
- no duplicate logical assignment/artifact/evaluation/candidate;
- one active attempt/fence;
- stale late result rejected from authority;
- outbox/inbox redelivery converges;
- projections rebuild identically from verified event position;
- nonterminal state gets deterministic retry/reconstruct/re-evaluate/quarantine disposition;
- model may produce a different valid proposal after restart, but committed history remains coherent.

---

# Run artifact and inspector

One S1 run ID must expose:

- run config/seed/environment/versions;
- fixture/license/checksums;
- event log and rebuilt projection checksum;
- evidence/assertions/contradictions/gaps/findings;
- plan/decision history;
- assignment/attempt/fence/context/tool/model/output records;
- OMP transcript/artifact refs;
- V1/V2/delta/digests;
- evaluation contracts/measures/verdicts;
- correction record;
- quarantined learning candidate;
- fault injections/recovery dispositions;
- usage/cost/time;
- final pass/fail predicates.

Initial surface may be CLI or minimal inspector. It must query canonical records, not parse logs to infer status.

---

# S1 acceptance predicates

S1 passes only when all are true:

1. Fixture checksums and seed are pinned.
2. Same seed yields the same non-model IDs/order/fault schedule.
3. Every used claim cites an included exact source span/digest.
4. Artifact A’s claim and artifact B’s refutation remain explicit.
5. No unsupported claim becomes an accepted finding.
6. The deterministic probe selects the composite key.
7. Decision D1 cites the probe/evidence and records reversal condition.
8. Critical mutation V1 fails exact measures.
9. Benign mutation passes.
10. Producer cannot set verdict or alter threshold/evaluator.
11. Correction creates V2; V1 remains immutable rejected history.
12. V2 passes the unchanged evaluation contract.
13. Only V2 becomes accepted.
14. Correction attempts are bounded; repeated failure quarantines.
15. Learning candidate is created exactly once after acceptance.
16. Learning candidate is never recalled/promoted/activated in S1.
17. No product authority is owned by OMP/Orca terminal/session state.
18. No external credential/effect is available.
19. Every required kill point converges without double advance.
20. Rebuilt projection equals live terminal projection.
21. One run ID reconstructs complete evidence/decision/evaluation/recovery history.

No partial aggregate score. Any failed predicate fails S1.

---

# Baselines and challengers

## Required no-agent baseline

A deterministic/manual script:

- reads both fixture artifacts;
- runs the same key probe;
- emits the correct mapping;
- runs the same evaluator.

Measure:

- wall time;
- code/config complexity;
- state transitions;
- evaluator outcome;
- reproducibility.

S1 does not need to beat the baseline on a six-row fixture. It must justify agentic machinery through explicit evidence/gap/correction/reconstruction behavior, not raw speed.

## DBOS challenger

Runs after the product-owned baseline contract exists. Same schema/events/fixture/faults; compare recovery code and operations.

## Inspect AI challenger

Runs after the native deterministic evaluator/harness exists. Same subject/mutations/measures; product acceptance remains outside Inspect.

Neither challenger blocks initial S1 baseline.

---

# Explicit non-goals

S1 will not implement:

- real source connector/query;
- snapshot/CDC/delete/schema evolution;
- healthcare semantic reasoning;
- vector retrieval/GraphRAG/graph database;
- semantic LLM judge/human expert workflow;
- memory recall/consolidation/backend selection;
- skill optimization/certification/promotion;
- cloud/Databricks/Snowflake target mutation;
- external-effect gateway/secret lease/sandbox provider;
- remote customer-zone relay;
- production identity/policy/Kubernetes/HA/DR;
- production operator console;
- real PHI/customer data;
- autonomous destructive action.

The complete authoritative list remains the S1 deferred register.

---

# Implementation sequence alignment

The roadmap remains phase-ordered:

1. `P2-LAB` creates location/runtime/fault/run-artifact/fixture/baseline/runner.
2. `P3-KERN` implements durable state/idempotency/events/projections/outbox/attempts/replay.
3. `P4-AGNT` integrates OMP worker/apex/specialists/disagreement/reconstruction.
4. `P5-KNOW` implements minimal evidence/epistemic/context/candidate-memory records.
5. `P7-EVAL` implements evaluator/correction/candidate creation.
6. S1 integrated proof assembles these exact contracts before external execution.

Phase work may prove S1 subcontracts incrementally; the slice passes only as one end-to-end run.

## Scope-change rule

Any proposed S1 addition must state:

- which acceptance predicate requires it;
- why an existing component/fixture cannot prove that predicate;
- deferred item affected;
- experiment threshold;
- schedule/dependency impact.

Otherwise it remains deferred.

---

# P1-RSCH-15 conclusion

S1 is approved without expansion.

It proves the central claim:

```text
A durable product mission can use replaceable OMP workers to seek evidence,
preserve contradiction, make a versioned decision, reject a critical artifact,
correct it under an unchanged independent evaluator, quarantine the lesson,
and recover from crashes without duplicating accepted state.
```

## Next coordinate

`P4-AGNT-01` — implement the bounded agent-gateway process supervisor over the completed durable kernel.
