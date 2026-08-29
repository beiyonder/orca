# Agentic-Substrate Prototype Runtime Cut

## Coordinate

`P2-LAB-02` — select the smallest implementation/runtime cut inside `prototype/migration-control-plane/`.

## Decision

Use **Node.js 24+ with strict TypeScript** for the Phase 2 lab, deterministic runner, fixtures, evaluator baseline, and initial product-domain contracts.

Keep runtime integrations out of process:

```text
Node/TypeScript lab and control baseline
├── PostgreSQL process/container                later P3 kernel dependency
├── OMP executable over JSONL RPC               Bun-owned worker process
├── DBOS TypeScript challenger                  isolated experiment arm
└── Inspect AI challenger                       isolated Python process, only when activated
```

Do not add Go or a permanent Python service in Phase 2. Do not run the lab on Bun merely because OMP uses Bun.

## Hard constraints

- The selected location remains `prototype/migration-control-plane/`.
- The lab owns a private manifest, lockfile, TypeScript projects, test config, lint/format config, and generated-output ignores.
- Root Orca workspace, package, lockfile, tests, typechecks, Electron builds, and release artifacts remain unchanged.
- Runtime and test code work on macOS, Linux, Windows, WSL, and SSH-supported filesystems without shell-only commands or hardcoded path separators.
- Standard library first; Phase 2 runtime code adds no production dependencies.
- Development dependencies are limited to TypeScript, Vitest, Oxfmt, Oxlint, and Node types.
- OMP remains a pinned child process. Its Bun runtime and dependency graph never enter the lab package.
- PostgreSQL is not replaced by an in-memory database; P2 fixtures do not need a database, and P3 adds the real PostgreSQL boundary.
- The stable Node command selected in `P2-LAB-01` owns setup/build/typecheck/test/verify/experiment dispatch.

## Runtime facts

Observed development environment:

- Node: `v26.7.0`; Orca declares Node `24` as its engine baseline.
- Bun: `1.3.14`.
- Go: `1.25.5`.
- pnpm: `10.24.0`.
- OMP audited source: `18.0.6`; previously observed installed executable: `18.0.4`.

The lab targets Node 24 behavior despite the newer local Node executable.

## Options compared

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| Node 24 + strict TypeScript | Existing Orca language/tooling knowledge; cross-platform; built-in crypto/fs/process APIs; direct DBOS challenger fit; easy JSON contracts and deterministic runner; OMP remains clean child process. | Separate private toolchain lock; future high-throughput control service may prefer another runtime. | **Selected.** |
| Bun + TypeScript | Same runtime family as OMP; fast startup/tests; built-in SQLite/process APIs. | Fuses product lab to worker runtime; weaker minimum-runtime alignment with Orca; makes DBOS/Node compatibility and future isolation less honest. | **Reject as baseline; OMP keeps Bun.** |
| Go | Strong static deployment, concurrency and future relay/control-service fit. | Adds cross-language schemas/builds before contracts exist; slower S1 iteration; OMP/DBOS/Inspect still require other runtimes. | **Defer until service/load/operability evidence.** |
| Node/Go polyglot from day one | Tests future service cut early. | Duplicates schemas/tooling and makes the smallest fixture depend on distributed boundaries with no measured need. | **Reject for Phase 2.** |
| Node + permanent Python evaluator service | Direct Inspect integration. | Challenger becomes architecture before native baseline; environment/deployment cost and split authority. | **Reject; spawn Python only for activated challenger.** |

## Why Node rather than Bun

OMP’s runtime is deliberately replaceable and isolated. Choosing Bun for product code only because the first worker uses Bun would couple the control plane to a worker implementation detail. Node 24 is already Orca’s declared baseline, supports modern ESM and standard-library TypeScript execution paths, and can supervise Bun/Go/Python processes without sharing their authority.

## Why TypeScript for Phase 2

Phase 2 is dominated by:

- versioned JSON contracts;
- fixture manifests and checksums;
- deterministic IDs/time/fault plans;
- file-based run artifacts;
- CLI parsing;
- evaluator measures;
- OMP JSONL RPC schemas.

Strict TypeScript makes those boundaries explicit with minimal translation. It does not decide the final production service language.

## Dependency cut

Initial private development dependencies:

```text
@types/node
@types/pg 8.23.1
typescript
vitest
oxfmt
oxlint
```

Phase 2 runtime dependencies: **none**. `P3-KERN-01` subsequently added exact `zod 4.4.3`; `P3-KERN-02` adds exact MIT-licensed `pg 8.23.0` for low-level PostgreSQL access. Both remain inside the private lab; Orca root is unchanged.

Rules:

- Pin via the lab’s own `pnpm-lock.yaml`.
- Never resolve through Orca root `node_modules` as a contract.
- No ORM, web framework, schema library, ID library, test fixture library, CLI parser, or logging package in Phase 2; standard library and typed functions are sufficient.
- P3 uses direct parameterized `pg` queries and explicit same-client transactions; no ORM or migration framework is selected.
- DBOS/Inspect dependencies live only in activated challenger arms.

## Build and test cut

Private package commands delegate through:

```text
node scripts/migration-control-plane-lab.mjs setup
node scripts/migration-control-plane-lab.mjs build
node scripts/migration-control-plane-lab.mjs typecheck
node scripts/migration-control-plane-lab.mjs test
node scripts/migration-control-plane-lab.mjs database migrate
node scripts/migration-control-plane-lab.mjs database fingerprint
node scripts/migration-control-plane-lab.mjs database verify
node scripts/migration-control-plane-lab.mjs verify
node scripts/migration-control-plane-lab.mjs experiment run ...
```

Internally:

- `tsc` builds `src/` to `dist/`;
- `tsc --noEmit` checks `src/`, tests, config, and scripts;
- Vitest runs only lab tests;
- Oxlint scans only lab source/tests/scripts;
- Oxfmt checks only the lab boundary;
- the experiment command builds then executes the compiled CLI;
- no shell pipelines or Makefile are required.

## Process boundaries

### OMP

- Spawn exact executable/version through argument arrays.
- Communicate through bounded JSONL RPC.
- Expose only product host tools from the assignment contract.
- Capture stdout/stderr/transcript/artifacts separately.
- Kill/reconcile the process tree; process exit never means product acceptance.

Phase 2 creates the contract fixture, not the live OMP integration.

### PostgreSQL

- Phase 2 uses file fixtures only.
- P3 starts a real ephemeral PostgreSQL instance or configured test database.
- No SQLite semantic substitute is allowed for transaction/locking/replay claims.

### Challengers

- DBOS runs as a separate experiment arm against identical product contracts.
- Inspect runs as an external Python command only after the native evaluator baseline exists.
- Challenger failure cannot prevent baseline lab setup/verification.

## Promotion path

Node/TypeScript may remain the product kernel runtime if later experiments show acceptable:

- PostgreSQL transaction/lease throughput;
- worker supervision and fault recovery;
- memory/resource bounds;
- packaging and customer-hosted operations;
- cross-platform support and team maintenance.

Go may take a future relay/control service only after a measured independent failure/scale/operability axis justifies the language boundary. Domain contracts and experiment artifacts must survive unchanged.

## Reversal condition

Revisit the runtime cut if:

- Node cannot meet deterministic subprocess/fault behavior on a supported platform;
- DBOS or PostgreSQL integration requires unsupported runtime semantics;
- measured control-plane load/resource behavior misses the envelope;
- static deployment/operational evidence materially favors Go;
- cross-language schema cost becomes lower than keeping one Node process.

Do not reverse based on benchmark folklore or OMP’s runtime alone.

## Next coordinate

`P7-EVAL-07` — implement acceptance state without adding a permanent Python service.
