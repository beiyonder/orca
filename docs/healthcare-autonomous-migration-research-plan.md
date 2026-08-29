# Autonomous Migration Engineering System: Research and Build Plan

## Decision

Do not jump directly to a full sample migration.

We do not yet have a proven migration-specific agent system, orchestration model, knowledge base, evaluator stack, memory design, self-correction loop, or validated product architecture. The existing architecture is a strong hypothesis, not an earned implementation decision.

Phase 1 research and exact Orca/OMP placement are complete. The next milestone is a reproducible isolated lab that can falsify the selected Slice S1 contracts before product implementation.

Sample systems and sample data belong early, but as research and component-testing material. A full end-to-end migration dry run comes after the core parts work independently.

## Product thesis

The customer is not expected to design the migration.

Customers and stakeholders will often provide:

- a loose business outcome;
- incomplete or contradictory documents;
- poor source-system knowledge;
- old diagrams and stale assumptions;
- difficult legacy systems and bad data;
- access, priorities, and unavoidable legal or business constraints.

The product must:

- discover what actually exists;
- test and reject bad claims;
- find missing systems, data, dependencies, and semantics;
- reduce gaps through research, inspection, comparison, and safe experiments;
- make technical decisions;
- make evidence-backed functional decisions;
- coordinate specialist agents through an apex engineering agent;
- build and execute the migration;
- independently evaluate the result;
- recover from failure and unknown outcomes;
- remember proven knowledge and failures;
- improve skills, tools, routing, and models only when measured results improve.

The customer should see what was discovered, disproven, decided, executed, accepted, rejected, and still unknown. The customer should not become a routine approval queue.

Human input is reserved for exceptions such as:

- irreducible business meaning;
- legal or assigned accountability;
- missing physical or system access;
- a true evidence tie that safe investigation cannot resolve;
- an irreversible, high-impact change;
- a customer-mandated intervention.

## Current foundations

### What OMP provides

OMP is a strong candidate intelligence-worker foundation:

- model and tool execution loop;
- typed tools and structured output;
- RPC mode;
- context construction and compaction;
- agents and subagents;
- memory interfaces;
- model/provider switching;
- coding, LSP, and debugging tools;
- task coordination primitives.

OMP is not yet proven as the complete migration runtime. We must test long-running mission continuity, apex-agent behavior, deep orchestration, memory quality, isolation, recovery, evaluation integration, and operation at realistic agent/task counts.

### What Orca provides

Orca is a strong candidate operator and engineering-experience foundation:

- operator UI patterns;
- remote and SSH execution patterns;
- terminal, workspace, and debugging tools;
- process supervision and reconnect behavior;
- task and orchestration precedents;
- artifact viewing and operator visibility.

Orca is not the authoritative migration control plane. Desktop state, terminals, panes, worktrees, and local process state cannot own a long-running customer migration.

### What is missing

We do not yet have:

- a working migration apex agent;
- typed specialist-agent contracts;
- proven multi-agent coordination and disagreement resolution;
- a migration research and reference corpus;
- broad platform and legacy-system knowledge;
- healthcare functional expertise and evaluation assets;
- a source-estate discovery engine;
- a benchmark and adversarial corpus;
- independent migration evaluators;
- tested self-correction and skill-promotion loops;
- evaluated mission, episodic, semantic, procedural, and failure memory;
- a proven authority/evidence kernel;
- tested source and target connectors;
- successful component dry runs;
- a successful end-to-end migration dry run.

## Weights are not the product moat

Model weights provide useful reasoning and prior knowledge. They are not enough for this domain.

The complete system becomes the expert through the combination of:

- model reasoning;
- source and target discovery;
- current external research;
- platform-specific tools;
- structured, cited knowledge;
- certified skills;
- independently accepted prior runs;
- failure and incident memory;
- deterministic and independent evaluation;
- safe experiments;
- self-correction;
- specialist-agent orchestration.

The moat is not a model that sounds knowledgeable. The moat is a system that repeatedly finds reality, makes better decisions, catches its own mistakes, delivers working migrations, and improves from verified outcomes.

## Sample corpus versus sample migration

### Build a sample corpus early

The research and evaluation lab should collect representative, legally usable material such as:

- legacy database schemas and catalogs;
- stored procedures, queries, ETL code, and schedules;
- CDC logs and checkpoint histories;
- schema changes, deletes, late data, duplicates, and corrupt records;
- data lineage and downstream-consumer examples;
- source and target platform documentation;
- migration designs and runbooks;
- successful and failed migration reports;
- operational incidents and recovery traces;
- healthcare standards, implementation guides, and synthetic/de-identified examples;
- cloud, identity, networking, security, and cost examples.

Every corpus item needs provenance, version, license or use permission, data classification, owner, applicability, and freshness policy.

### Delay the complete migration dry run

A complete dry run should happen only after the system can explain what each failure means. Otherwise it becomes a demo that generates artifacts without teaching us whether the architecture works.

Before the full dry run, atomic experiments must prove discovery, orchestration, state, memory, evaluation, correction, skill lifecycle, effect safety, and recovery.

## Atomic system breakdown

### 1. Mission and product brain

Purpose: turn a loose outcome into a living technical mission.

Required capabilities:

- interpret goals without inventing requirements;
- discover scope instead of assuming it;
- track facts, claims, hypotheses, gaps, risks, and decisions;
- generate and revise success criteria;
- choose the next highest-value investigation;
- decide when evidence is sufficient;
- isolate the smallest exception that requires a human.

### 2. Source-estate discovery

Purpose: learn what actually exists.

Required capabilities:

- system and asset inventory;
- schema and metadata inspection;
- data profiling and quality analysis;
- code, query, and transformation analysis;
- lineage and dependency discovery;
- schedules and workload behavior;
- CDC, ordering, delete, and amendment behavior;
- identity, permission, and operational discovery;
- contradiction detection across documents and observed evidence.

### 3. Gap detection

Purpose: know what is missing, conflicting, stale, or unsupported.

Every material statement should be typed as one of:

- observed fact;
- externally documented fact;
- customer or stakeholder claim;
- model hypothesis;
- conflicting evidence;
- open question;
- disproven claim.

The system must find undocumented transforms, hidden consumers, ambiguous fields, missing history, broken source behavior, and unsupported target assumptions.

### 4. Gap resolution

Purpose: resolve uncertainty before escalating.

Default resolution order:

1. inspect more source or target evidence;
2. retrieve trusted and current documentation;
3. compare analogous systems and prior accepted migrations;
4. run a safe query, probe, or experiment;
5. generate competing explanations;
6. choose the cheapest test that separates them;
7. ask independent specialist agents;
8. ask a human only when the evidence cannot resolve the issue.

### 5. Platform and data-engineering expertise

The capability system must eventually cover, within explicitly tested envelopes:

- relational and legacy data sources;
- files, APIs, events, object stores, and ETL products;
- AWS, GCP, Azure, on-premises, and hybrid environments;
- Databricks, Snowflake, BigQuery, Redshift, and other selected targets;
- snapshots, CDC, backfill, schema evolution, late data, deletes, replay, lineage, quality, observability, performance, cost, cutover, and recovery;
- networking, identity, secrets, private connectivity, and Kubernetes.

This knowledge must be split across reference material, tools, skills, evaluators, and proven traces. It must not live only in prompts.

### 6. Functional and domain expertise

Purpose: preserve business meaning, not merely row counts.

Required capabilities include:

- infer meaning from data behavior, source code, reports, consumers, standards, and history;
- distinguish technical mapping from business-semantic choice;
- make evidence-backed functional decisions;
- recognize when business meaning cannot be recovered safely;
- evaluate healthcare, claims, identity, clinical, privacy, retention, and records behavior within a certified domain envelope.

### 7. Knowledge system

Purpose: provide current, cited, scoped knowledge to agents and evaluators.

Research and design questions:

- document retrieval versus structured facts;
- full-text, vector, graph, and hybrid retrieval;
- temporal facts and applicability by product/version;
- source citations and evidence links;
- conflicting fact representation;
- data-access and tenant policy;
- knowledge freshness and invalidation;
- retrieval evaluation;
- when a dedicated graph database is justified.

Choose storage after the knowledge types, queries, scale, and evaluation needs are measured. Do not select a graph database because the word “relationship” appears in the design.

### 8. Memory system

Purpose: preserve useful learning without poisoning later work.

Memory types:

- working memory for the current task;
- mission memory for one migration;
- episodic memory for prior runs;
- semantic memory for stable platform/domain knowledge;
- procedural memory for proven methods and skills;
- failure memory for defects and recovery;
- evaluation memory for model, agent, tool, and skill performance by operating envelope.

Memory must track source, time, applicability, confidence, and tenant. It must detect conflicts, invalidate stale facts, prevent cross-customer leakage, and measure whether recall improves results.

### 9. Certified skills

Purpose: turn proven methods into reusable executable capability.

A real skill needs:

- typed inputs and outputs;
- supported platforms and versions;
- required tools and knowledge;
- allowed effects;
- preconditions and invariants;
- known failure modes;
- evaluator and benchmark corpus;
- measured cost and latency;
- retry, rollback, and recovery behavior;
- promotion, limited-use, demotion, and revocation states.

A prompt file alone is not a certified skill.

### 10. Apex-agent orchestration

Purpose: run the engineering mission as one coherent learning and delivery loop.

The apex agent should:

- maintain current facts, hypotheses, gaps, and risks;
- choose the next discovery, research, build, or validation action;
- decompose work across specialists;
- compare conflicting outputs;
- request discriminating evidence;
- manage budgets and priorities;
- revise the plan as reality changes;
- continue after agent or process failure;
- decide, prove, record, execute, or escalate.

Candidate specialists:

- source forensics;
- platform architecture;
- data engineering and CDC;
- schema and semantic mapping;
- healthcare/domain analysis;
- security and privacy;
- research;
- implementation;
- test and evaluation;
- execution and recovery.

Neither apex nor specialist agents may bypass effect or acceptance gates.

### 11. Evaluation system

Purpose: replace agent confidence with measured acceptance.

Evaluation layers:

- retrieval correctness and citation quality;
- fact and applicability correctness;
- architecture and plan quality;
- mapping and semantic correctness;
- code, build, and deployment correctness;
- data movement, CDC, and reconciliation correctness;
- security and privacy;
- performance and cost;
- recovery and unknown outcomes;
- orchestration quality;
- calibration and abstention;
- memory quality;
- skill and model regression.

Evaluation methods:

- deterministic validators;
- golden and held-out cases;
- adversarial cases and seeded defects;
- mutation and property tests;
- source/target replay and readback;
- control totals and explicit input disposition;
- fault injection;
- independent agents or models calibrated against labels;
- expert baselines;
- real delivery outcomes.

An LLM evaluator may assist. It cannot be the only oracle for material safety, semantic, privacy, or mutation claims.

### 12. Self-correction

Purpose: change course when evidence disagrees with the current answer.

Loop:

1. produce a hypothesis, decision, or artifact;
2. run an independent check;
3. detect a mismatch;
4. diagnose the cause;
5. revise the plan, knowledge, skill, tool, or model choice;
6. rerun the independent evaluation;
7. retain the change only if the result improves;
8. record what was learned;
9. watch for regression.

Reflection without an external signal is not self-correction.

### 13. Self-improvement

Purpose: improve the system without silently making it less safe.

Possible improvement targets:

- prompts and context selection;
- retrieval and memory;
- task decomposition;
- agent and model routing;
- tools and skills;
- evaluators;
- narrow distilled or fine-tuned models.

Every candidate change needs a frozen baseline, held-out evaluation, safety and leakage checks, cost and latency comparison, rollback, and production monitoring. The system must not rewrite its own authority boundaries or lower evaluator thresholds to make itself pass.

### 14. Execution and recovery

Purpose: perform real work without turning model errors into customer damage.

Required capabilities:

- read-only discovery tools;
- isolated connector and code sandboxes;
- narrow cloud and platform APIs;
- short-lived credentials;
- effect identity and idempotency;
- receipts and target readback;
- timeout and unknown-outcome reconciliation;
- retry, rollback, or forward repair;
- replay and audit history.

### 15. Permanent research system

Purpose: keep the product current as agent, model, memory, data, and platform work changes.

For each relevant paper, project, or product, capture:

- exact problem solved;
- architecture and core abstractions;
- evidence and benchmarks;
- known failure modes;
- maintenance and community health;
- license and deployment model;
- security and data boundary;
- integration cost;
- what can be reused;
- what must be adapted;
- what must still be built and evaluated.

Research is a permanent capability, not a one-time planning phase.

## Open-source and research landscape to investigate

The following are research categories and initial candidates, not selected dependencies.

### Agent runtimes and orchestration

Evaluate OMP and other active agent runtimes, graph/state-machine orchestrators, workflow engines, blackboard systems, hierarchical-agent systems, and long-running durable execution frameworks.

Questions:

- Which system preserves explicit state rather than hiding it in chat history?
- Which supports typed tools, cancellation, recovery, and replay?
- Which can coordinate specialists and resolve conflicting output?
- Which behavior is deterministic enough to test?

### Memory and knowledge

Evaluate local and remote memory systems, agent-memory projects, hybrid retrieval, GraphRAG-style systems, temporal/episodic memory, knowledge graphs, and provenance-aware search.

Questions:

- Does recall measurably improve task success?
- Can stale and poisoned memories be found and removed?
- Can data and memory remain tenant-isolated?
- Can every useful claim be traced to a source?

### Coding, execution, and sandboxes

Evaluate autonomous coding systems, isolated execution environments, container/microVM sandboxes, remote tool protocols, and reproducible build systems.

Questions:

- Can a generated change be built, tested, traced, and reproduced?
- Can failure be contained?
- Can credentials and network access remain narrow?

### Data movement, CDC, lineage, and quality

Evaluate mature connector ecosystems, CDC systems, workflow engines, transformation systems, lineage standards/catalogs, and data-quality frameworks before building equivalents.

Questions:

- Which connector semantics are reusable?
- Which tools expose enough evidence and failure detail?
- Which abstractions hide important source-specific behavior?
- Which components can run inside a customer-controlled environment?

### Agent and system evaluation

Evaluate agent-evaluation frameworks, process-supervision research, verifier models, test-time search, active learning, benchmark design, failure injection, and calibration methods.

Questions:

- What measures real task completion rather than style?
- How are benchmark leakage and evaluator overfitting controlled?
- How are regressions detected after promotion?

## Research protocol

Every component study should produce one concise research card:

1. Required product capability.
2. Current unknowns.
3. Primary sources and candidate projects.
4. Candidate approaches.
5. Reuse, adapt, or build decision.
6. Cheapest discriminating experiment.
7. Evaluation and failure criteria.
8. Security, privacy, and tenant impact.
9. Reversal condition.

No architecture choice becomes locked because it is popular or elegant. It becomes selected when it passes the relevant experiment and fits the product constraints.

## Execution phases

### Phase 0 — Map the machine

Produce:

- atomic component and interface map;
- state and knowledge taxonomy;
- agent-role and authority map;
- evaluation map;
- failure and unknown-outcome map;
- open research questions;
- candidate project and paper catalog.

**Exit:** every proposed subsystem has a concrete responsibility, inputs, outputs, failure modes, and evaluation question.

### Phase 1 — Inventory Orca and OMP

For every required capability, classify existing work as:

- reusable as-is;
- adaptable behind a stable interface;
- useful only as a pattern;
- missing;
- unsafe for the product boundary;
- requiring an experiment.

**Exit:** evidence-backed reuse map for Orca, OMP, and their extension points.

### Phase 2 — Build the research corpus and lab

Gather legally usable source systems, schemas, CDC traces, code, data defects, migration artifacts, platform documentation, incidents, and domain cases. Create corpus manifests and seeded failure cases.

**Exit:** versioned corpus with provenance, data classification, licensing, expected answers, and explicit gaps.

### Phase 3 — Run atomic experiments

Initial experiment families:

- discover an undocumented asset or dependency;
- detect a false supplied architecture claim;
- infer CDC behavior from traces;
- resolve a specialist-agent disagreement using new evidence;
- catch a seeded schema or mapping defect;
- prove mission state survives agent/process failure;
- measure whether memory improves a second attempt without importing a bad fact;
- promote and then automatically demote a regressed skill;
- reconcile an external effect after a lost response.

**Exit:** experiment results identify which designs work, fail, or require more evidence.

### Phase 4 — Earn the architecture

Select the orchestration, state, knowledge, memory, evaluation, execution, and deployment architecture from research and experiment evidence.

Previous choices such as Go, PostgreSQL, NATS JetStream, Kubernetes, or a specific graph store remain candidate hypotheses until this gate.

**Exit:** decision record with selected approach, rejected alternatives, measured evidence, risks, and reversal conditions.

### Phase 5 — Assemble the smallest coherent system

Connect:

- one apex agent;
- a small number of specialist agents;
- mission state;
- research and knowledge retrieval;
- memory;
- discovery tools;
- independent evaluation;
- one safe execution tool;
- recovery and evidence recording.

**Exit:** an integrated system can complete and recover from a bounded non-migration mission while preserving evidence and state.

### Phase 6 — Run the first full migration dry run

Only now run an end-to-end migration over the selected sample source and target.

The dry run must test discovery, gap resolution, decision making, orchestration, execution, evaluation, recovery, memory, and correction—not merely artifact generation.

**Exit:** reproducible run evidence, known failures, measured capability boundary, and a prioritized improvement plan.

## Phase 1 deliverables and next move

The playing-field map now exists:

1. **System component map** — `docs/healthcare-system-design-mvp.html`.
2. **Exact Orca/OMP reuse inventory** — the two A0–A7 audits and combined capability code map.
3. **Research landscape and decisions** — durable, epistemic, orchestration, context, memory, evaluation, improvement, bounded-action, and gap-filler cards.
4. **Corpus/fixture plan** — architecture corpus plan, frozen six-row S1 identity-key fixture, and frozen Pagila v3.1.0 PostgreSQL estate.
5. **Atomic experiment backlog** — `docs/agentic-substrate-experiment-queue.md` contains all 70 research experiments plus six lab/integration contracts.
6. **Architecture decision register** — the atlas contains 46 versioned decisions/hypotheses with evidence and reversal conditions.
7. **Scope control** — 52 S1 deferrals were reviewed at `G1-RSCH`; none was silently promoted.

These are research/design artifacts plus bounded implementation evidence—not proof that the complete substrate works. Phase 3, `G4-AGNT`, `G5-KNOW`, and `G6-DISC` pass. Phase 6 spans frozen licensed source and qualification fixtures, immutable read-only adapter authority, database-enforced observation limits, exact inventory/profile/code/lineage, explicit CDC replay, cited claim comparison, deterministic gap/probe reasoning, versioned target capability and a proposal-only five-task/22-mapping migration design. Sealed `EXP-02` finds 8/8 material contradictions with 10/10 citations and zero false promotion; `EXP-03` finds 9/10 planted items with zero decoys and 2/2 denials; `EXP-04` disposes 10/10 events to exact final state with zero gaps. `P7-EVAL-01` adds immutable V2 definition/contract/assignment/result lineage and evidence readback; `P7-EVAL-02` adds product-owned durable coordination; `P7-EVAL-03` now adds the first side-effect-free executable suite, five hard structural/type/lineage/compatibility/policy checks, typed report/evidence/result, critical/benign/stale qualification and claim-fenced redelivery replay. Registry 78, migrations 14, fingerprint `5561a9ce…1c3e5fe`; 37 unit files / 201 tests and 21 PostgreSQL files / 56 tests pass. `P7-EVAL-04` is current: deterministically reconcile counts, keys, deletes, ordering, watermarks, replay and event disposition.
