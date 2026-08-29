# Migration Control Kernel V1 Domain Contracts

## Coordinate

`P3-KERN-01` — define compiling versioned domain contracts before persistence.

## Outcome

Implemented one strict V1 runtime/schema registry in:

```text
prototype/migration-control-plane/src/domain/
prototype/migration-control-plane/schemas/v1/
```

Registry:

- 41 top-level Zod 4.4.3 runtime schemas;
- 41 deterministic Draft 2020-12 JSON Schemas;
- strict unknown-field rejection;
- explicit `schemaVersion: 1` and `kind` discriminants;
- prefixed opaque IDs and bounded arrays/text/JSON/content references;
- cross-field runtime invariants;
- same-tenant/same-mission/unique-ID record-set admission;
- deterministic generated manifest and SHA-256 registry digest.

Current registry digest:

```text
c625dd7c6ea4d45dfb98d477959681f85bea23c314ef23e2237ce615c3948164
```

No database tables, migration, command handler, event append, projection, outbox, lease, or reconciler is implemented in this coordinate.

## Dependency decision

Added one exact runtime dependency to the isolated prototype:

```text
zod 4.4.3
```

Reason:

- Orca already uses strict Zod contracts at persisted/RPC boundaries;
- TypeScript-only interfaces cannot reject untrusted persisted/worker/evaluator/adapter data;
- hand-written validators across 41 records would create a second convention and unreviewable drift;
- Zod 4 exports Draft 2020-12 JSON Schema from the same source definition.

No dependency was added to Orca root. The prototype remains independently installed and locked.

`P3-KERN-02` subsequently adds exact `pg 8.23.0` plus development-only `@types/pg 8.23.1`. Direct parameterized SQL and explicit transactions preserve the PostgreSQL contract without an ORM or migration framework. PostgreSQL 16 is the kernel baseline; the driver supports Node 16+, is MIT licensed, and remains isolated from Orca root.

---

# Compatibility rules

## Versioning

- Every top-level record has `schemaVersion: 1` as a literal.
- Every top-level record has a fixed `kind` discriminant.
- V1 schemas reject `schemaVersion: 2` rather than guessing forward compatibility.
- Future V2 support must add a new named schema and explicit migration; no aliases or permissive passthrough.
- Registry names are stable `<record-name>.v1` identifiers.
- Generated files use the same registry name and stable URN `$id`.

## Strictness

- All top-level and nested objects are `.strict()` unless the value is intentionally arbitrary JSON.
- Unknown top-level fields are rejected for all 41 records.
- Arbitrary JSON appears only in named payload/state/parameter/value fields.
- Command/event arbitrary payloads carry an exact schema name/version/digest and payload digest.
- JSON Schema files set `additionalProperties: false` at every strict object boundary.

## Identity

- IDs are lower-case, prefix-specific, bounded to 128 characters, and branded in TypeScript.
- Tenant and mission IDs are present on mission-scoped records.
- Tenant-scoped registries—evaluators, evaluation contracts, capabilities, certifications, promotions, drift—do not pretend to belong to one mission.
- `validateMissionContractSet` rejects duplicate record IDs, tenant mismatch, and mission mismatch after runtime parsing.
- Referential existence and aggregate-version enforcement remain persistence/reconciler responsibilities beginning in P3-KERN-02/04.

## Authority

- Model/worker output schemas describe proposals/evidence, never acceptance authority.
- Task completion requires an accepted assignment result.
- Accepted artifacts require evaluation results.
- Passed evaluation requires complete coverage and only passing measures.
- Correction preserves logical subject identity/schema and advances version/digest.
- Quarantined learning/capability state does not require or imply certification.
- Certified learning cannot expand authority.
- Process exit, receipt presence, or compensation never implies target acceptance.

## Time and lineage

- Timestamps are ISO datetimes with offsets.
- Evidence/proposition validity windows, mission/attempt/probe/lease/capability/drift lifetimes, and artifact/capability predecessor rules are validated.
- First artifact/capability/plan versions cannot claim predecessors.
- Later versions require predecessors/base revisions.
- Self-dependency, self-supersession, self-compensation, and non-advancing correction are rejected.

---

# Schema inventory

## Mission authority — 3

- `mission-record.v1`
- `mission-command.v1`
- `mission-event.v1`

Covers mission state, expected revision, typed payload reference/digest, actor, causation, correlation, and aggregate revision.

## Epistemic state — 9

- `evidence-item.v1`
- `proposition.v1`
- `assertion.v1`
- `contradiction-set.v1`
- `gap.v1`
- `probe-request.v1`
- `probe-result.v1`
- `accepted-finding.v1`
- `impact-review.v1`

Preserves source role/content/scope/time, support/refute/direct/derived semantics, explicit contradiction/gap state, denied/unavailable/error probes, accepted evidence lineage, and dependent impact.

## Decisions and plans — 2

- `decision-record.v1`
- `plan-revision.v1`

Plan operations cover add/split/merge/dependency/block/unblock/cancel/quarantine/supersede with base mission/plan revision and proof/recovery contracts.

## Tasks, assignments, attempts, context, results — 5

- `task-record.v1`
- `assignment-record.v1`
- `assignment-attempt.v1`
- `context-manifest.v1`
- `assignment-result.v1`

Covers task DAG refs/state/proof/evaluator/recovery, owned/read scope, exact tools/model/output contract, attempts/fences/leases/process identity, ordered manifest items/exclusions/redactions/digests, and proposal results/usage.

## Artifacts — 1

- `artifact-version.v1`

Immutable logical artifact lineage with producer assignment/attempt/fence, content digest, decisions/evidence, and proposed/evaluating/accepted/rejected/quarantined state.

## Evaluation and correction — 13

- `evaluator-definition.v1`
- `evaluator-definition.v2`
- `evaluation-contract.v1`
- `evaluation-contract.v2`
- `evaluation-coordination.v1`
- `evaluation-assignment.v1`
- `evaluation-assignment.v2`
- `deterministic-evaluator-suite.v1`
- `evaluation-deterministic-report.v1`
- `evaluation-result.v1`
- `evaluation-result.v2`
- `correction-request.v1`
- `correction-result.v1`

Frozen V1 history covers the original kernel seam. V2 adds immutable predecessor/digest lineage, exact implementation and subject/input schema versions, observed independence, measure/operator/threshold/evidence identity, budgets/deadlines and literal non-authority. Coordination snapshots add assignment/outbox identity, deadline-aware missing state, typed disagreement/unresolved reasons, unrelated-work continuation and reconciliation-only eligibility. Deterministic suite/report records pin five side-effect-free checks and their immutable typed execution evidence.

## Learning lifecycle — 6

- `learning-candidate.v1`
- `capability-manifest.v1`
- `certification-result.v1`
- `promotion-decision.v1`
- `capability-use.v1`
- `drift-signal.v1`

Covers quarantine/offline/certification/rejection/revocation, target envelope, artifact/contract/tools/data/authority, protected slices, shadow/canary/active decision, exact use/outcome, and drift action.

## Future effect seam — 9

- `effect-intent.v1`
- `policy-decision.v1`
- `secret-lease.v1`
- `capability-envelope.v1`
- `effect-attempt.v1`
- `effect-receipt.v1`
- `target-observation.v1`
- `recovery-disposition.v1`
- `compensation.v1`

Covers exact target/adapter/parameters/idempotency, grant/deny/exception, secret references only, assignment/attempt/fence-bound authority, request journal, applied/absent/failed/unknown/reconciling/evaluating/accepted/rejected state, independent target readback, safe retry proof, and partial compensation limits.

---

# Runtime versus JSON Schema

Generated JSON Schemas provide portable structural validation:

- V1/kind constants;
- required fields;
- strict additional properties;
- types/enums/patterns/ranges/array limits;
- recursive JSON payload definitions;
- stable `$id` and Orca contract metadata.

Zod runtime parsing additionally enforces invariants JSON Schema cannot fully express here:

- equal IDs/digests;
- temporal ordering;
- unique option/measure/context positions;
- selected option membership;
- predecessor/base requirements;
- direct versus derived assertion rules;
- passed/failed verdict consistency;
- correction identity/version/digest;
- authority non-expansion;
- idempotency/policy/lease/recovery constraints.

Every generated schema carries:

```json
{
  "x-orca-contract": {
    "registryVersion": 1,
    "schemaName": "...",
    "runtimeInvariantValidationRequired": true
  }
}
```

External consumers may use JSON Schema for structural admission, but authoritative product ingestion must run the Zod/runtime invariant layer or an equivalent implementation proven against the same tests.

---

# Registry and generation commands

```text
node scripts/migration-control-plane-lab.mjs contracts generate
node scripts/migration-control-plane-lab.mjs contracts check
node scripts/migration-control-plane-lab.mjs database migrate
node scripts/migration-control-plane-lab.mjs database fingerprint
node scripts/migration-control-plane-lab.mjs database verify
node scripts/migration-control-plane-lab.mjs experiment run --experiment DUR-EXP-01 --seed 103 --arm baseline --fault none --output .runs/durable-final
node scripts/migration-control-plane-lab.mjs verify
```

`contracts generate` builds the lab and writes canonical-key-ordered, Oxfmt-stable schema bytes plus `schemas/v1/manifest.json`.

`contracts check` fails on missing, extra, or byte-stale schema files.

`database migrate` applies five forward-only SQL migrations under a PostgreSQL advisory lock, validates all previously recorded names/checksums, and records each migration inside its own transaction.

`database fingerprint` hashes deterministic catalog structure—including functions/triggers—applied migration checksums, kernel metadata, and the 41 contract-schema rows.

`database verify` requires `MIGRATION_CONTROL_DATABASE_URL` and runs the real PostgreSQL integration suite.

`verify` now runs:

1. formatting;
2. lint;
3. strict TypeScript;
4. all tests;
5. build;
6. generated contract drift check.

## Verification evidence

- 41/41 canonical record samples parse.
- 41/41 reject unknown top-level fields.
- 41/41 reject `schemaVersion: 2`.
- 41/41 export parseable strict Draft 2020-12 schemas with stable IDs.
- Full tenant/mission record set admits once and rejects duplicate IDs/cross-tenant/cross-mission data.
- 18 targeted invariant tests cover mission, epistemic, planning, assignment, artifact, evaluation/correction, learning, and effect failure paths.
- Complete lab verification: 10 test files / 57 tests, formatting, lint, typecheck, build, and 41-file schema drift check pass.

## P3-KERN-02 persistence evidence

- PostgreSQL 16.15 exercised locally; PR CI uses the pinned `postgres:16.15-alpine` service.
- Three contiguous, transactionally applied migrations create 16 constrained/indexed tables.
- The contract table binds all 41 V1 schema names, URNs, and generated file digests.
- Empty and migration-001 upgrade paths converge byte-for-byte at the catalog snapshot layer.
- P3-KERN-02 schema-v3 fingerprint: `48406f183d566eeb66ec2f21d7ba1009d8a89e203be20c0ea6d614918d82b74b`.
- Reapplication is inert, concurrent migrators serialize, and altered or gapped applied history is rejected.
- PostgreSQL integration verification: 1 file / 4 tests; cross-platform lab verification remains 8 files / 46 tests.

## P3-KERN-03 through P3-KERN-06 atomic persistence evidence

- Canonical full-command SHA-256 identity—not only payload identity—is reserved under `(tenant_id, command_id)`.
- Identical sequential/concurrent retries execute one handler and replay the exact committed or rejected result; mismatched payload or actor reuse fails.
- Unknown handler failure rolls the reservation back; deterministic rejection rolls handler writes to a savepoint and commits the rejection.
- Per-mission advisory and row locks enforce expected revision; one concurrent transition wins and one becomes a durable `version_conflict`.
- Aggregate, append-only event, current mission projection, outbox message, and command outcome share one transaction.
- Outbox failure and projection-position conflict tests prove no partial event/aggregate/projection state.
- `FOR UPDATE SKIP LOCKED` outbox claims carry expiring leases and monotonic fences; stale acknowledgement fails, retry reclaims, and duplicate acknowledgement replays.
- Inbox import serializes by tenant/consumer/message, executes its handler once, replays one result, rejects payload mismatch, and rolls back handler failure.
- PostgreSQL integration verification: 4 files / 19 tests.

## P3-KERN-07 through P3-KERN-10 lifecycle authority evidence

- Materialized plan validation binds mission/plan bases, task operations, full dependency existence, acyclicity, output-contract compatibility, and one recovery rule per edge.
- Task state transitions require immutable identity, one revision advance, allowed source/target state, and the current attempt/fence whenever active.
- Attempt state transitions preserve immutable invocation identity and fence through claimed/running/result/evaluating/terminal states.
- Concurrent task claims admit one attempt, increment one monotonic fence, and atomically bind task/attempt projections.
- Rival or lease-expired attempt output cannot mutate the task or authoritative attempt.
- Migration 004 adds dedicated effect-attempt authority, corrects the current-attempt foreign key, and admits explicit `reconciling`.
- Effect transitions preserve immutable attempt/fence identity, parameter digest, receipt identity, target observations, and evaluation receipt lineage through accepted/rejected state.
- P3-KERN-10 schema-v4: 4 migrations / 17 tables / fingerprint `97a92746b9eb9b4fa014436c8829b4c0f4081ef2496c29ed00bf225d2a1efd4b`.
- Verification at P3-KERN-10: 10 unit files / 57 tests and 6 PostgreSQL files / 25 tests.

## P3-KERN-11 through P3-KERN-13 convergence evidence

- Every appended event carries the exact post-transition mission projection and separate full-event/payload SHA-256 digests.
- Migration 005 installs an append-only statement trigger that rejects event update, delete, and truncate.
- Rebuild verifies contiguous positions, event identity, full-event digest, payload digest, and embedded projection identity before atomically replacing aggregate/domain/current views.
- Dropped/corrupted views rebuild to the original projection digest; event tamper and position gaps fail.
- Restart scans all nonterminal task/attempt/effect/outbox rows and idempotently upserts one deterministic recovery disposition; active leases defer rather than imply worker death.
- Task completion with `requiresEvaluation` requires persisted passing results that cover every contract and trace to the current attempt/fence and accepted assignment result.
- Current schema: 5 migrations / 17 tables / fingerprint `15aca9dc2ee49e138bd997e2ee076ef779a6e6ec5932a173bc988cd807d9a56c`.
- Verification: 10 unit files / 57 tests and 9 PostgreSQL files / 33 tests.
- `DUR-EXP-01` passes three integration seeds plus sealed CLI seed 103; all seven duplicate/crash/stale/replay/atomic/terminal/restart measures pass and the artifact SHA-256 index verifies.

---

# Intentional limits

- Phase 3 contracts, five migrations, atomic persistence/delivery, DAG/lifecycle/effect authority, exact replay, restart dispositions, and convergence experiment now exist.
- No external adapter call is executable; effect records prove state semantics without granting production authority.
- Command-specific application handlers beyond the generic mission transition arrive with their domain coordinates.
- Memory and skill capability records now have immutable quarantine/validation/use/invalidation/lifecycle contracts; automated production skill promotion, drift, canary, and rollback remain future `P7-EVAL` work.
- `WORKER-EXP-01` now passes through a digest-verified real pinned OMP `EXP-10` report; production model/provider behavior remains outside this synthetic containment proof.

## `P7-EVAL-01` evidence

Four V2 records, registry reconstruction, migration 012 and the task-completion gate bind the accepted output to exact evaluator, contract, subject, input, measure, threshold, evidence, attempt and fence identities. Registry 75; fingerprint `c82229f9…1d9e782d`; 35 unit files / 188 tests and 19 PostgreSQL files / 54 tests.

## `P7-EVAL-02` evidence

Product-owned dispatch creates one derived-independent V2 assignment and durable outbox message per required evaluator. Immutable coordination versions preserve every result disposition without majority vote or acceptance authority; advisory-locked replay, fresh-pool reconstruction and unrelated branch progress pass. Registry 76; fingerprint `cd7f8c60…d612e3a8`; 36 unit files / 194 tests and 20 PostgreSQL files / 55 tests.

## `P7-EVAL-03` evidence

A required suite input drives five hard structural/type/lineage/compatibility/policy checks and emits one immutable report/evidence/result set. Critical mutations fail exact measures, property reorder is byte-identical, late work is stale, and claim release/redelivery replays one stored result before current-fence acknowledgment. Registry 78; fingerprint `5561a9ce…1c3e5fe`; 37 unit files / 201 tests and 21 PostgreSQL files / 56 tests.

## Next coordinate

`P7-EVAL-04` — execute deterministic data-movement reconciliation checks.
