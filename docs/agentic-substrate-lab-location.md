# Agentic-Substrate Prototype Lab Location Decision

## Coordinate

`P2-LAB-01` — select the prototype implementation location and command boundary without disturbing Orca production code.

## Decision

Place the lab at:

```text
prototype/migration-control-plane/
```

Treat it as an **independent nested build/dependency boundary**, analogous to the repository’s independently installed `mobile/` workspace, not as a member of Orca’s root pnpm workspace.

`P2-LAB-01` deliberately added no scaffold. The completed Phase 2 work then selected Node 24+/strict TypeScript, created the private boundary, and verified it without changing Orca production packages.

## Hard constraints

- Work stays in the primary Orca worktree and branch.
- Orca desktop production source, bundles, root typecheck, root test discovery, root lockfile, and root dependency graph remain unchanged.
- Root `pnpm-workspace.yaml` stays `packages: []`; its comment explicitly preserves a single-project desktop install and excludes the independent `mobile/` workspace.
- The prototype is committed and versioned with the research, S1 fixture, OMP/Orca adapters, and experiment evidence.
- The lab uses Node 24+ with strict TypeScript; OMP remains a Bun child process, while Go/Python remain future measured service/challenger cuts.
- Commands are cross-platform and shell-independent; they must work on macOS, Linux, Windows, WSL, and SSH environments supported by Orca.
- No production module imports lab code.
- Baseline lab code does not import private Orca `src/**` modules. Reuse occurs through pinned protocols/process boundaries or a separately extracted stable package after an explicit decision.
- Generated databases, logs, object bodies, caches, coverage, binaries, and run artifacts are not committed.
- Fixtures, schemas, migrations, expected outputs, run manifests, and small failure evidence required for reproduction are committed.
- No new dependency is approved by this location decision.

## Repository evidence

### Root install is intentionally one project

`pnpm-workspace.yaml` contains:

```yaml
packages: []
```

Its comment explains that the desktop app is a single-project install and `mobile/` is an independent workspace with its own workspace file and lockfile. Adding the prototype as a root workspace member would contradict that invariant and could affect root patched dependencies and recursive pnpm behavior.

### Root build/test boundaries are production-oriented

- Root TypeScript references only `config/tsconfig.node.json`, `config/tsconfig.web.json`, and `config/tsconfig.relay.json`.
- Root Vitest includes `src/**`, selected `config/scripts/**`, `tests/tools/**`, and E2E unit tests.
- Electron/Vite builds compile production main/preload/renderer/CLI/relay targets.
- Root `package.json` owns Electron/native/postinstall dependencies and release commands.

Putting S1 under `src/**` would immediately mix experimental domain code and dependencies with the desktop product’s compile, lint, test, packaging, max-lines, and reliability surfaces.

### Nested independent workspace is established precedent

`mobile/` has its own:

- `package.json`;
- `pnpm-workspace.yaml`;
- `pnpm-lock.yaml`;
- `tsconfig.json` and Vitest configuration;
- build/test/format scripts;
- dependency graph and generated-output ignores.

The lab uses the same ownership pattern without inheriting mobile’s runtime choices.

---

# Options considered

| Option | Benefits | Costs / risks | Decision |
| --- | --- | --- | --- |
| `src/main/migration-control-plane/` | Direct access to Orca runtime and root toolchain; no second install. | Experimental domain code enters Electron production compile/package/test; encourages private imports and turns Orca runtime into product authority. | **Reject.** |
| Root workspace package such as `packages/migration-control-plane/` | Clear package name and root pnpm commands. | Root workspace deliberately has no packages; changes root lock/install/patch behavior and makes challenger dependencies part of the desktop graph. | **Reject.** |
| `tests/tools/migration-control-plane/` | Existing executable test-tool convention; root Vitest/tooling access. | S1 contains durable domain state and may graduate; hiding it as a test tool blurs source versus harness and root test discovery. | **Reject.** |
| `examples/migration-control-plane/` | Clearly non-production and simple. | `examples/` currently represents distributable plugin examples; S1 is an evidence-bearing lab, not user-facing sample code. | **Reject.** |
| Separate repository | Maximum dependency/release isolation. | Splits atomic changes, pins, CI, review and source-pattern extraction; harder to reproduce against one Orca revision and violates the current single-worktree research workflow. | **Reject for S1.** |
| `prototype/migration-control-plane/` as an independent nested boundary | Production isolation, same-revision traceability, independent lock/runtime, explicit promotion path, supports challengers and fixture artifacts. | Separate install/CI/cache; cannot privately import Orca code; duplicated toolchain metadata. | **Selected.** |

## Why `prototype/` rather than `experiments/`

S1 contains a coherent product-domain kernel, not only one-off experiment scripts. Experiments exercise the prototype; they do not own it. The lifecycle label prevents accidental production import while allowing successful code to be promoted intentionally.

## Why `migration-control-plane`

It names the actual domain boundary. `agentic-lab`, `platform`, `core`, `helpers`, or `prototype-app` would obscure responsibility and invite unrelated code.

---

# Selected boundary

## Implemented tracked layout

Phase 2 created:

```text
prototype/migration-control-plane/
├── package.json / pnpm-workspace.yaml / pnpm-lock.yaml
├── tsconfig.json / tsconfig.build.json / vitest.config.ts
├── .oxlintrc.json / .oxfmtrc.json / .gitignore
├── scripts/
│   └── migration-control-plane-lab.mjs
├── src/
├── test/
├── fixtures/
│   └── s1-identity-key/
└── .runs/                         # generated, ignored
```

Layout rules:

- Start with one implementation package. Do not pre-split kernel, epistemic, agent, evaluator, and runner packages before a measured boundary exists.
- Domain source stays under this root; fixtures and evaluator contracts are sibling inputs, not embedded production constants.
- `scripts/migration-control-plane-lab.mjs` is the stable cross-platform command entry. It may delegate to Bun, Node, Go, Python challenger tools, containers, or other selected runtimes, but callers do not depend on shell syntax.
- Challenger implementations live under an explicit `challengers/<name>/` only when their experiment is activated. They cannot become baseline imports.
- Run artifacts write only under `.runs/<run-id>/` unless an explicit output path is supplied.
- Generated output paths must resolve inside the lab or an explicit temporary/artifact directory.

## Dependency boundary

The lab owns its dependency graph and lockfiles.

It does not:

- add prototype runtime dependencies to root `package.json`;
- alter root `pnpm-lock.yaml`;
- become a root pnpm workspace member;
- rely on root `node_modules` resolution as a supported contract;
- run an install from Orca root `postinstall`;
- ship in Electron/Vite/native release output;
- publish a package.

The lab has its own private Node/TypeScript `package.json`, `pnpm-workspace.yaml`, and `pnpm-lock.yaml`. `P3-KERN-01` added exact `zod 4.4.3`; `P3-KERN-02` added exact `pg 8.23.0` plus development-only `@types/pg 8.23.1`. Both runtime dependencies and all six development tools remain isolated from Orca root. Future Go or Python challenger processes require separate subordinate module/lock files and cannot become baseline imports.

## Import boundary

Allowed:

- standard/open-source packages explicitly accepted for the prototype;
- pinned OMP executable/RPC protocol;
- copied synthetic fixtures and product-owned schemas within the lab;
- network/process/RPC calls to an Orca/OMP adapter under an explicit protocol;
- stable packages extracted from Orca later through their own clean-cut decision.

Forbidden:

```text
src/** → prototype/migration-control-plane/**
prototype/migration-control-plane/** → ../../src/main/**
prototype/migration-control-plane/** → ../../src/renderer/**
prototype/migration-control-plane/** → ../../src/relay/**
```

The lab may cite Orca implementation paths in docs/tests but cannot reach into private runtime modules to make the prototype work. This keeps the reuse map honest: port/adapt tested semantics now; extract reusable production code only after the prototype proves the contract.

## Data boundary

Committed:

- synthetic fixture bodies;
- source/license/provenance/checksum manifests;
- schemas and migrations;
- experiment specifications;
- deterministic expected outputs;
- small golden failure records needed for regression.

Ignored:

- `.runs/`;
- local PostgreSQL data/volumes;
- object-store bodies generated by runs;
- OMP transcripts containing transient model output;
- caches, coverage and build output;
- downloaded models/binaries;
- secrets and credentials.

No real customer data or PHI is allowed in this boundary.

---

# Stable command contract

The lab command entry is reserved as:

```text
node prototype/migration-control-plane/scripts/migration-control-plane-lab.mjs <command>
```

Required commands after the relevant Phase 2 coordinates implement them:

```text
... setup
... build
... typecheck
... test
... verify
... experiment run --experiment <ID> --seed <N> --arm <baseline|candidate> --fault <name|none> --output <path>
```

Semantics:

- `setup` installs/validates only lab dependencies and external prerequisites; it does not run root install or mutate root lockfiles.
- `build` compiles lab code only.
- `typecheck` checks lab source/tests/config only.
- `test` runs lab behavioral tests only.
- `verify` runs the lab’s required static checks, build, behavioral tests, fixture checksums, and manifest validation once.
- `experiment run` implements the contract in `docs/agentic-substrate-experiment-queue.md` and writes an immutable run directory.

The implementation may expose package-manager shortcuts, but CI/docs use this stable Node entry so commands remain uniform across a future Bun/Go/polyglot decision and across native/WSL/SSH hosts.

## Root command policy

Do not add root `package.json` aliases during the lab phase. Explicit lab paths prevent accidental execution during desktop install/build/release. A root alias may be added only after the lab becomes a maintained first-class repository subsystem.

---

# CI and validation boundary

After scaffold creation, add one explicit lab CI job. It must:

1. check out the same Orca revision;
2. install only lab dependencies with the lab lockfile;
3. run the stable `verify` command;
4. run the deterministic fixture/baseline subset as configured;
5. upload bounded run artifacts on failure;
6. never require Electron/native builds;
7. run on macOS, Linux, and Windows where the selected runtime supports S1;
8. run SSH-specific protocol checks separately rather than assuming local paths/processes.

Root desktop CI remains unchanged until an explicit integration boundary is introduced.

---

# Promotion and deletion paths

## Promotion

If S1 passes and the kernel becomes product code:

- identify stable product service/package ownership;
- move code through a clean cutover rather than importing from `prototype/` indefinitely;
- preserve versioned domain schemas, migrations and experiment fixtures;
- replace lab adapters with supported product interfaces;
- delete duplicate prototype implementation after migration;
- keep run artifacts/decisions as evidence, not runtime dependencies.

A likely destination can be selected only after runtime/deployment experiments; this decision does not preselect `src/main`, a Go service, or another repository.

## Deletion

If S1 fails or architecture reverses, deleting `prototype/migration-control-plane/` removes the implementation and its dependency graph without changing Orca desktop production packages. Research/experiment evidence remains in tracked docs or bounded artifacts.

---

# Boundary verification outcome

`P2-LAB-02` through `P2-LAB-12` proved:

1. one winning Node/TypeScript scaffold and stable command entry were created; no rejected runtime scaffold remains;
2. frozen `setup`, `build`, `typecheck`, `test`, `verify`, and experiment commands pass;
3. root `package.json`, lockfile, workspace, TypeScript/Vitest inputs, and Electron output remain outside the lab dependency/build graph;
4. implementation uses Node argument arrays and path utilities rather than shell-only commands or hardcoded separators;
5. generated dependencies/builds/runs are contained and ignored;
6. deterministic PostgreSQL/OMP-ready contracts can proceed without adding a framework or SQLite substitute.

## Reversal condition

Revisit the location only if:

- independent install/CI overhead materially blocks rapid S1 iteration;
- a selected runtime cannot operate in a nested build root;
- an existing stable Orca package is proven reusable only through a shared workspace boundary;
- the prototype graduates and production ownership/deployment requires a different repository/service cut.

Even then, the product-domain and no-private-import boundaries remain.

---

# P2-LAB-01 conclusion

Selected:

```text
prototype/migration-control-plane/
```

It is committed with Orca but isolated from Orca desktop production code, installs, builds, tests, bundles, and dependencies. The stable cross-platform command owns all lab operations; Node/TypeScript manifests, private lockfile, deterministic primitives, fixtures, evaluator baseline, runner, and CI now exist.

## Next coordinate

`P4-AGNT-04` — deliver the immutable context manifest inside the isolated workspace.
