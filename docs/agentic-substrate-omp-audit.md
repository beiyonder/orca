# OMP A0–A7 Code and Test Audit

## Coordinate and evidence boundary

`P1-RSCH-10` — exact OMP package, symbol, protocol, test, limitation, and extension-point audit.

Audited source:

- repository: `https://github.com/can1357/oh-my-pi.git`
- revision: [`b4e8e856ad40294167679a3f88417c07429fe59b`](https://github.com/can1357/oh-my-pi/tree/b4e8e856ad40294167679a3f88417c07429fe59b)
- tag: `v18.0.6`
- ignored local checkout: `tmp/upstream/oh-my-pi`
- installed executable observed earlier: `18.0.4`

Method:

- direct static inspection of source and representative tests at the pinned revision;
- exact symbols and contracts mapped below;
- no upstream code changed;
- upstream tests were inspected, not re-run as part of this documentation audit;
- maturity describes behavior in OMP’s coding-agent domain, not migration-product readiness.

## Executive verdict

| Capability | OMP maturity | Exact product disposition | Blocking gap |
| --- | --- | --- | --- |
| `A0` Tool agent | `M3` coding-agent integration | **Reuse** model/tool loop behind product worker boundary. | Product-specific tool/effect contracts and tenant isolation. |
| `A1` Stateful worker | `M3` session; `M1/M2` memory quality | **Reuse/adapt** session/context mechanics; wrap memory as non-authoritative backend. | Product context manifest, governed memory quality/use/impact. |
| `A2` Durable mission | `M1` patterns | **Pattern only**; build product mission kernel. | No tenant mission aggregate, authoritative state machine, expected-version command/event ledger or general reconciler. |
| `A3` Specialists | `M3` bounded coding fan-out; `M1` mission apex | **Reuse/adapt** structured specialist execution. | Child lifetime is parent/session/transcript based; no product-owned durable assignment authority or evidence-based apex. |
| `A4` Evidence seeking | `M2` tools; `M1` epistemic system | **Reuse** tools and experiment harness; build product epistemic/context services. | No durable facts/claims/gaps/contradictions/accepted findings or exact context manifest authority. |
| `A5` Self-correction | `M2` specialized primitives; `M0` universal gate | **Adapt** advisor/TTSR/Cleanse/security/metaharness patterns. | No evaluator registry, independent subject acceptance or fixed-contract correction state machine. |
| `A6` Self-improvement | `M2` local learning/experiments; `M0` governed lifecycle | **Reuse/adapt** packaging/safe writes/experiments; replace activation authority. | Managed skills can become active without quarantine, held-out certification, target envelope, use trace, drift/demotion/rollback. |
| `A7` Bounded action | `M3` worker host-tool boundary; `M0` migration effects | **Reuse** RPC host-tool seam; product owns policy/effects outside OMP. | No product effect ID, tenant/workload capability, secret lease, provider idempotency, target receipt/readback or unknown reconciliation. |

---

# Package and protocol map

## `packages/ai`

Responsibility:

- provider/model normalization;
- streaming message protocol;
- tool schema/wire conversion;
- tool argument validation;
- usage, errors, provider session state.

Relevant to: `A0`, `A1`.

Product boundary: provider protocol implementation, never mission authority.

## `packages/agent`

Responsibility:

- model/tool loop;
- canonical agent messages/events;
- tool hooks, cancellation and parallel execution;
- append-only provider context;
- compaction/pruning;
- telemetry and run collection.

Relevant to: `A0`, `A1`.

Product boundary: reusable worker engine.

## `packages/coding-agent`

Responsibility:

- interactive/headless sessions;
- JSONL session journal and artifacts;
- tools, context/rules/skills/extensions;
- RPC host boundary;
- tasks/subagents/IRC;
- goals/todos;
- advisor/TTSR/Cleanse/security;
- autoresearch/autolearn;
- Mnemopi/Hindsight adapters.

Relevant to: `A0`–`A7`.

Product boundary: coding harness whose mechanics are wrapped by product contracts.

## `packages/mnemopi`

Responsibility:

- SQLite memory facade;
- working/episodic/fact/graph/temporal retrieval;
- extraction/consolidation;
- triples and annotations;
- polyphonic retrieval;
- recovery/diagnostics.

Relevant to: `A1`, `A4`, `A6`.

Product boundary: optional memory retrieval backend, never accepted truth or skill authority.

## `packages/metaharness`

Responsibility:

- benchmark runs/traces;
- baseline/variant experiment arms;
- cost/pass/time summaries;
- persistent run manager/dashboard.

Relevant to: `A5`, `A6`.

Product boundary: experiment/evaluation harness candidate, not evaluator authority.

## `packages/wire` and `packages/omptype`

Responsibility:

- typed schemas and wire representations.

Relevant to: all capability RPC/result contracts.

Product boundary: reusable schema machinery if dependency cost is justified; product owns domain schemas.

---

# A0 — Tool agent

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| [`packages/agent/src/agent.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/agent/src/agent.ts) | `Agent`, `AgentOptions`, `AgentPromptOptions`, `AgentBusyError`; owns mutable session state, prompts/continues, steering/follow-up, abort, model/tools/config and event subscription. |
| [`packages/agent/src/agent-loop.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/agent/src/agent-loop.ts) | `agentLoop`, `agentLoopContinue`, `agentLoopDetailed`, `createToolScopedAbortReason`, `coerceToolResult`; streams model output, snapshots events, validates tool arguments, executes tool batches, synthesizes result/error boundaries and loops until terminal stop. |
| `packages/agent/src/types.ts` | `AgentTool`, `AgentToolResult`, `AgentContext`, `AgentEvent`, `AgentLoopConfig`, before/after tool hooks, pre-model gate, tool approval/load modes and steering queue types. |
| `packages/ai/*` | `streamSimple`, provider `Message`/`AssistantMessage`, `toolWireSchema`, `validateToolArguments`, provider session state and usage. |
| `packages/coding-agent/src/tools/*` | Read/grep/glob/write/edit/bash/eval/web/browser/task/hub/security and other concrete tool adapters. |

## Protocol

```text
AgentMessage prompt
→ agent_start / turn_start
→ provider stream snapshots
→ assistant toolCall blocks
→ schema argument validation
→ beforeToolCall
→ AgentTool.execute(id, params, signal, onUpdate, context)
→ tool_execution_start/update/end
→ afterToolCall
→ canonical ToolResultMessage
→ next model turn or terminal turn_end / agent_end
```

Important invariants:

- canonical internal messages remain provider-neutral;
- subscribers receive detached streaming snapshots;
- malformed tool results are coerced into explicit failures;
- abort creates defined assistant/tool-result boundaries;
- parallel tool calls preserve result identity/order contracts;
- pre-model and tool hooks can stop/alter bounded parts of a run;
- provider-specific in-band dialects are converted at the wire boundary.

## Representative tests

- `packages/agent/test/agent.test.ts`
- `packages/agent/test/agent-loop.test.ts`
- `packages/agent/test/prompt-tools-loop.test.ts`
- `packages/agent/test/proxy-toolcall-partial-json.test.ts`
- `packages/agent/test/proxy-stream-disconnect.test.ts`
- `packages/agent/test/pause-gate.test.ts`
- `packages/agent/test/continue-empty-transcript.test.ts`
- `packages/coding-agent/test/agent-session-event-order.test.ts`
- `packages/coding-agent/test/agent-session-tool-call-loop-guard.test.ts`

Covered contract families:

- busy/reset/message state;
- validation/execution/result coercion;
- parallel calls, scoped abort and steering;
- stream interruption/provider recovery;
- immutable event snapshots;
- in-band tool dialect normalization;
- tool-loop and empty-stop guards.

## Limitation

`Agent` knows conversations and tools. It has no tenant mission, authoritative decision, effect identity or acceptance state.

## Extension point

Use `Agent`/`AgentSession` behind a product `SpecialistAssignment` adapter. Supply exact model/tools/context/output schema; convert every result to proposal/evidence.

---

# A1 — Stateful worker

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| [`packages/coding-agent/src/session/session-manager.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/session/session-manager.ts) | `SessionManager`, internal `SessionEntryIndex`, `SessionPersistenceIndeterminateError`; append-only JSONL entries, branches/tree/forks, artifact/blob storage, usage, atomic rewrite/queue and fail-closed indeterminate persistence. |
| [`packages/coding-agent/src/session/agent-session.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/session/agent-session.ts) | `AgentSession`; integrates `Agent`, `SessionManager`, tools, prompts, hooks, retries, compaction, goals/todos, advisor/TTSR/IRC, memory backends and persistence. |
| [`packages/agent/src/append-only-context.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/agent/src/append-only-context.ts) | `StablePrefix`, `AppendOnlyLog`, `AppendOnlyContextManager`; freezes system/tool prefix, appends provider messages and fingerprints exact context. |
| `packages/agent/src/compaction/*` | remote/local/snap compaction, pruning, shake, tool-result protection, summaries and context budgets. |
| [`packages/mnemopi/src/core/memory.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/mnemopi/src/core/memory.ts) | `Mnemopi`, `remember`, `recall`, `recallEnhanced`, `forget`, `update`, `sleep`, scratchpad and bank-scoped facade. |
| `packages/mnemopi/src/core/orchestrator.ts` | `orchestrateRecall`; selects linear/polyphonic recall and optional embeddings. |
| `packages/mnemopi/src/core/polyphonic-recall.ts` | `PolyphonicRecallEngine`, `polyphonicRecall`; vector/graph/fact/temporal voices with fused scores. |
| `packages/coding-agent/src/mnemopi/backend.ts` | `mnemopiBackend`, `resolveMemoryCompletionInput`; session scope, first-turn/compaction integration and memory tools. |
| `packages/coding-agent/src/hindsight/backend.ts` | `hindsightBackend`, `reloadMentalModelsForSession`; remote bank/tag-scoped memory and mental-model context. |

## Session protocol

```text
SessionHeader
+ append-only SessionEntry JSONL
  - message
  - model/config/context/compaction metadata
  - custom goal/todo/IRC/security/autoresearch records
+ artifact directory / blob store
+ current leaf/tree projection
```

The session journal is worker conversation history. It is not the product mission ledger.

## Representative tests

- `packages/coding-agent/test/session-manager-immediate-persist.test.ts`
- `session-manager-atomic-rewrite-race.test.ts`
- `session-manager-close-race.test.ts`
- `session-storage.test.ts`
- `session-persistence-images.test.ts`
- `agent-session-branching.test.ts`
- `agent-session-compaction.test.ts`
- `agent-session-compaction-cancellation.test.ts`
- `packages/agent/test/append-only-context.test.ts`
- `compaction-boundary.test.ts`
- `tool-protection.test.ts`
- `packages/mnemopi/test/memory-facade.test.ts`
- `polyphonic-recall.test.ts`
- `temporal-recall.test.ts`
- `recovery.test.ts`
- `consolidate-fact-concurrency.test.ts`
- `packages/coding-agent/test/agent-session-memory-backend.test.ts`

## Limitation

- session identity and state are coding conversation concepts;
- compaction is intentionally lossy;
- local/remote memory ranking and consolidation are not product acceptance;
- no required `ContextManifest` records exact eligible/retrieved/excluded/redacted evidence for a product assignment;
- no memory candidate/certification/use/impact lifecycle.

## Extension point

- create a fresh/reconstructable OMP session per product assignment or bounded continuation;
- generate explicit context from product records;
- persist OMP session/transcript/artifacts as evidence;
- treat Mnemopi/Hindsight as adapter-backed retrieval candidates through product memory governance.

---

# A2 — Durable mission

## Source symbols and patterns

| File | Exact symbols / behavior |
| --- | --- |
| `packages/coding-agent/src/goals/state.ts` | `Goal`, `GoalModeState`, `GoalStatus`, `GoalRuntimeEvent`; one objective, token/time accounting and active/paused/budget-limited/complete/dropped states. |
| `packages/coding-agent/src/goals/runtime.ts` | `GoalRuntime`, `renderTrustedObjective`, `renderGoalPrompt`, `goalTokenDelta`, `completionBudgetReport`; continuation and budget steering inside one session. |
| `packages/coding-agent/src/goals/tools/goal-tool.ts` | `GoalTool`; create/get/complete/resume/drop operations. |
| `packages/coding-agent/src/session/todo-tracker.ts` | `TodoTracker`; canonical phased todo state, eager/mid-run reminders and completion checks. |
| `packages/coding-agent/src/autoresearch/storage.ts` | `AutoresearchStorage`; durable SQLite experiment session/run state. |
| `packages/coding-agent/src/autoresearch/state.ts` | experiment baseline/best/confidence reconstruction. |
| `SessionManager` | durable worker journal and custom records. |

## Representative tests

- `packages/coding-agent/test/goals/goal-runtime.test.ts`
- `goals/goal-tool.test.ts`
- `goals/goal-mode-integration.test.ts`
- `agent-session-goal-midrun-compaction.test.ts`
- `agent-session-todo-blocker-clone.test.ts`
- `agent-session-todo-mid-run-nudge.test.ts`
- `agent-session-todo-reminder-loop.test.ts`
- `autoresearch-state.test.ts`
- `autoresearch-tools.test.ts`

## Proven behavior

- a session goal survives journal/reconstruction paths;
- continuation and token/time budget are explicit;
- todos track phase/item state and guard reminder loops;
- autoresearch survives/reconstructs experiment runs and commits/reverts variants.

## Blocking limitations

No general:

- tenant/mission aggregate and expected version;
- evidence/gap/decision/plan/effect/evaluation domain records;
- command idempotency across product callers;
- transactional event + projection + outbox;
- durable lease/fence/attempt semantics;
- deterministic reconciler over every nonterminal mission state;
- impact/recovery query independent of an OMP session.

## Extension point

None of the OMP goal/todo/autoresearch stores should be promoted to product authority. Use them as worker UX or experiment patterns. Product kernel dispatches OMP through RPC.

---

# A3 — Specialist orchestration

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| [`packages/coding-agent/src/task/structured-subagent.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/task/structured-subagent.ts) | `StructuredSubagentRequest`, `EffectiveSubagentPolicy`, `StructuredSubagentResult`, `resolveEffectiveSubagentPolicy`, `reserveStructuredSubagentId`, `runStructuredSubagent`; validates model/tools/depth/spawn/schema/isolation before artifacts and execution. |
| `packages/coding-agent/src/task/types.ts` | `TaskItem`, `TaskParams`, `AgentDefinition`, `SingleResult`, `AgentProgress`, `StructuredSubagentOutput`, task schemas, output caps and event channels. |
| [`packages/coding-agent/src/task/executor.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/task/executor.ts) | subagent settings/model fallback, budgets, event forwarding, MCP proxy, schema/yield finalization, cancellation, usage and artifact capture. |
| `packages/coding-agent/src/task/spawn-policy.ts` | `resolveSpawnPolicy`, `canSpawnAtDepth`; default/allowlist/disabled child policy and recursion cap. |
| `packages/coding-agent/src/task/isolation-runner.ts` / `worktree.ts` | optional isolated worktree execution, patch recovery and apply/merge ownership. |
| [`packages/coding-agent/src/registry/agent-registry.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/registry/agent-registry.ts) | `AgentRegistry`, `AgentRef`; process-global main/sub/advisor identity, running/idle/parked/aborted state and historical metrics. |
| `packages/coding-agent/src/registry/agent-lifecycle.ts` | `AgentLifecycleManager`; adopt, park, revive, tombstone and stale-async protection. |
| `packages/coding-agent/src/irc/bus.ts` | `IrcBus`, `IrcMessage`, `IrcDeliveryReceipt`; bounded process-global mailboxes, send/wait, wake/revive and reply correlation. |
| `packages/coding-agent/src/session/irc-bridge.ts` | `IrcBridge`; queues peer messages, injects at safe boundaries, wakes idle agents and persists missed messages. |
| `packages/coding-agent/src/tools/hub/messaging.ts` | `executeList`, `executeSend`, `executeMessageWait`, `executeInbox`; roster and messaging surface. |
| `packages/coding-agent/src/tools/hub/jobs.ts` | `visibleJobs`, `snapshotJobs`, `executeCancel`, `executeJobsSnapshot`; owner-filtered job lifecycle. |
| `packages/coding-agent/src/modes/rpc/rpc-subagents.ts` | RPC projection and transcript reads for subagent lifecycle/progress/events. |

## Task/subagent protocol

```text
TaskItem
  assignment, agent, model, tools, effort, output schema/mode,
  plan controls, isolation/apply/merge, label
→ policy/depth/spawn/tool/isolation preflight
→ session-global agent ID + artifact lease
→ child AgentSession / optional worktree
→ progress/event/lifecycle channels + registry
→ yield/structured result, usage, artifacts, patch/recovery hints
→ idle/park/revive or final release
```

## Representative tests

- `packages/coding-agent/test/task/structured-subagent.test.ts`
- `task/task-schema.test.ts`
- `task/task-preflight.test.ts`
- `task/task-guards.test.ts`
- `task/task-spawn.test.ts`
- `task/task-batch.test.ts`
- `task/task-blocking-split.test.ts`
- `task-executor-mcp-parity.test.ts`
- `task-executor-mcp-timeout.test.ts`
- `rpc-subagents.test.ts`
- `agent-session-eager-task.test.ts`
- hub/IRC/registry tests under `test/tools`, `test/registry`, and advisor/task coordination tests.

## Proven behavior

- typed specialist definitions and caller/agent/session output schemas;
- strict mode can fail invalid schema output;
- model/tool/depth/spawn policies;
- bounded concurrency and request/output budgets;
- optional worktree isolation and recovery artifacts;
- agent lifecycle/parking/revival and peer messaging;
- async job delivery and owner-scoped visibility.

## Blocking limitations

- task child is owned by a parent OMP session/executor;
- registry and IRC bus are process-global/in-memory with transcript recovery, not tenant mission authority;
- direct peer messages can alter model context without product epistemic admission;
- child success/yield is not product acceptance;
- no mission `Assignment`/`Attempt` expected-version/fence state;
- no apex policy that reads durable product blackboard and proposes one versioned `PlanDelta`;
- no evidence-based disagreement resolution or mission completion predicate.

## Extension point

Wrap one product `SpecialistAssignment` around one top-level OMP RPC worker. Nested OMP tasks remain optional micro-work and their outputs collapse into the parent assignment result/evidence.

---

# A4 — Evidence-seeking intelligence

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| `packages/coding-agent/src/tools/read.ts` | bounded file/directory/archive/document/image/database/URL/internal-resource reads with structural summaries, range selectors and artifacts. |
| `packages/coding-agent/src/tools/grep.ts` / `glob.ts` | scoped code/text discovery. |
| `packages/coding-agent/src/web/search/index.ts` | `WebSearchTool`, `runSearchQuery`, `executeSearch`; strict query schema, provider fallback, normalized sources and bounded rendering. |
| `packages/coding-agent/src/web/search/providers/*` | public/authenticated search provider adapters. |
| `packages/coding-agent/src/web/scrapers/*` | source-specific extraction/normalization. |
| `packages/coding-agent/src/autoresearch/types.ts` | `ExperimentState`, `ExperimentResult`, metric/status/scope/constraint records. |
| `packages/coding-agent/src/autoresearch/tools/*` | initialize, execute, log and annotate experiments. |
| `packages/mnemopi/src/core/triples.ts` | `TripleStore`, temporal/source/confidence fields and query/import. |
| `packages/mnemopi/src/core/annotations.ts`, `veracity-consolidation.ts` | annotation/conflict/supersession-oriented memory patterns. |
| `packages/coding-agent/src/system-prompt.ts`, `sdk.ts`, context-file/rule/skill discovery | constructs worker evidence context from project/user sources. |

## Evidence/retrieval protocol

Tool results contain source text/URLs/paths and details, then become session messages/artifacts. They are strong evidence inputs but OMP does not normalize them into an authoritative proposition/justification ledger.

## Representative tests

- `packages/coding-agent/test/read-tool.test.ts`
- `read-single-pass.test.ts`
- `read-multi-range.test.ts`
- `read-summary.test.ts`
- `tools/read-artifact-large.test.ts`
- `tools/web-search-public.test.ts`
- `tools/web-search-parallel.test.ts`
- provider-specific `tools/web-search-*.test.ts`
- `discovery/context-file-dedup.test.ts`
- `agent-session-context-file-reload.test.ts`
- `autoresearch-state.test.ts`
- `autoresearch-tools.test.ts`
- Mnemopi `triples-data-dir.test.ts`, `statement-lifetime.test.ts`, `veracity-consolidation.test.ts`, `recall-precision-regressions.test.ts`.

## Blocking limitations

No product-owned:

- `EvidenceItem`/`Assertion`/`Proposition`/`AcceptedFinding` distinction;
- support/refute/derive/applicability graph;
- contradiction/gap/probe/impact lifecycle;
- source eligibility and claim-specific acceptance;
- immutable `ContextManifest` with inclusions/exclusions/redactions;
- denial/absence distinction as authoritative state;
- tenant-scoped evidence admission.

## Extension point

Reuse OMP read/search/browser/eval tools through evidence adapters. Product context compiler sends exact admitted records; tool output returns as candidate evidence requiring epistemic admission.

---

# A5 — Independent evaluation and self-correction

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| [`packages/coding-agent/src/advisor/runtime.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/advisor/runtime.ts) | `AdvisorRuntime`, `quarantineAdvisorUnsafeOutput`, `AdvisorOutputQuarantinedError`; separate advisor stream/context, batching, secret scrubbing, unsafe-output quarantine, retry/watchdog. |
| `packages/coding-agent/src/session/ttsr-coordinator.ts` | `TtsrCoordinator`; stream/tool pattern matching, interrupt, rule injection and resume gates. |
| [`packages/coding-agent/src/cleanse/loop.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/cleanse/loop.ts) | `runCleanseLoop`, `CleanseLoopDependencies`; stream diagnostics, bounded file ownership/repair workers, late follow-up and post-repair verification. |
| `packages/coding-agent/src/cleanse/checkers.ts` | `discoverCleanseDiagnosticSuite`, `buildCustomCleanseSuite`; language/project checker discovery and re-runnable verification suite. |
| [`packages/coding-agent/src/security/coordinator.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/security/coordinator.ts) | `SecurityCoordinator`; read-oriented security session, operation phases, plan/scan/bundle persistence and publication. |
| `packages/coding-agent/src/security/contracts/types.ts` | finding/evidence/provenance/coverage/validation/disposition/producer/model/account types. |
| `packages/coding-agent/src/security/comparison.ts` | `compareSecurityProducers`, `compareSecurityLineage`. |
| `packages/coding-agent/src/tools/review.ts` | structured priority/file/line/confidence finding parser. |
| `packages/metaharness/src/benchmarks.ts`, `runner.ts` | normalized benchmark metrics/traces, pass/fail/error, cost and resume. |

## Representative tests

- `packages/coding-agent/test/advisor/advisor.test.ts`
- `advisor-context-maintenance.test.ts`
- `advisor-tool-call-loop-guard.test.ts`
- `advisor-watchdog.test.ts`
- `ttsr-inline-flags-scope.test.ts`
- `cleanse.test.ts`
- `security/contracts.test.ts`
- `security/coordinator.test.ts`
- `security/comparison.test.ts`
- `security/seeded-fixture.test.ts`
- `packages/metaharness/test/benchmarks.test.ts`
- `runner.test.ts`

## Proven behavior

- independent advisory model/context with untrusted-output handling;
- deterministic rule interrupts;
- a concrete diagnose → repair → verify loop;
- typed security finding/evidence/coverage/validation and producer comparison;
- benchmark/trial normalization.

## Blocking limitations

No universal:

- `EvaluatorDefinition`/version/calibration registry;
- exact subject/version/digest `EvaluationContract` and assignment;
- immutable typed measure/verdict/coverage result;
- producer/evaluator independence policy;
- hard-gate composition;
- failed-measure diagnosis into epistemic gaps;
- fixed-contract subject-version correction loop;
- evaluator revocation/affected-subject query.

## Extension point

Adapt Cleanse’s deterministic verify structure and security contracts. Run evaluator specialists through strict OMP subagents when semantics require them, but keep verdict/acceptance in product state.

---

# A6 — Governed self-improvement

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| [`packages/coding-agent/src/autolearn/controller.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/autolearn/controller.ts) | `AutoLearnController`, `buildAutoLearnInstructions`; experimental substantive-turn heuristic, abort/plan/goal exclusions and isolated capture turn. |
| [`packages/coding-agent/src/autolearn/managed-skills.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/autolearn/managed-skills.ts) | `writeManagedSkill`, `deleteManagedSkill`, `sanitizeSkillName`; isolated path, byte cap, same-name serialization, symlink/hard-link defenses and atomic create. |
| `packages/coding-agent/src/tools/manage-skill.ts` | `ManageSkillTool`; strict create/update/delete with authored-skill non-shadowing and live refresh. |
| `packages/coding-agent/src/capability/skill.ts`, `extensibility/skills.ts` | `Skill`, `SkillFrontmatter`, `loadSkills`, `buildSkillPromptMessage`; Agent Skills-compatible discovery/injection. |
| `packages/coding-agent/src/autoresearch/types.ts` | `ExperimentResult`, `ExperimentState`, keep/discard/crash/checks-failed and scope/constraint/metric records. |
| `packages/coding-agent/src/autoresearch/storage.ts` | `AutoresearchStorage`; SQLite session/run state. |
| `packages/coding-agent/src/autoresearch/tools/log-experiment.ts` | `createLogExperimentTool`; records metric/metadata/scope deviations, flags suspect runs, commits keep and reverts discard/failure. |
| `packages/metaharness/src/experiments.ts` | `buildExperiments`, `experimentDetail`, `summarizeArm`, `calibratedFinalPassPct`; baseline/variant arms and trace merging. |

## Representative tests

- `packages/coding-agent/test/autolearn-controller.test.ts`
- `autolearn-managed-skills.test.ts`
- `autolearn-tools-gating.test.ts`
- `autolearn-discovery.test.ts`
- `autoresearch-state.test.ts`
- `autoresearch-tools.test.ts`
- `autoresearch-git.test.ts`
- `packages/metaharness/test/experiments.test.ts`
- `manager.test.ts`

## Proven behavior

- safe local managed-skill file mutation;
- isolated automatic capture turn and feature gating;
- prompt/skill packaging/discovery;
- durable bounded experiments, baseline/best metrics, scope deviations, flags and git keep/revert;
- benchmark arm/cost/pass projections.

## Blocking limitations

- model decides candidate value;
- managed skill can refresh into the active/future skill set immediately;
- no immutable quarantine/candidate/version registry;
- no frozen train/selection/held-out/adversarial split;
- no target-model/harness/domain/authority envelope;
- no independent baseline certification or protected slices;
- no shadow/canary/promotion decision;
- no exact capability use/outcome trace, drift, demotion, revocation, rollback or impact review.

## Extension point

Replace `manage_skill` activation with product `LearningCandidate`. Reuse Agent Skills packaging and OMP experiment mechanics only after product evaluator/corpus/registry governance.

---

# A7 — Bounded autonomous action

## Source symbols

| File | Exact symbols / behavior |
| --- | --- |
| [`packages/coding-agent/src/modes/rpc/host-tools.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/modes/rpc/host-tools.ts) | `RpcHostToolBridge`, internal `RpcHostToolAdapter`, `isRpcHostToolResult`, `isRpcHostToolUpdate`; host definitions, strict schema, call/update/result/cancel correlation, disconnect rejection. |
| `packages/coding-agent/src/modes/rpc/rpc-types.ts` | `RpcCommand`, `RpcResponse`, `RpcHostToolDefinition`, host call/cancel/update/result frames and subagent/session commands. |
| `packages/coding-agent/src/modes/rpc/rpc-frame.ts` | `RpcFrameEncoder`, `RpcFrameDecoder`, `encodeRpcFrame`; 1 MiB physical and 64 MiB reassembled limits, v2 chunking and overflow compaction. |
| [`packages/coding-agent/src/tools/approval.ts`](https://github.com/can1357/oh-my-pi/blob/b4e8e856ad40294167679a3f88417c07429fe59b/packages/coding-agent/src/tools/approval.ts) | `resolveToolTier`, `resolveApproval`, `requiresApproval`; read/write/exec, allow/deny/prompt, per-tool/argument-dependent policy and mode resolution. |
| `packages/coding-agent/src/tools/bash.ts` | `BashTool`, `CRITICAL_BASH_PATTERNS`, segment-aware approval matching, timeout/async/PTY/process/output/artifact handling. |
| specialized file/skill/worktree tools | path containment, symlink/hard-link checks, atomic writes and recovery patterns. |
| `packages/coding-agent/src/security/coordinator.ts` | fixed read-oriented tool allowlist for security sessions. |

## RPC host-tool protocol

```text
host set_host_tools(definitions)
→ OMP exposes strict adapter to model
→ host_tool_call { id, toolCallId, toolName, arguments }
→ optional host_tool_update { id, partialResult }
→ host_tool_result { id, result, isError }

abort/disconnect
→ host_tool_cancel { targetId }
→ local pending promise rejects
```

Call ID is an RPC correlation ID, not a durable external-effect identity.

## Representative tests

- `packages/coding-agent/test/rpc-host-tools.test.ts`
- `rpc-frame.test.ts`
- `rpc-malformed-input.test.ts`
- `tools/approval.test.ts`
- `tools/approval-mode.test.ts`
- `tools/ssh-url-approval-gate.test.ts`
- `bash-executor.test.ts`
- `bash-failure-result.test.ts`
- `bash-execution-clamp.test.ts`
- `agent-session-bash-session-ownership.test.ts`
- `task/structured-subagent.test.ts` isolation cases.

## Proven behavior

- host-controlled tool inventory and implementation;
- strict schema and correlated updates/results;
- best-effort cancellation and fail-closed disconnect;
- read/write/exec approval with hard deny and critical Bash patterns;
- bounded frames, time/output and process controls;
- worktree/local isolation for coding tasks.

## Blocking limitations

No product:

- stable `EffectIntent.effect_id` across attempts;
- tenant/workload identity and exact target designation;
- deterministic policy decision/version;
- expiring/fenced capability envelope;
- short-lived non-model-visible secret lease;
- default-deny network/filesystem sandbox profile;
- provider idempotency contract/key retention;
- pre-request durable journal;
- signed receipt plus independent target observation;
- explicit applied/absent/unknown/reconciling state;
- compensation/repair/quarantine lifecycle.

Cancellation only proves the OMP promise stopped; it cannot prove an external target write did not land.

## Extension point

Expose narrow product host tools whose implementation is the product effect gateway. Never pass broad cloud/source/target credentials or general shell authority to OMP.

---

# Cross-cutting protocol conclusions

## Canonical worker protocol: reuse

Reuse:

- `AgentMessage`/`AgentEvent` lifecycle;
- strict `AgentTool` schemas and tool-call identity;
- RPC JSONL framing/chunking;
- host-tool call/update/result/cancel;
- session journal/artifact capture;
- strict structured subagent results.

Product adapter adds:

- tenant/mission/assignment/attempt/fence IDs;
- exact context manifest;
- model/tool/skill/evaluator versions;
- result evidence/provenance;
- product acceptance independent of OMP result.

## Session persistence: evidence, not authority

Store OMP session file, transcript and artifacts as worker evidence. Do not reconstruct mission truth by parsing conversation.

## Nested tasks: micro-work only

OMP nested subagents may accelerate bounded work inside one product assignment. Product ledger sees one parent assignment result with nested provenance/artifacts.

## Memory: adapter only

Mnemopi/Hindsight may retrieve or propose candidate memory. Product registry decides eligibility, validation, use and invalidation.

## Approvals: defense in depth

OMP approval modes and Bash patterns remain useful worker controls. Product deterministic policy/capability/effect protocol is still required.

---

# Exact version-skew risk

Audited source is `18.0.6`; installed executable was observed as `18.0.4`.

Before product integration:

1. select and pin one OMP executable/source version;
2. run RPC negotiation, frame limit, host-tool cancel, strict subagent schema, session persistence and artifact probes against that binary;
3. record supported feature fingerprint—not only semver;
4. reject/disable unavailable protocol fields safely;
5. keep a compatibility fixture for the minimum supported OMP version;
6. never assume upstream main/tag behavior from the locally installed binary.

## Required worker contract probe

One executable probe must verify:

- protocol negotiation;
- `set_host_tools` strict schema;
- bounded host call/update/result;
- cancel/disconnect behavior;
- exact session/artifact paths;
- strict structured subagent invalid-result failure;
- subagent lifecycle/progress visibility;
- context/tool version recording;
- no unmanaged production tool access.

---

# P1-RSCH-10 conclusion

OMP is not a blank agent SDK. It already provides production-grade coding-session mechanics in A0/A1, strong bounded specialist execution in A3, extensive evidence tools, and meaningful correction/learning/action primitives.

The product cut is nevertheless clear:

- **reuse OMP as replaceable worker runtime;**
- **adapt its task/context/evaluation/experiment patterns;**
- **never make OMP session, goal, todo, task registry, IRC, memory, managed skill, advisor verdict, approval or RPC call ID product authority.**

The first substrate slice needs only:

```text
product assignment
→ exact ContextManifest
→ one top-level OMP RPC worker
→ narrow read/artifact tools
→ strict typed proposal/evidence result
→ product evaluator and reconciler decide acceptance
```

## Next coordinate

`P1-RSCH-11` — exact Orca A0–A7 source/protocol/test audit.
