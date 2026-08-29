# Agentic-Substrate Lab Handoff

## Goal and outcome

Complete `P2-LAB-02` through `P2-LAB-12` and close `G2-LAB` without changing Orca desktop production code or claiming later kernel/agent behavior.

Outcome: **`G2-LAB` passes.**

The isolated lab exists at:

```text
prototype/migration-control-plane/
```

Runtime baseline:

- Node.js 24+;
- strict TypeScript;
- private pnpm workspace/lockfile;
- Vitest, Oxlint and Oxfmt development tooling;
- no runtime dependencies;
- OMP remains an external Bun process;
- PostgreSQL begins in P3, not through a SQLite substitute.

Post-handoff updates: `P3-KERN-01` added exact `zod 4.4.3` for the V1 registry. `P3-KERN-02` added exact `pg 8.23.0`, three checksum-locked PostgreSQL 16 migrations, and real-server convergence tests. The Phase 2 gate itself had no runtime dependency.

Current roadmap coordinate: `P6-DISC-02`.

## Coordinate evidence

| Coordinate | Implemented evidence |
| --- | --- |
| `P2-LAB-02` | `docs/agentic-substrate-runtime-cut.md`; private Node/TypeScript package, lockfile, configs, stable command and three-platform CI workflow. |
| `P2-LAB-03` | `src/deterministic-runtime.ts`; seeded SHA-256 IDs, explicit deterministic clock/tick/event sequence and golden replay tests. |
| `P2-LAB-04` | `src/fault-injection.ts`; 14 named points across database, process, network, object, evaluator, target, memory and mission boundaries; occurrence control and unreachable-point failure. |
| `P2-LAB-05` | `src/run-artifact-store.ts` and `run-artifact-integrity.ts`; pending-to-final atomic publication, exclusive writes, path containment, canonical JSON, SHA-256 artifact index and tamper verification. |
| `P2-LAB-06` | `fixtures/s1-identity-key/`; six synthetic rows, MIT/no-PHI provenance, exact byte counts and SHA-256 manifest. |
| `P2-LAB-07` | Stale customer architecture claim, observed profile refutation, deterministic single/composite key probe and expected results. |
| `P2-LAB-08` | Critical dropped-facility-key mutation and benign description mutation with exact expected failed measures/verdicts. |
| `P2-LAB-09` | Six role/tenant/stale/injection/quarantined-memory/denied-input negative cases with deterministic policy dispositions. |
| `P2-LAB-10` | Pinned OMP 18.0.6/source-commit/RPC/frame/tool/schema/cancel/archive/version-skew fixture and validator; the formerly deferred real-binary proof now passes under `P4-AGNT-12`. |
| `P2-LAB-11` | `buildIdentityMappingBaseline`; chooses the smallest observed unique key without model calls and passes six deterministic evaluator measures. |
| `P2-LAB-12` | Stable `migration-control-plane-lab.mjs` setup/build/typecheck/test/verify/experiment entry, strict CLI validation and immutable run output. |
| `P4-AGNT-04` through `P4-AGNT-07` | Exact immutable prompt/workspace delivery, strict current-attempt result admission, capability/policy/schema/budget-bound host tool execution, and synchronous idempotent cancellation/revocation gate; 15 focused tests, full lab 16 files / 91 tests. |
| `P4-AGNT-08` through `P4-AGNT-13` | Nine typed proposal-only specialist roles, one-action apex, evidence-seeking disagreement, force-kill reconstruction, real pinned OMP containment, and the 20-case disagreement benchmark; full lab 21 files / 118 tests. |
| `P5-KNOW-01` through `P5-KNOW-03` | Five governed corpus contracts, private content-addressed immutable originals/parses, deterministic provenance catalog, and migration 006 corpus persistence; 22 unit files / 127 tests, 10 PostgreSQL files / 34 tests. |
| `P5-KNOW-04` through `P5-KNOW-08` | Pre-ranking authorization, structured/BM25 lexical, optional versioned semantic projection, bounded relational graph expansion, immutable retrieval traces, and byte-reproducible cited/redacted/token-bounded contexts; 23 unit files / 137 tests, 11 PostgreSQL files / 35 tests. |
| `P5-KNOW-09` through `P5-KNOW-13` | Five-class quarantined memory candidates, ordered reversible memory/use/invalidation lifecycle, compatible versioned skill registry, immutable PostgreSQL persistence, and sealed retrieval/help-harm qualification; 55 schemas, migration 008, 25 unit files / 152 tests, 12 PostgreSQL files / 36 tests. |
| `P6-DISC-01` | Frozen Pagila `pagila-v3.1.0` / `fef96757…ddf90e` source, exact permissive license/schema/data bytes, PostgreSQL 16.15 UTF8/C runtime, expected catalog and row-count oracle, fixture digest `c22e7c17…f4fe025d`, strict loader, shared file defenses, and real-server reconstruction; 27 unit files / 158 tests, 13 PostgreSQL files / 37 tests. |

## Stable commands

From `prototype/migration-control-plane/`:

```text
node scripts/migration-control-plane-lab.mjs setup
node scripts/migration-control-plane-lab.mjs build
node scripts/migration-control-plane-lab.mjs typecheck
node scripts/migration-control-plane-lab.mjs test
node scripts/migration-control-plane-lab.mjs verify
node scripts/migration-control-plane-lab.mjs experiment run --experiment <ID> --seed <N> --arm baseline --fault none --output .runs
pnpm run experiment:omp-containment -- --omp-binary <absolute-path> --omp-digest <sha256> --output .runs --prototype-revision <revision>
```

`setup` uses the private frozen lockfile. `verify` runs formatting, lint, typecheck, all lab tests, and build. `experiment run` builds first and executes the compiled CLI.

## Commands run and results

```text
pnpm install
```

- private lockfile generated;
- 54 development packages installed;
- root Orca lockfile/workspace untouched.

```text
node scripts/migration-control-plane-lab.mjs setup
```

- frozen lockfile accepted;
- already up to date.

```text
node scripts/migration-control-plane-lab.mjs verify
```

- format check passed;
- lint passed with zero warnings;
- strict TypeScript passed;
- 6 test files / 22 tests passed;
- build passed.

Tests cover:

- deterministic replay and invalid clock/ID inputs;
- all required fault categories, selected occurrences and unreachable faults;
- atomic/contained/exclusive/sealed artifacts and tamper detection;
- fixture checksums and six-row key truth;
- contradiction/probe outcomes;
- critical/benign mutation calibration;
- six negative cases;
- pinned OMP worker contract import with exact report digest;
- baseline correctness/order independence/no-key failure/malformed output;
- deterministic run replay;
- every registered fault producing an inspectable failed run;
- immutable run ID reuse rejection;
- unknown experiment/unsupported arm rejection;
- 20-case specialist disagreement benchmark with cited probe/tie traces.
- 55-document `EXP-06` known-answer benchmark with version conflict, stale, cross-tenant, distractor, exact citation, and semantic-ablation traces;
- 20-case `EXP-07` no-memory/memory ablation with poisoned/stale/cross-tenant isolation, retained use attribution, and post-invalidation denial.

Final sealed experiment evidence generated locally under ignored `.runs/`:

| Experiment | Seed | Status | Run ID |
| --- | ---: | --- | --- |
| `BASELINE-EXP-01` | 204 | `passed` | `baseline-exp-01-204-baseline-none-run_000000_fac5e8ac236c1090` |
| `LAB-EXP-01` | 205 | `passed` | `lab-exp-01-205-baseline-none-run_000000_121b6d9ce7649417` |
| `S1-FIXTURE-EXP-01` | 206 | `passed` | `s1-fixture-exp-01-206-baseline-none-run_000000_bc28d1ef6d576c92` |
| `WORKER-EXP-01` | 417 | `passed` | `worker-exp-01-417-baseline-none-run_000000_766910686f21b20f` |
| `EXP-05` | 413 | `passed` | `exp-05-413-baseline-none-run_000000_e176cfe9800c0719` |
| `EXP-10` | 412 | `passed` | `exp-10-3040f76381e7a97eaa2d` |
| `EXP-06` | 506 | `passed` | `exp-06-506-baseline-none-run_000000_b9160260c6af7df3` |
| `EXP-07` | 507 | `passed` | `exp-07-507-baseline-none-run_000000_81c0168e84e967df` |

Injected target-boundary fault evidence:

```text
LAB-EXP-01 seed 203
fault target.after_response
status failed
summary Run stopped at injected fault target.after_response.
```

Failed runs intentionally exit non-zero while preserving sealed artifacts.

## `G2-LAB` gate evidence

- **Clean install/run:** private frozen setup and stable command completed.
- **Licenses/checksums:** synthetic MIT/no-PHI license plus eight-file byte/SHA-256 manifest validated on every fixture load.
- **Determinism:** same seed reproduces run ID, events, metrics, verdict, usage and output bytes in independent output roots.
- **Fault artifacts:** all 14 registered points create inspectable finalized failed runs; run indexes detect later modification.
- **Baselines first:** non-agent mapping/evaluator baseline exists and passes before apex/agent implementation.
- **Cross-platform contract:** commands use Node argument arrays/path utilities; CI matrix pins Node 24 on Ubuntu, macOS and Windows.
- **Isolation:** no production Orca source import, runtime dependency, root package/workspace/lock/test/build change, Electron build, real customer data, secret or external effect.

## Decisions and rejected options

Selected Node/TypeScript because Phase 2 is JSON contracts, fixtures, deterministic file/process orchestration and OMP RPC. It matches Orca’s Node 24 baseline without coupling product code to OMP’s Bun runtime.

Rejected for the Phase 2 baseline:

- Bun as the product runtime: couples control code to the first worker runtime.
- Go: adds cross-language schema/build cost before service/load evidence.
- day-one Node/Go polyglot: invents a distributed boundary before need.
- permanent Python evaluator service: promotes Inspect before a native baseline.
- SQLite durability substitute: cannot prove PostgreSQL transaction/locking claims.
- WideWorldImporters first: SQL Server runtime and ARM64 portability add infrastructure before a source-adapter contract exists.
- Oracle samples first: PL/SQL/multi-schema value does not offset the heavier executable runtime and redistribution boundary.
- Synthea first: healthcare relevance is valuable later, but generated exchange records do not pressure relational estate discovery.
- Debezium examples first: CDC value belongs at `P6-DISC-08`; Kafka/container topology would confound the first fixture.

## Known risks and intentional limits

1. `WORKER-EXP-01` now **passes** from real pinned OMP 18.0.6 `EXP-10` report `bb4343a2…a73482d`; the local deterministic provider uses no production credentials or customer data.
2. PR #1 observed 19 passing GitHub checks (10 correctly skipped), including Node 24 Ubuntu/macOS/Windows lab verification and PostgreSQL 16 integration.
3. Database crash/replay/restart and OMP worker/process recovery are real. External target recovery remains simulated until its effect-execution coordinates.
4. Phase 3 is complete: five migrations, atomic command/event/delivery, DAG/lifecycle/effect authority, exact replay, deterministic restart dispositions, and sealed durable convergence pass.
5. Phase 4 is complete: isolated framed processes, exact context/results/tools, nine typed specialists, proposed-only apex action, evidence-driven disagreement, reconstructability, and real containment all pass.
6. Phase 5 is complete: governed corpus/retrieval/context, memory candidates and reversible use lifecycle, typed skill versions, and sealed `EXP-06`/`EXP-07` pass; migration 008 fingerprints 55 contract bindings at `2ade23da…b4bf5e`.
7. Pagila is synthetic and operationally rich but not a true legacy or healthcare estate; hidden assets, denials, misleading documents, CDC faults, and domain semantics remain future planted layers.
8. Generated `.runs/`, `dist/`, `node_modules` and coverage remain ignored. Frozen fixture source bytes and exact license/provenance manifests are tracked.
9. No DBOS or Inspect dependency was added; challenger arms remain gated by their baseline experiments.

## Files created

```text
prototype/migration-control-plane/
├── package.json / pnpm-lock.yaml / pnpm-workspace.yaml
├── tsconfig.json / tsconfig.build.json / vitest.config.ts
├── .oxlintrc.json / .oxfmtrc.json / .gitignore
├── scripts/migration-control-plane-lab.mjs
├── src/*.ts
├── test/*.test.ts
├── fixtures/s1-identity-key/* and fixtures/p6-pagila-v3.1.0/*
```

Repository integration:

- `.github/workflows/migration-control-plane-lab.yml`
- `docs/agentic-substrate-runtime-cut.md`
- this handoff plus roadmap/atlas/research/queue updates.

## Exact next action

Start `P6-DISC-02`: define the versioned read-only adapter contract for the frozen Pagila boundary, including capability, permission, evidence, limit, error, and recovery records.

First verification command after any change:

```text
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs verify
```
