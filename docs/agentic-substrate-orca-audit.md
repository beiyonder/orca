# Orca A0–A7 Code and Test Audit

## Coordinate and evidence boundary

`P1-RSCH-11` — exact Orca orchestration, task/attempt, relay, artifact, process, recovery, and UI audit.

Audited repository state:

- repository working tree: `/Users/siddharth/orca/orca`
- baseline revision: `4c0fa6fc3c75c9596b7aee375f2485952830e2e0`
- branch: `product/healthcare-migration-control-plane`
- this audit also includes the uncommitted documentation-only research changes made after that baseline;
- application source was inspected directly and not modified by this audit.

Method:

- static source and representative-test inspection;
- exact symbols/protocols/tests/limits/extension seams mapped below;
- maturity is stated twice where needed: proven Orca desktop/orchestration behavior versus missing migration-product behavior;
- no claim that terminal/worktree orchestration semantics are already a healthcare migration domain model.

## Executive verdict

| Capability | Orca maturity | Exact product disposition | Blocking gap |
| --- | --- | --- | --- |
| `A0` Tool agent | `M1` integration shell | Keep as operator/authoring adapter; use OMP for model/tool loop. | Orca launches/detects external agents but does not implement their provider/tool reasoning loop. |
| `A1` Stateful worker | `M2/M3` visibility, identity, archive and recovery patterns | Adapt exact-session/output evidence and process identity around OMP. | No internal semantic worker context/memory; provider transcripts remain external. |
| `A2` Durable mission | `M3` terminal orchestration; migration domain `M0` | Adapt state/transaction/recovery invariants into new product kernel. | Current rows model runs/tasks/dispatches/mail/terminals, not evidence/gaps/decisions/plans/effects/evaluations. |
| `A3` Specialists | `M2/M3` durable external-worker coordination | Adapt task/attempt/capability/delivery/federation semantics. | Coordinator decomposition is unimplemented; identities and authority are pane/terminal/worktree based; decision gates assume human resolution. |
| `A4` Evidence seeking | `M1` visibility/artifact/search surfaces; epistemic system `M0` | Reuse operator/UI/artifact/source identity patterns. | No fact/claim/assertion/gap/contradiction/probe/accepted-finding ledger or context compiler. |
| `A5` Self-correction | `M1` product-specific recovery/check UX; universal evaluator `M0` | Build evaluator/correction authority; reuse recovery/error/evidence UI patterns. | Worker success and feature-specific checks do not form independent subject evaluation. |
| `A6` Self-improvement | `M3` skill packaging/distribution/recovery; governed learning `M0` | Reuse package identity, transaction recovery and UI; build certification lifecycle above install. | No outcome-derived candidate, held-out certification, target envelope, promotion/use/drift/demotion. |
| `A7` Bounded action | `M3` terminal/skill control patterns; migration effects `M0/M1` | Adapt strongly for product workload/effect protocol. | No migration intent/policy/secret/sandbox/adapter/provider-idempotency/target-readback/compensation contract. |

---

# Runtime and protocol map

## Desktop renderer

Responsibilities relevant to substrate:

- terminal/worktree/agent activity and controls;
- AI Vault session discovery/resume;
- source-control/review/check failure surfaces;
- skills package risk/freshness/install/share/update/delete flows;
- artifacts publish/list/share surfaces;
- orchestration task links and worker status.

Product role: likely operator/authoring shell. It is not durable mission authority.

## Main runtime

`src/main/runtime/orca-runtime.ts` exports `OrcaRuntimeService` and owns the mutable live graph of:

- terminal/process handles;
- agent session creation/ensure/launch;
- workspace/worktree operations;
- orchestration database/RPC integration;
- worker prompt dispatch and output capture;
- relay/mobile/environment routing;
- skill/artifact operations.

Relevant methods include:

- `ensureAgentSession`;
- `createAgentSession`;
- `launchAgentTerminal`;
- `sendTerminalAgentPrompt`.

Product role: useful integration shell and tested host boundary. The current class is too broad to become the migration control kernel.

## Orchestration database

`src/main/runtime/orchestration/db/*` is a modular SQLite authority for Orca terminal orchestration.

Canonical current entities:

- runs and coordinator bindings/generations;
- tasks and dependencies;
- dispatch contexts and worker dispatches;
- worker terminal resources;
- messages/deliveries/mailbox pointers;
- questions and decision gates;
- mutation receipts;
- federation relay items/attachments/acknowledgments;
- compatibility and legacy recovery records.

Product role: source of proven relational transaction/recovery patterns. Schema should not be stretched into migration truth.

## Runtime RPC

`src/shared/orchestration-rpc-contract.ts` and main runtime RPC methods expose typed orchestration operations. `OrchestrationMutationExecutor` adds caller/request/payload idempotency for mutations.

Product role: adapt envelope/idempotency patterns; define new product domain API.

## Environment/federation relay

Orca has:

- peer fingerprints;
- environment selectors;
- remote worker attachment;
- sequenced relay items and acknowledgments;
- `start_unknown`/`stop_unknown` recovery;
- relay session generations/reconnect.

Product role: strong basis for customer-zone dispatch/receipt transport, after identity/effect semantics are replaced.

---

# A0 — Tool agent

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| `src/shared/tui-agent-config.ts` | `TUI_AGENT_CONFIG`, `TuiAgentConfig`, `AgentPromptInjectionMode`, `getTuiAgentDetectCommands`, `getTuiAgentLaunchCommand`; external agent detection/launch commands, expected process and agent-specific prompt injection/readiness behavior across platforms. |
| `src/main/runtime/orca-runtime.ts` | `OrcaRuntimeService.ensureAgentSession`, `createAgentSession`, `launchAgentTerminal`, `sendTerminalAgentPrompt`; creates/claims terminal sessions and delivers prompts through terminal/runtime adapters. |
| `src/shared/agent-session-host-authority.ts` | host-side session request/claim/surface authority contracts. |
| `src/main/runtime/agent-session-claim-identity.ts` | canonical session identity and ephemeral claim signing. |
| `src/main/agent-hooks/*` | hook server, process/session status and prompt/result observations for supported agents. |
| `src/main/pty-descendant-termination.ts` | `captureDescendantSnapshot`, `killWithDescendantSweep`, `terminateDescendantSnapshot`; process-tree capture/teardown with PID identity protections. |

## Protocol

```text
agent selection + worktree
→ resolve native/WSL/SSH launch command
→ claim/create PTY session and process incarnation
→ inject prompt using agent-specific argv/flag/env/stdin strategy
→ observe OSC/hooks/process title/status/provider session
→ terminal input/output remains external-agent protocol
→ stop with process-tree identity checks
```

## Representative tests

- `src/shared/require-tui-agent-config.test.ts`
- `tui-agent-startup.test.ts`
- `tui-agent-startup-session-options.test.ts`
- `tui-agent-startup-shell.test.ts`
- `tui-agent-permissions.test.ts`
- runtime agent-session/launch/claim tests
- `src/main/pty-descendant-termination.test.ts`
- `pty-descendant-termination-job-coverage.test.ts`
- agent-hook server/process/authority tests.

## Proven behavior

- launches many external coding agents through cross-platform-specific contracts;
- binds terminal/process/session identity;
- verifies prompt submission/readiness for brittle TUI surfaces;
- observes agent lifecycle/status;
- terminates descendant trees defensively.

## Blocking limitation

Orca does not implement provider streaming, canonical model messages, tool schema validation/execution or model/tool retry loops. Those live in external agents such as OMP.

## Extension point

Keep Orca as optional operator/authoring host. For substrate workers, prefer the explicit OMP RPC/host-tool protocol over terminal scraping; retain PTY integrations as compatibility/fallback and user-facing sessions.

---

# A1 — Stateful worker

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| `src/main/ai-vault/session-scanner-source-discovery.ts` | `discoverAiVaultSessionSources`; provider/agent root discovery across native and WSL sources. |
| `src/main/ai-vault/session-scanner-primary-parsers.ts` | resumable parser state and provider-specific transcript parsing, including `parseClaudeSessionFile`/content. |
| `src/main/ai-vault/session-scanner-parse-cache.ts` | `parseAgentSessionFileCached`, `seedSessionParseCache`; bounded cache, append-only incremental JSONL parsing and rewrite detection tradeoff. |
| `src/main/ai-vault/session-scanner-subagent-transcripts.ts` | exact subagent transcript discovery/count/partition without treating children as resumable parent sessions. |
| `src/main/ai-vault/ai-vault-scan-coordinator.ts` | `AiVaultScanCoordinator`; scan coalescing, cancellation and forced preemption of stuck scans. |
| `src/main/runtime/orchestration/worker-provider-session.ts` | `selectExactWorkerProviderSession`; pins pane key, process incarnation, connection/launch token and observation time to provider session. |
| `src/main/runtime/orchestration/worker-transcript-read.ts` | `readWorkerTranscript`; bounded exact transcript paging with byte offsets, format decoders and malformed/oversized warnings. |
| `src/main/runtime/orchestration/worker-transcript-payload.ts` | `boundWorkerTranscriptMessages`, `redactWorkerTerminalLines`; caps blocks/text/input/nodes/bytes and redacts dispatch capabilities/sensitive data. |
| `src/main/runtime/orchestration/worker-output-archive.ts` | `captureWorkerOutputArchive`; prefers exact pinned provider transcript, falls back to bounded redacted terminal tail, and refuses release when evidence cannot be preserved. |
| `src/main/runtime/orchestration/worker-terminal-process-liveness.ts` | classifies exact process-incarnation currency/unknown state. |

## Worker evidence protocol

```text
pane key + process incarnation + launch/connection identity
→ hook-reported provider session after dispatch observation boundary
→ exact provider transcript path/session
→ bounded message snapshot or bounded redacted terminal tail
→ durable worker output archive before terminal release
```

## Representative tests

- `src/main/ai-vault/session-scanner.test.ts`
- provider-specific scanner/parser tests;
- `session-scanner-parse-cache.test.ts`
- `session-parse-cache-persistence.test.ts`
- `session-scanner-parse-wsl-stall.test.ts`
- `ai-vault-scan-coordinator.test.ts`
- `session-scanner-omp-subagent-transcripts.test.ts`
- `src/main/runtime/orchestration/worker-provider-session.test.ts`
- `worker-transcript-read.test.ts`
- `worker-transcript-payload.test.ts`
- worker output/archive/release tests.

## Proven behavior

- discovers and displays heterogeneous external-agent histories;
- handles native, WSL and SSH paths/formats/stalls;
- pins exact provider session to process lifetime;
- bounds/redacts output and preserves inspectable evidence before release;
- uses process/session identity rather than terminal title alone.

## Blocking limitations

- Orca sees external transcripts; it does not own agent semantic context or memory;
- parsed previews/history are visibility, not product evidence admission;
- cache/parser state is not mission recovery state;
- no assignment `ContextManifest` or governed long-term memory.

## Extension point

Use exact provider-session pin and output archive as evidence around OMP RPC assignments. Product assignment/context/result records remain canonical.

---

# A2 — Durable mission

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| `src/main/runtime/orchestration/types.ts` | `TaskStatus`, `DispatchStatus`, `WorkerDispatchState`, `RunRow`, `TaskRow`, `DispatchContextRow`, `WorkerDispatchRow`, `DeliveryRow`, `MessageRow`, `QuestionRow`, `MutationReceiptRow`, federation and coordinator records. |
| `db/schema/create-core-tables-sql.ts` | `createCoreTablesSql`; core run/message/task/dispatch/delivery/receipt and compatibility tables. |
| `db/schema/create-graph-tables-sql.ts` | `createGraphTablesSql`; worker dispatch/resource/federation/question and graph-related tables/constraints. |
| `db/tasks/task-store.ts` | `createTask`, `getTask`, `listTasks`, `listTasksWithDispatch`, `promoteReadyTasks`; dependency/status creation and atomic ready-child promotion. |
| `db/tasks/task-status-transition.ts` | guarded task transitions. |
| `db/dispatch-context/dispatch-context-store.ts` | `createDispatchContext`, `getDispatchContextById`, `commitDispatchLaunchTokenHash`; atomic ready-task claim and active assignee/pane exclusion. |
| `db/dispatch-context/worker-report-settlement.ts` | `settleWorkerReport`, `settleWorkerReportInTransaction`; current-dispatch settlement and duplicate/stale result handling. |
| `db/runs/run-create.ts` | `createRun`; objective and coordinator pane/generation binding. |
| `db/runs/run-delivery.ts` | `requireCurrentConsumer`, `getOrCreateRunDelivery`, `acknowledgeRunDelivery`; generation-fenced durable delivery/replay. |
| `db/coordinator-runs/coordinator-run-store.ts` | durable coordinator run/status/spec/handle. |
| `db/decision-gates/decision-gate-store.ts` | `createGate`, `resolveGate`, `timeoutGate`, `listGates`; task-bound pending/resolved/timeout gates. |
| `db/questions/question-threads.ts` | transactional question/message creation and generation-fenced answers. |
| `db/messages/message-insert.ts` | atomic message batches and delivery-contract/run binding. |
| `db/mutation-receipts/mutation-receipt-store.ts` | durable caller/request/method/payload pending/completed receipts. |
| schema migrations/version-skew modules | forward migration, legacy adoption/compatibility and contract skew handling. |

## State protocol

```text
Run objective + coordinator generation
→ Task DAG/status/dependencies
→ DispatchContext attempt bound to task/assignee/pane/process
→ WorkerDispatch start/ready/unknown/terminal states
→ durable messages/deliveries/questions/gates
→ current worker report settles exact task+dispatch
→ dependencies promote atomically
→ terminal convergence/failure/circuit break
```

## Representative tests

- `src/main/runtime/orchestration/db.test.ts`
- `db-task-create-readiness.test.ts`
- `db-task-dispatch-invariant.test.ts`
- `db-task-dispatch-races.test.ts`
- `db-task-dispatch-lifecycle-guards.test.ts`
- `orchestration-worker-dispatch-db.test.ts`
- `lifecycle-reconciliation.test.ts`
- `dispatch-failure-idempotency.test.ts`
- `message-batch-atomicity.test.ts`
- `orchestration-run-delivery-db.test.ts`
- `orchestration-mutation-question-db.test.ts`
- `orchestration-version-skew-migration.test.ts`
- `orchestration-legacy-storage-db.test.ts`
- `orchestration-reset-db.test.ts`
- database permission/retention/pagination tests.

## Proven behavior

- durable relational run/task/dispatch/message/delivery/question state;
- atomic task claim and dependent promotion;
- duplicate/stale/unauthorized completion rejection;
- retries/circuit breakers and explicit start/stop unknown;
- consumer generation fencing and delivery replay;
- schema migration/compatibility/recovery;
- fail-closed unresolved mutation capacity.

## Blocking limitations

The aggregate is terminal orchestration, not a migration mission:

- `objective` and free-form task `spec` are not structured mission/estate/decision state;
- no evidence/assertion/gap/finding tables;
- no immutable decision/plan revision graph;
- no context/evaluator/memory/skill/effect domain owners;
- task status can complete from current worker lifecycle report without required independent evaluation;
- no expected-version mission command/event ledger or general projection rebuild contract;
- SQLite/local runtime assumptions differ from tenant PostgreSQL control plane.

## Extension point

Adapt transaction tests and semantic patterns into a new product-owned PostgreSQL kernel. Do not append migration columns to the existing orchestration schema until it becomes a second accidental domain model.

---

# A3 — Specialist orchestration

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| `src/main/runtime/orchestration/coordinator.ts` | `Coordinator`, `CoordinatorOptions`; polling phase loop, message reconciliation, ready-task dispatch, gate reblocking, escalation handling and DAG convergence. Explicit comment: AI decomposition is not implemented and tasks must be pre-created. |
| `coordinator-task-dispatch.ts` | `dispatchTaskToWorker`, `listAvailableWorkerTerminals`, `warnStaleDispatches`; stale-base policy, max concurrency, exact dispatch authority and terminal prompt preamble. |
| `coordinator-dag-convergence.ts` | `evaluateDagConvergence`; empty/all-done/active and blocked-without-active stall warning. |
| `coordinator-decision-gates.ts` | `openDecisionGateFromMessage`, `reblockTasksWithPendingGates`; exact task/dispatch gate binding and human resolution invariant. |
| `coordinator-escalation-triage.ts` | `applyEscalationToDispatch`; exact sender/dispatch ownership, retry/circuit-break semantics. |
| `lifecycle-reconciliation.ts` | `reconcileLifecycleMessage`; task/dispatch/assignee/pane/capability/current-state guards. |
| `db/worker-dispatch/worker-dispatch-authority.ts` | `prepareStartingWorkerAuthority`; transactional random capability mint/hash, process/pane/resource ownership binding. |
| mailbox routing/delivery modules | handle/pane mailbox ownership, pointer delivery, notifications, waiters and repointing. |
| `federation-sync.ts` | `syncFederatedDispatch`, `parseRelayedMessage`; paged sequenced relay import, lifecycle parsing and acknowledgment. |
| `federation-lifecycle-settlement.ts` | wait/publish exact dispatch+sequence run-home settlement. |
| `environment-transport.ts` | `OrchestrationEnvironmentTransport`, `fingerprintOrchestrationPeer`; environment RPC and peer identity. |
| shared/renderer task-display and orchestration index/link modules | operator visibility linking tasks, terminals and worktrees. |

## Coordination protocol

```text
pre-created Task DAG
→ polling Coordinator lists ready tasks and idle terminals
→ creates exact DispatchContext/capability
→ sends prompt preamble to terminal agent
→ worker messages heartbeat/question/escalation/worker_done
→ current authority reconciles message
→ retry/circuit break/gate or settle task
→ promote dependent tasks
→ all completed/failed ends run
```

Federation adds:

```text
home dispatch
→ remote attachment/capability/process identity
→ sequenced relay items
→ imported worker messages/receipts
→ run-home settlement
→ acknowledgment checkpoint
```

## Representative tests

- `src/main/runtime/orchestration/coordinator.test.ts`
- `coordinator-decision-gates.test.ts`
- `coordinator-drift-probe-coalescing.test.ts`
- `coordinator-escalation-triage.test.ts`
- `orchestration-adopted-run-binding.test.ts`
- `orchestration-creator-authority-performance.test.ts`
- `db-heartbeat-straggler-guard.test.ts`
- `federation-sync.test.ts`
- `federation-acknowledgment-integrity.test.ts`
- `federation-lifecycle-settlement.test.ts`
- `federation-terminal-recovery.test.ts`
- `orchestration-federation-agent-launch.test.ts`
- worktree-agent orchestration renderer/store tests.

## Proven behavior

- durable task/dependency dispatch to external workers;
- exact attempt/sender/process authority and stale-result rejection;
- retries/circuit breaker/gates/stall signals;
- messages/deliveries and cross-environment relay;
- output archive before resource release;
- operator links/status around terminals/worktrees.

## Blocking limitations

- decomposition/apex planning is explicitly absent;
- worker/task identity is terminal handle/pane/process/worktree centric;
- coordinator polls mutable rows rather than consuming a product event/reconciliation model;
- direct free-form messages are coordination state;
- decision gates are human checkpoints, not smallest-irreducible exception policy;
- no evidence-based disagreement/probe selection;
- no plan base revision/delta/supersession;
- no independent evaluation before task completion;
- no model substitution/role/context manifest contract at product layer.

## Extension point

Reuse task/attempt/capability/delivery/federation invariants, but create product assignments independent of panes. A deterministic reconciler owns status; a replaceable apex proposes versioned next actions.

---

# A4 — Evidence-seeking intelligence

## Source symbols and surfaces

| Area | Exact implementation evidence |
| --- | --- |
| AI Vault | session discovery/parsers/cache/coordinator; provider session identity, first prompts, previews, subagents, resume/delete and native/WSL/SSH scope. |
| Worker output | exact provider-session pin, bounded transcript reads, redacted archive and terminal fallback. |
| Artifacts | `src/shared/artifacts.ts`, `src/main/runtime/rpc/methods/artifacts.ts`, cloud publisher/recovery/create-intent/share-record stores and renderer list/publish/link flows. |
| Source control/reviews | Git status/history/diff/hosted review APIs and rich renderer surfaces. |
| Search/navigation | quick-open, repository/file views, browser integration and terminal/search surfaces. |
| UI | AI Vault rows/filters/previews, artifact tables, source-control trees/recovery prompts and terminal task links. |

## Representative tests

- AI Vault scanner/parser/cache/cancellation/SSH/WSL tests;
- worker transcript/archive tests;
- `src/main/runtime/rpc/methods/artifacts.test.ts`
- artifact sharing capability, create-intent, cloud recovery/race tests;
- renderer AI Vault identity/filter/resume/publication tests;
- source-control tree/diff/review/recovery tests.

## Proven behavior

- identifies exact source sessions/processes/artifacts;
- bounds, redacts and preserves inspectable output;
- shares/publishes artifacts behind explicit device gate and idempotent create intent;
- gives operators good code/session/source-control visibility.

## Blocking limitations

No product epistemic authority:

- observations and transcripts are not normalized `EvidenceItem`s;
- no proposition/assertion/support/refute graph;
- no contradictions/gaps/hypotheses/probe candidates;
- no accepted finding/impact review;
- no retrieval eligibility/ranking/citation acceptance;
- no immutable context manifest;
- no tenant-scoped evidence/object-retention domain.

## Extension point

Reuse visibility, source identity, artifact transport/recovery and UI interaction patterns. Build product evidence/epistemic/context services separately.

---

# A5 — Independent evaluation and self-correction

## Exact implementation evidence

Orca has feature-specific correctness/recovery surfaces:

- worker lifecycle/current-dispatch reconciliation;
- durable mutation receipt replay/unknown state;
- skill install/update convergence and transaction recovery;
- artifact cloud intent/recovery;
- Git/source-control errors and AI-assisted recovery prompts;
- orchestration compatibility/check formatting;
- extensive unit/integration/fault tests;
- operator visibility for outputs, failures and retries.

Examples:

- `src/main/runtime/orchestration/lifecycle-reconciliation.ts`
- `src/shared/orchestration-check-output.ts`
- `src/renderer/src/components/right-sidebar/source-control/sync/push-recovery.ts`
- `src/renderer/src/components/right-sidebar/source-control-push-recovery.test.ts`
- skill/artifact recovery modules and tests.

## Proven behavior

- rejects stale/unauthorized lifecycle claims;
- detects some failed/non-convergent feature operations;
- preserves/derives bounded recovery context;
- routes a user/agent to a corrective action for specific failures;
- has broad behavior/fault regression coverage.

## Blocking limitations

Static audit found no general:

- evaluator definition/version/calibration registry;
- exact subject/version evaluation contract/assignment;
- typed measures/threshold composition/verdict/coverage;
- producer/evaluator independence;
- deterministic + semantic evaluator composition;
- failed-measure epistemic diagnosis;
- new-subject-version correction loop;
- fixed acceptance contract and bounded correction budget;
- evaluator drift/revocation/affected-subject impact query.

Orchestration `worker_done: succeeded` remains lifecycle success. Caller/feature logic decides what it means.

## Extension point

Build product evaluation coordinator and correction lifecycle. Reuse Orca’s status/error/artifact/trace/operator patterns and fault-test discipline.

---

# A6 — Governed self-improvement

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| `src/shared/skill-package-manifest.ts` | strict `SkillPackageManifestV1Schema`, file identity/content SHA-256, package/version/name/time/size/path limits and deterministic package digest. |
| `src/shared/skill-bundle-manifest.ts` | strict bundle/plugin manifest and aggregate digest. |
| `src/main/skills/skill-bundle-creation.ts` | observes, stages, re-observes and packages exact skill sources. |
| `src/main/skills/skill-bundle-extraction.ts` | archive/file/package/bundle identity and containment verification. |
| `src/main/skills/skill-bundle-install-service.ts` | multi-skill preview/conflict/install result aggregation. |
| `src/main/skills/skill-placement-transaction.ts` | journaled placement recovery/finalization and receipt/state files. |
| `src/main/skills/skill-transaction-startup-recovery.ts` | bounded scan/locking/recovery across install/remove/placement/delete journals. |
| `src/main/skills/skill-update-run.ts` | bounded child process/output/cancel, update command and post-update disk rescan. |
| `src/main/skills/skill-update-convergence.ts` | known lock/disk revision convergence rather than trusting command exit status. |
| renderer skill components | runnable/binary/instruction risk, selection/conflicts, freshness/duplicate/unrecognized/broken-link/read-only status, install/update/remove progress. |

## Skill package/install protocol

```text
observe skill source
→ strict files + per-file identity/content hashes
→ package/version/bundle digest
→ archive creation/upload/grant
→ preview destination/current digest/conflicts/risk
→ journaled canonical install + provider placements
→ receipt/state/provenance
→ post-operation rescan/convergence
→ startup recovery on crash
```

## Representative tests

- `src/shared/skill-package-manifest.test.ts`
- `skill-path-containment.test.ts`
- `skill-bundle-install-contract.test.ts`
- `src/main/skills/skill-bundle-creation.test.ts`
- `skill-bundle-install-service.test.ts`
- `skill-wsl-install-transaction.integration.test.ts`
- `skill-process-contention.integration.test.ts`
- `skill-process-termination.integration.test.ts`
- `skill-transaction-startup-recovery.test.ts`
- `skill-update-run.test.ts`
- `skill-update-convergence.test.ts`
- `skill-cloud-service.test.ts`
- renderer install-risk/freshness/conflict/progress tests.

## Proven behavior

- portable immutable package/version identity;
- strong path/digest/archive checks;
- local/WSL/SSH/cloud install and sharing;
- crash/process/contention/cancellation recovery;
- actual disk convergence and freshness UI;
- user-facing executable-content risk.

## Blocking limitations

- no accepted-outcome/failure → `LearningCandidate` extraction;
- no immutable quarantined capability version lifecycle;
- no downstream baseline/held-out/adversarial behavioral evaluation;
- no target model/provider/harness/domain/authority certification envelope;
- install/freshness is not skill quality;
- no shadow/canary/active pointer;
- no exact per-use outcome trace, drift, automatic demotion/revocation/rollback/impact review.

## Extension point

Reuse package/digest/provenance/transaction/recovery/UI. Add product improvement lab and registry above installation; only certified compatible active versions become assignment-eligible.

---

# A7 — Bounded autonomous action

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| `db/worker-dispatch/worker-dispatch-authority.ts` | `prepareStartingWorkerAuthority`; transactionally mints random `dcap_` capability, stores hash, binds dispatch to handle/pane/process and records owned residual resources. |
| `db/federation/remote-dispatch-attachment-authority.ts` | `prepareRemoteAttachmentAuthority`, `verifyRemoteAttachmentAuthority`, `isRemoteAttachmentProcessCurrent`; timing-safe capability hash + pane/process verification and `start_unknown`. |
| `lifecycle-reconciliation.ts` | `reconcileLifecycleMessage`; task/dispatch/sender/pane/current-status validation and explicit rejection records. |
| `db/mutation-receipts/mutation-receipt-store.ts` | `beginMutationReceipt`, `completeMutationReceipt`, `discardPendingMutationReceipt`; caller/request/method/payload pending/completed identity. |
| `runtime/rpc/orchestration-mutation-executor.ts` | `OrchestrationMutationExecutor.run`; canonical payload hash, in-flight coalescing, completed replay and `operation_unknown` after restart. |
| `mutation-receipt-capacity.ts` | exact row/age policy and fail-closed unresolved-ledger capacity. |
| `db/worker-dispatch/federated-worker-start-reconcile.ts` | `reconcileFederatedWorkerStart`; ready/failed/stopped/`start_unknown` transitions and recovery. |
| `runtime/rpc/relay-transport.ts` | `CloudRelayTransport`; bounded WebSocket messages, origin validation, connection tickets/generation and stop close bounds. |
| `runtime/relay/relay-session-broker.ts` | `RelaySessionBroker`, `StaleRelayBrokerError`; identity/auth assignment, generation, region/reconnect/backoff/status. |
| `worker-terminal-release-reconciliation.ts` | `reconcileRequestedWorkerTerminalReleases`; only previously requested releases, preserves unknown/pending and never invents cleanup intent. |
| skill/artifact transaction/recovery code | concrete local effect identity, journal, receipt, backup/replace and restart reconciliation patterns. |

## Durable mutation protocol

```text
caller fingerprint + orchestration request ID + method + canonical payload hash
→ begin receipt
   - new: pending/started
   - same completed: replay receipt
   - same active: join promise
   - same pending after restart: operation_unknown/recovery
   - same ID different input: reject
→ feature mutation
→ durable receipt complete
```

## Dispatch capability protocol

```text
pending task/dispatch + exact pane/process/launch identity
→ random capability returned once; only hash persisted
→ every lifecycle/action validates current assignee/pane/process/capability state
→ settlement/release revokes capability
→ stale result remains rejected evidence
```

## Representative tests

- `src/main/runtime/orchestration/lifecycle-reconciliation.test.ts`
- `orchestration-mutation-ledger.test.ts`
- `mutation-receipt-capacity.test.ts`
- `db-task-dispatch-lifecycle-guards.test.ts`
- `federation-terminal-recovery.test.ts`
- `federation-acknowledgment-integrity.test.ts`
- `runtime/rpc/relay-transport.test.ts`
- `runtime/relay/relay-session-broker.test.ts`
- worker terminal release/recovery tests;
- skill/artifact process/crash/recovery/identity tests;
- cross-platform WSL/Windows/SSH integration tests.

## Proven behavior

- fine-grained dynamic capability and process-incarnation authority;
- stale/unauthorized lifecycle rejection;
- idempotent control mutations and explicit unresolved state;
- fail-closed capacity;
- relay sequencing/generation/reconnect and remote peer identity;
- residual resource and requested-release reconciliation;
- crash-safe local skill/artifact operations.

## Blocking limitations

No migration-domain:

- stable `EffectIntent` identity independent of terminal operation;
- workload identity/tenant/data-class policy;
- deterministic policy bundle/decision;
- exact target/method/parameter capability envelope with expiry/use/network/filesystem limits;
- short-lived secret lease outside model/log state;
- sandbox provider/image/attestation contract;
- provider-specific idempotency key semantics/retention;
- customer-zone pre-request journal/spool contract for target writes;
- signed `EffectReceipt` plus independent `TargetObservation`;
- applied/absent/unknown/reconciling/repair/compensation/quarantine state;
- external postcondition evaluation.

## Extension point

Adapt capability hashes, process identity, receipts, unknown states, stale rejection, relay and recovery semantics. Replace terminal/worktree IDs with tenant/workload/effect/target identities and add product effect gateway.

---

# UI and operability placement

## Strong reusable surfaces

| Surface | Proven value | Product adaptation |
| --- | --- | --- |
| AI Vault | Session identity, agent/model/time/worktree state, previews, subagents, resume/delete, scan issues. | Evidence/worker-run inspector by mission/assignment rather than raw transcript first. |
| Terminal/worktree status | Live agent/process/task relationship and direct operator control. | Keep as diagnostic drill-down; product task remains independent of pane. |
| Skills page | Package source/version/freshness/conflicts/runnable risk/install/update/remove. | Add certification envelope/status, active/stable/revoked, benchmark and downstream harm. |
| Artifacts | Bounded publish/share/list/recovery and explicit public-link gate. | Product evidence/artifact metadata, retention/classification and mission links; public sharing remains separate policy. |
| Source control/review | Rich file/diff/commit/review/error/recovery flows. | Useful for generated code artifacts, not migration truth. |
| Error/recovery UX | Exact failure snapshots, stale checks, retries, restart recovery and partial results. | Surface effect/evaluator/epistemic recovery with typed predicates. |

## Missing product console views

- mission objective/current plan revision;
- accepted findings, contradictions and open gaps;
- context manifests and source/citation coverage;
- independent evaluation measures/thresholds/verdicts;
- effect intents/capabilities/receipts/target observations;
- memory/skill certification/use/impact;
- smallest irreducible exception queue;
- replay/recovery timeline from one mission ID.

---

# Cross-cutting conclusions

## What to reuse directly

- renderer design system and operator-shell infrastructure;
- exact process/pane/provider-session/output-archive identity;
- skill/artifact package identity and recovery;
- typed RPC validation and bounded payloads;
- relay transport/generation/reconnect patterns.

## What to adapt semantically

- tasks → product assignments;
- dispatch contexts → attempts/fences;
- dispatch capabilities → workload/effect capability envelopes;
- mutation receipts → command/effect idempotency records;
- deliveries/mailboxes → outbox/inbox assignment/result transport;
- `start_unknown`/`stop_unknown` → general unknown external effect recovery;
- decision gates → exception records only when a question is irreducible;
- worker output archive → evidence records.

## What not to promote

- terminal handle/pane key as product worker identity;
- worktree as mission state;
- free-form task spec/message as decision/evidence authority;
- coordinator polling loop as the adaptive mission brain;
- worker `succeeded` as artifact/effect acceptance;
- installed/fresh skill as certified skill;
- artifact share receipt as evidence correctness;
- AI Vault transcript as fact memory.

## What must be new

- product domain command/event/projection/outbox kernel;
- epistemic and context compilers;
- replaceable apex next-action contract;
- evaluation and correction coordinator;
- governed memory/improvement lifecycle;
- migration effect gateway and target adapters;
- tenant/workload/data-class policy across all records.

---

# P1-RSCH-11 conclusion

Orca is not merely a terminal UI. It contains mature tested control-plane mechanics for external workers and local/remote operations:

- durable task/dispatch/message/delivery state;
- capability and process-incarnation authority;
- stale-result rejection;
- idempotent mutations with explicit unknown;
- federation/relay and resource recovery;
- exact provider transcript/output archives;
- strong skill/artifact package transactions and operator surfaces.

Those mechanics are unusually valuable. Their concrete domain, however, is terminals, panes, worktrees, agent sessions and desktop features.

Decision:

```text
Orca = operator/authoring shell + source of tested control patterns
OMP = replaceable model/tool worker runtime
new product kernel = sole mission/evidence/evaluation/effect authority
```

## Next coordinate

`P1-RSCH-12` — build the combined verified capability-to-code disposition map.
