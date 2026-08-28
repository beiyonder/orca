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

## Evaluation and correction — 6

- `evaluator-definition.v1`
- `evaluation-contract.v1`
- `evaluation-assignment.v1`
- `evaluation-result.v1`
- `correction-request.v1`
- `correction-result.v1`

Covers implementation/calibration/independence, hard measure definitions/composition, exact subject/context/producer/fence, complete verdict state, bounded allowed mutations, and unchanged acceptance-contract identity.

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
node scripts/migration-control-plane-lab.mjs verify
```

`contracts generate` builds the lab and writes canonical-key-ordered, Oxfmt-stable schema bytes plus `schemas/v1/manifest.json`.

`contracts check` fails on missing, extra, or byte-stale schema files.

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
- Complete lab verification: 8 test files / 46 tests, formatting, lint, typecheck, build, and 41-file schema drift check pass.

---

# Intentional limits

- No database or migration exists yet.
- Cross-record referential integrity beyond tenant/mission/ID uniqueness is not claimed; repositories and transactions enforce it later.
- Command/event payload envelope binds schema/digest, while command-specific handler schemas arrive with command implementation.
- Effect contracts preserve future state/authority vocabulary; no target effect is executable.
- Capability certification/promotion contracts are future seams; S1 only creates a quarantined candidate.
- `WORKER-EXP-01` remains inconclusive until a real pinned OMP binary is exercised.

## Next coordinate

`P3-KERN-02` — implement real PostgreSQL migrations generated from these V1 contracts, then prove empty and upgrade paths converge to the same checksummed schema.
