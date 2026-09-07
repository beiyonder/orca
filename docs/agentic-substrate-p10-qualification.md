# P10 Prototype Qualification

## Decision scope

This qualification accepts or rejects the fixed-code, non-production migration-control-plane prototype. It does not authorize production PHI, production mutation, deployed remote execution, hostile-code execution, enterprise identity/RLS, high availability, or broad connector coverage.

Canonical live status remains in [`agentic-substrate-project-state.json`](./agentic-substrate-project-state.json).

## Frozen profile

The executable profile is [`prototype/migration-control-plane/qualification/p10-profile.v1.json`](../prototype/migration-control-plane/qualification/p10-profile.v1.json). It pins:

- Node 24, pnpm 10.24.0, PostgreSQL 16.15, Pagila 3.1.0, and OMP 18.0.6;
- identity and Pagila fixture manifests;
- deterministic/no-production model and prompt boundaries;
- every experiment seed used by the golden campaign;
- all 14 registered fault points;
- ten clean repeat runs;
- the 50-mission, 100-assignment planning envelope.

The evidence bundle records the profile digest, checkout revision, runtime platform, PostgreSQL version, and lockfile digest.

## Clean environment

Use a disposable clone of `beiyonder/orca` at the revision under review. Do not mount or copy credentials, home directories, SSH keys, cloud configuration, production databases, customer artifacts, or PHI.

Required services:

1. PostgreSQL 16 control database: `migration_control_plane`.
2. Separate disposable target database: `migration_effect_target`.
3. Separate Pagila database loaded from `fixtures/p6-pagila-v3.1.0/pagila-schema.sql` and `pagila-insert-data.sql`.

Required environment:

```text
MIGRATION_CONTROL_DATABASE_URL=postgresql://.../migration_control_plane
MIGRATION_CONTROL_TARGET_DATABASE_URL=postgresql://.../migration_effect_target
PAGILA_DISCOVERY_DATABASE_URL=postgresql://.../pagila
ORCA_PROTOTYPE_REVISION=<exact checkout revision>
```

Install and run:

```bash
cd prototype/migration-control-plane
node scripts/migration-control-plane-lab.mjs setup
node scripts/migration-control-plane-lab.mjs qualification run \
  --profile qualification/p10-profile.v1.json \
  --output .runs/p10-qualification
```

The qualification command runs formatting/lint/type/build/schema verification and the complete PostgreSQL suite before producing evidence. Any prerequisite or report failure exits nonzero.

## Campaigns

The golden campaign runs the deterministic baseline, durable convergence, Pagila contradiction/estate/CDC discovery, specialist disagreement, retrieval, governed memory, independent evaluation/correction, skill rollback, bounded effect/reconciliation, isolation, and process-completeness experiments.

The fault campaign injects every registered database, process, network, object, evaluator, target, memory, and mission fault and requires an intact failed-run artifact at the exact selected boundary.

Repeatability creates ten fresh PostgreSQL databases, runs the same durable accepted mission in each, verifies every run artifact, and compares canonical accepted outputs.

The planning envelope creates 50 durable missions and 100 assignment records, then records control-event volume, event bytes, elapsed time, CPU, and memory. It measures a single-node lab envelope; it is not a production capacity claim.

## Evidence bundle

The output directory contains raw immutable run artifacts plus:

- `profile.json` and `environment.json`;
- `campaigns/experiments.json`, `faults.json`, `repeatability.json`, and `load.json`;
- `reports/criteria.json` for all 14 working-prototype criteria;
- `reports/coordinates.json` for P10-QUAL-01 through 12;
- security, reconstruction, baseline, capability, limitations, resources, and review reports;
- `artifact-index.json`, which hashes and sizes every other file in the bundle.

A cold reviewer starts with `artifact-index.json`, verifies it, reads `reports/review.json`, follows each criterion’s named evidence, and uses run manifests/events/faults/metrics/verdicts/usage to reconstruct who acted, what happened, why it was accepted or rejected, when it occurred, and how recovery converged.

## Recovery

If the qualification command is interrupted:

1. Treat the incomplete output directory as failed evidence; do not resume it in place.
2. Preserve it for diagnosis if needed.
3. Drop only the disposable `p10_repeat_*` databases left by an abnormal host termination.
4. Confirm control, target, and Pagila URLs still point to disposable databases.
5. Choose a new empty output directory and rerun the one command.

A failed individual experiment retains its indexed artifact. The aggregate review remains `rework` until every criterion and coordinate passes.

## Baseline and intervention review

The manual/script baseline uses zero model calls and zero effects. The prototype comparison reports correctness, questions, elapsed time, cost, and recovery evidence. The deterministic qualification requires no operator decisions after launch; intervention is limited to environment setup and investigating a failed report.

The API/minimal inspector is the accepted P9 operator surface. A production Electron console remains deferred and is not required for this qualification.

## Capability envelope

Supported:

- the pinned identity and Pagila fixtures;
- read-only discovery and cited evidence reconstruction;
- deterministic evaluation, correction, and governed learning qualification;
- one disposable PostgreSQL marker effect with reconciliation;
- authenticated mission API, durable SSE, and minimal inspector;
- fixed-code local/CI execution on the tested operating systems.

Unsupported:

- production PHI or customer data;
- production target mutation or destructive migration;
- hostile or arbitrary code as a security boundary;
- production HA, RLS, SCIM, KMS, secrets-manager, relay, or disconnected operation;
- performance/SLO claims beyond the recorded single-node envelope;
- broad databases, clouds, migration patterns, or domain pressure.

## Prototype review

Decision rule:

- `accept-with-limitations` only when all 14 working-prototype criteria, all 12 P10 coordinates, all normal experiments, all fault artifacts, ten clean repeats, bundle integrity, security invariants, and the load envelope pass;
- otherwise `rework`, naming the failed report and retaining evidence.

Acceptance authorizes the next investment loop: production-boundary discovery and hardening. It does not erase the limitations above.

## Qualification evidence

Local sealed run `p10-8f11bb69128c4b43-working-tree` passed under Node 24.20.0 and PostgreSQL 16.15. The indexed bundle contains 408 files: 13 normal experiment runs, 14 exact injected-fault artifacts, 10 fresh-database repeat runs, campaign reports, and aggregate review evidence.

All 14 working-prototype criteria and P10-QUAL-01 through 12 passed. The planning envelope persisted 50 missions, 100 assignment records, 50 authoritative mission events, and 71,450 event bytes. Fixture creation took 119.23 ms inside the measured runner; aggregate runner CPU/memory evidence remains in `reports/resources.json` rather than being generalized into a production capacity claim.

Review decision: **accept with limitations** for the declared fixed-code disposable non-production boundary. Next investment loop: production-boundary discovery and hardening.
