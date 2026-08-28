# S1 Deferred Capability Register

## Purpose

Track capabilities deliberately excluded from Slice S1 so prototype focus does not become accidental product scope.

Authoritative selected-slice contract: `docs/agentic-substrate-s1-implementation-plan.md`.

Slice S1 proves one **evidence-correcting mission loop**:

- durable mission state;
- two conflicting evidence artifacts;
- one apex assignment;
- two product-owned specialist assignments;
- explicit epistemic gaps and contradictions;
- one deterministic discriminating check;
- first artifact rejected;
- corrected artifact accepted;
- one quarantined memory candidate;
- crash/restart/replay without duplicate accepted state.

Every deferred item preserves a seam and has a re-entry trigger.

## Status rules

| Status | Meaning |
| --- | --- |
| `DEFERRED` | Purposefully excluded from S1; expected later. |
| `PROMOTED` | Trigger fired; item has moved into an active roadmap coordinate. |
| `DROPPED` | Evidence showed the capability should not be built/adopted. |
| `REPLACED` | Another capability now satisfies the need. |

Update this register whenever:

- S1 scope changes;
- research reveals a new necessary capability;
- an experiment fires a re-entry trigger;
- a deferred seam becomes difficult to preserve;
- an item is promoted, replaced, or dropped.

## Deferred items

| ID | Status | Capability intentionally excluded from S1 | Why excluded | Seam preserved in S1 | Re-entry trigger | Planned coordinate |
| --- | --- | --- | --- | --- | --- | --- |
| `S1-DEF-001` | `PROMOTED` | Real source connector | S1 tests the substrate, not database access breadth. | `EvidenceItem` and source-adapter interface accept fixture artifacts. | `G5-KNOW` passed and source discovery begins at current coordinate `P6-DISC-01`; adapter implementation remains gated by the frozen fixture and contract. | `P6-DISC-01`–`03` |
| `S1-DEF-002` | `DEFERRED` | Snapshot, CDC, schema drift, deletes, late data | Requires source-specific runtime and replay corpus. | Task/evidence/evaluator contracts can represent watermarks and dispositions. | First source adapter selected. | `P6-DISC-08`, `P6-DISC-16` |
| `S1-DEF-003` | `DEFERRED` | Real Databricks/Snowflake/cloud target mutation | External-effect work must not distract from core correction loop. | `EffectIntent`, capability envelope, receipt, and unknown state remain in schemas. | S1 state/evaluation gates pass. | `P8-EXEC-07`–`12` |
| `S1-DEF-004` | `DEFERRED` | Remote execution relay and customer-zone spool | No source/target network exists in S1. | Assignment/effect protocols use location-neutral IDs and receipts. | One local effect protocol passes; remote topology needed. | `P8-EXEC-04`–`06` |
| `S1-DEF-005` | `DEFERRED` | Production operator console | CLI/minimal inspector is enough to prove state/evidence. | Public query shapes and stable record IDs remain UI-ready. | Integrated mission behavior stabilizes. | `P9-INTEG-03`–`09` |
| `S1-DEF-006` | `DEFERRED` | Production Kubernetes/HA/DR | S1 needs reproducibility, not production availability certification. | Stateless worker boundaries and durable store interfaces remain deployable. | Clean local prototype passes and customer RTO/RPO is known. | `P10-QUAL-01`, later production phase |
| `S1-DEF-007` | `DEFERRED` | Full enterprise identity, SCIM, KMS, secret-manager integrations | No real customer credential/effect exists in S1. | Tenant ID, workload ID, capability, data class, and secret reference are mandatory fields. | First real connector/effect integration. | `P8-EXEC-02`, `P8-EXEC-13` |
| `S1-DEF-008` | `DEFERRED` | Production-grade multi-tenancy and row-level security | S1 can test logical tenant isolation without full enterprise auth. | Every durable key and context manifest includes tenant; negative fixtures exist. | Shared service deployment or customer multi-business-unit need. | `P8-EXEC-13`, `P10-QUAL-07` |
| `S1-DEF-009` | `DEFERRED` | Dedicated graph database | Relational support/refutation/dependency edges cover S1. | Graph queries sit behind epistemic repository interface. | PostgreSQL traversal/latency or argumentation experiment misses threshold. | `P5-KNOW-06`, `L-KNOW-01` |
| `S1-DEF-010` | `DEFERRED` | Full ATMS or formal argumentation solver | Complexity is unjustified before contradiction workload exists. | Assumptions, justifications, support/refute, contradiction sets, and candidate hypotheses are explicit. | EPI experiments reveal combinatorial environments or incorrect simple acceptance. | `P5-KNOW`, `P7-EVAL`, `L-KNOW-01` |
| `S1-DEF-011` | `DEFERRED` | Bayesian belief network and calibrated expected information gain | No calibrated priors/likelihoods exist yet. | Probe candidates store predicted outcomes and transparent ordinal factors. | Domain corpus supplies calibrated probabilities and improves probe choice. | `P7-EVAL`, post-S1 research |
| `S1-DEF-012` | `DEFERRED` | Semantic entropy and model uncertainty service | S1 acceptance is evidence-based; model uncertainty is optional signal. | Assignment results may carry uncertainty signals without authority. | EPI-EXP-06 shows measurable risk/coverage benefit. | `P7-EVAL-06`, `L-EVAL-01` |
| `S1-DEF-013` | `REPLACED` | Vector retrieval and reranking | Two fixture artifacts did not need semantic search; the 55-document `EXP-06` corpus later exposed five lexical misses. | Context assembler and retrieval result schemas remain backend-neutral. | Optional version/configuration-digested sparse semantic retrieval raised coverage from 15/20 to 20/20 with no vector service or authority change; reopen through `L-KNOW-01` only if a later benchmark misses threshold. | Completed by `P5-KNOW-05`/`12` without a vector dependency |
| `S1-DEF-014` | `PROMOTED` | Long-term memory taxonomy and governed lifecycle; adaptive consolidation remains `S1-DEF-040` | S1 needed only one quarantined memory candidate. | Candidate/version/use/invalidation records preserve provenance, scope, retention, authority separation, and downstream impact. | `EXP-07` repeated held-out tasks measured positive help, poison rejection, tenant isolation, use tracing, and invalidation; `P5-KNOW-09`–`13` completed. | `P5-KNOW-09`–`13` |
| `S1-DEF-015` | `DEFERRED` | Skill certification, promotion, drift, demotion, rollback | S1 does not execute learned skills. | Learning candidate and skill-manifest interfaces remain versioned. | Correction loop passes and one repeated capability is identified. | `P7-EVAL-10`–`14` |
| `S1-DEF-016` | `DEFERRED` | Fine-tuning, distillation, or custom model training | Corpus/evaluator does not yet exist; weights are not the current bottleneck. | Every attempt pins model/version and produces evaluation data. | Stable held-out corpus and repeated model-specific error class. | Post-prototype decision |
| `S1-DEF-017` | `DEFERRED` | Recursive multi-level agent hierarchy | One apex and two specialists are enough to test authority/disagreement. | Assignment model includes parent, depth, budget, scope, and spawn policy. | ORCH experiment shows one level cannot decompose required workload. | `P4-AGNT`, after ORCH baseline |
| `S1-DEF-018` | `DEFERRED` | Open-ended swarm/group chat | Chatter creates cost and unclear ownership without guaranteed diversity. | Messages and evidence are durable, but authority stays assignment-based. | Bounded group experiment beats apex/worker baseline on held-out tasks. | `P4-AGNT`, research branch |
| `S1-DEF-019` | `DEFERRED` | Agent voting as conflict resolution | Correlated models can confidently vote for the same wrong answer. | Disagreement creates epistemic gaps and discriminating probes. | Independent diversity/calibration evidence proves voting value. | `P7-EVAL`, research branch |
| `S1-DEF-020` | `DEFERRED` | Contract-net/market-based task allocation | No large heterogeneous worker market in S1. | Specialist capability, budget, cost, and availability fields exist. | Worker count/capability diversity makes central assignment a bottleneck. | `P4-AGNT`, scale iteration |
| `S1-DEF-021` | `DEFERRED` | OMP internal subagents as durable first-level assignments | OMP task agents are parent-session scoped and not mission authority. | Product assignment IDs wrap one OMP RPC process; nested subagents remain optional micro-work. | Product-owned dispatch works; a microtask needs cheaper local fan-out. | `P4-AGNT-08`–`13` |
| `S1-DEF-022` | `DEFERRED` | Multiple apex agents or permanent debate council | Cost/coordination complexity before one apex contract is proven. | High-risk decision can request an independent evaluator/advisor assignment. | ORCH experiment shows apex bottleneck or systematic uncorrected bias. | `P4-AGNT`, `P7-EVAL` |
| `S1-DEF-023` | `DEFERRED` | Persistent apex model session/persona | Durable mission state should outlive and replace the model worker. | Apex assignment is reconstructed from mission snapshot/context manifest. | Experiment proves continuity benefit beyond product state without hidden authority. | `P4-AGNT`, research branch |
| `S1-DEF-024` | `DEFERRED` | DBOS/Temporal/Restate/Hatchet production adoption | S1 baseline must first expose actual durability pain. | Durable-execution interface and challenger experiment remain explicit. | DUR-EXP-01/02 shows custom or challenger materially wins. | `P2-LAB`, `P3-KERN`, `L-ARCH-01` |
| `S1-DEF-025` | `DEFERRED` | Message bus, Redis, or separate queue service | S1 load does not justify extra infrastructure. | Transactional outbox/work-claim interface is transport-neutral. | Queue age/database contention misses measured envelope. | `P3-KERN`, `L-ARCH-01` |
| `S1-DEF-026` | `DEFERRED` | OPA/external policy engine | S1 can enforce a small typed in-process policy. | Policy input/output and decision record are engine-neutral. | Policy volume/ownership/versioning needs independent bundles. | `P8-EXEC-02` |
| `S1-DEF-027` | `DEFERRED` | Healthcare semantic capability pack | S1 validates substrate mechanics with technical artifacts. | Finding/evaluator contracts support domain-specific records. | Generic substrate correction loop passes. | Migration/domain work after `G7-EVAL` |
| `S1-DEF-028` | `DEFERRED` | Multi-cloud, multi-source, multi-target coverage | Breadth before one correct path creates shallow adapters and weak evaluation. | Capability matrix and adapter interfaces are versioned. | One connector/target path is certified. | Post-prototype capability expansion |
| `S1-DEF-029` | `DEFERRED` | Disconnected/offline production envelopes | Requires trust-root, expiry, sequence, transfer, and revocation design. | Envelope IDs, signatures, expiry, and evidence imports remain extensible. | Customer disconnected requirement and connected effect protocol pass. | Post-prototype production phase |
| `S1-DEF-030` | `DEFERRED` | Production evidence WORM/legal hold/export | S1 uses immutable local artifacts and digests only. | Evidence metadata includes retention, class, digest, and source. | Customer legal/records requirements supplied. | Production compliance phase |
| `S1-DEF-031` | `DEFERRED` | Production observability/SLO/alert platform | S1 needs traces and run artifacts, not enterprise operations integration. | Correlation IDs, event metrics, queue age, failure categories preserved. | Integrated prototype and customer SLOs exist. | `P10-QUAL`, production phase |
| `S1-DEF-032` | `DEFERRED` | Broad corpus acquisition and model training dataset | S1 needs two controlled contradictory artifacts and seeded labels. | Corpus manifests include license/version/classification/checksum. | Research or domain experiment requires more coverage. | `P2-LAB`, `P5-KNOW`, `P6-DISC` |
| `S1-DEF-033` | `DEFERRED` | Continuous web crawling and automatic corpus synchronization | S1 uses controlled local artifacts; open web ingestion adds licensing, injection, freshness, and storage policy. | `LiveResearchRequest/Result`, evidence ingestion, canonical URL, digest, freshness, and stop-policy contracts exist. | A substrate/domain task requires current external knowledge not available in approved corpus. | `P1-RSCH-05`, `P5-KNOW`, later research service |
| `S1-DEF-034` | `DEFERRED` | Learned or model-specific context optimizer | S1 must first establish reproducible manifests and held-out context evaluation. | Compiler/packer is versioned and backend/model-strategy neutral. | CTX-EXP-09 shows stable model-specific packing gain without leakage or constraint loss. | `P5-KNOW`, `P7-EVAL` |
| `S1-DEF-035` | `DEFERRED` | Automated NLI/LLM citation judge as critical acceptance authority | Automatic citation judges can miss partial support and inherit model bias. | Citation validity/correctness/completeness interfaces and human-labeled calibration set are defined. | CTX-EXP-04 demonstrates calibrated error below the threshold for a named claim class. | `P7-EVAL-06` |
| `S1-DEF-036` | `DEFERRED` | Advanced long-context, prompt-caching, and provider-native context optimization | These optimize cost/latency after correctness and manifest contracts exist. | Manifest records order, position, prefix/tool digests, budget, and strategy version. | CTX-EXP-09 or cost/load tests show the baseline misses task quality or budget targets. | `P5-KNOW`, `P10-QUAL-06` |
| `S1-DEF-037` | `DEFERRED` | Cross-tenant analogue learning and globalized customer lessons | S1 has no approved de-identification/certification process and must default to isolation. | Memory records carry tenant/use policy; global reference corpus is separate from learned memory. | Explicit customer/privacy approval plus de-identification and held-out leakage/correctness certification. | Post-S1 memory/domain phase |
| `S1-DEF-038` | `DEFERRED` | Production memory backend selection between product Postgres, Mnemopi, Hindsight, or another service | S1 only creates a quarantined candidate; backend performance is not yet the bottleneck. | Product memory contracts and adapter boundary own lifecycle/use traces. | MEM-EXP-09 shows one backend materially improves quality/operations without weakening governance. | `P5-KNOW`, `L-KNOW-01` |
| `S1-DEF-039` | `DEFERRED` | Production legal forgetting, deletion propagation, and retention orchestration | S1 uses synthetic/local records without customer deletion or legal-hold obligations. | Memory/source/derivation/use IDs and deletion policy fields are mandatory. | Customer legal/records requirements or non-synthetic data enters the system. | Production compliance phase; MEM-EXP-08 |
| `S1-DEF-040` | `DEFERRED` | Adaptive memory consolidation, learned importance/decay, and autonomous reorganization | These can amplify errors before help/harm and poison benchmarks exist. | Consolidation creates versioned candidates with source/drop/conflict records; ranking strategy is replaceable. | MEM-EXP-02/04/06/10 demonstrate safe measurable gain. | `P5-KNOW`, `P7-EVAL` |
| `S1-DEF-041` | `DEFERRED` | Production expert-review panel, adjudication, and labeling operations | S1 has deterministic technical truth and no irreducible clinical/domain judgment. | Evaluator contracts support human assignments, independent labels, disagreements, and provenance. | A named semantic claim class lacks a reliable deterministic oracle and expert labels are available. | `P7-EVAL`, domain evaluation phase |
| `S1-DEF-042` | `DEFERRED` | General semantic LLM-judge ensemble as an acceptance gate | Position, verbosity, self-enhancement, shared-model, and calibration failure modes are unmeasured. | Semantic evaluator roles, independence dimensions, abstention, and calibration references are explicit. | EVAL-EXP-06 plus expert-held-out corpus meets false-accept and disagreement thresholds for a named claim class. | `P7-EVAL-06`, `L-EVAL-01` |
| `S1-DEF-043` | `DEFERRED` | Process reward models or learned process-verifier training | S1 can evaluate observable process invariants without storing chain-of-thought or training a model. | Durable process events and separate process/outcome measures provide a future training/evaluation surface. | Held-out traces show deterministic process checks cannot localize a repeated material failure. | Post-S1 evaluation research |
| `S1-DEF-044` | `DEFERRED` | Production evaluator fleet with shadowing, canaries, drift detection, and automatic revocation | S1 has one pinned deterministic evaluator and no production traffic distribution. | Evaluator/version/calibration/subject lineage supports shadow results, revocation, and affected-subject queries. | Multiple evaluator versions or live workloads create measurable drift/regression risk. | `P7-EVAL`, `P10-QUAL` |
| `S1-DEF-045` | `DEFERRED` | Automated text-space prompt/program/skill optimization using GEPA, DSPy, SkillOpt, TextGrad, or another optimizer | S1 has no validated reusable capability corpus; optimization before evaluator/corpus governance invites objective gaming and distributional overfit. | Learning candidates, bounded diffs, optimizer/evaluator identities, split manifests, and certification refs remain explicit. | S1 correction passes and IMPR-EXP-02/03 shows held-out gain over manual/baseline without protected regression. | `P7-EVAL-10`–`14`, `L-EVAL-01` |
| `S1-DEF-046` | `DEFERRED` | Model-generated executable tool library in the style of LATM/Voyager | Executable candidates add supply-chain, sandbox, compatibility, effect, and rollback risk beyond a quarantined text lesson. | Capability manifests carry code digest, dependencies, permissions, authority envelope, evaluator and rollback predecessor. | A repeated diagnosed gap cannot be solved by context/prompt/procedure and build/security/behavior evaluators exist. | Post-S1 capability phase |
| `S1-DEF-047` | `DEFERRED` | Autonomous curriculum and benchmark-case generation | Generated tasks can duplicate training data, carry invalid labels, leak tenants, or optimize for the current evaluator. | Corpus records preserve candidate status, lineage, license, classification, split, labels and approval. | Validated production failure clusters exceed authored corpus coverage and IMPR-EXP-09 passes. | `P2-LAB`, `P7-EVAL` |
| `S1-DEF-048` | `DEFERRED` | Production shadow/canary learning rollout, drift detection, automatic demotion, and impact re-evaluation | S1 has no production assignment population or previously certified active capability. | Registry separates quarantined/certified/active/revoked versions and records exact capability use/outcome refs. | First certified candidate has sufficient eligible traffic and IMPR-EXP-05/08/10 passes. | `P7-EVAL`, `P10-QUAL` |
| `S1-DEF-049` | `DEFERRED` | Production sandbox provider selection among containers, gVisor, Firecracker microVMs, customer-native Jobs/VMs, or another substrate | S1 executes trusted local fixture checks and has no production threat/deployment profile to justify an isolation platform. | Runner contract pins provider/image, mounts, network, identity, limits, output and teardown evidence. | Real adapter workload/threat model exists and ACT-EXP-07 measures compatibility, escape surface, startup, throughput and operations. | `P8-EXEC-04`–`06`, production phase |
| `S1-DEF-050` | `DEFERRED` | SPIFFE/SPIRE workload identity and trust-domain federation | S1 has one local process topology; enterprise workload attestation/federation would add infrastructure without changing the capability contract. | Every assignment, capability, relay, runner, receipt and evaluator carries workload/audience identity independent of implementation. | Customer-zone/multi-service deployment needs short-lived federated workload identity and ACT-EXP-10 passes. | `P8-EXEC-02`, production identity phase |
| `S1-DEF-051` | `DEFERRED` | Signed runner/adapter images with SLSA-style build provenance and runtime attestation | S1 authors no deployable customer-zone adapter image and can pin local source/digests directly. | Capability and receipt schemas carry artifact digest, builder/provenance/signer and revocation refs. | First executable connector/adapter artifact crosses a trust boundary. | `P8-EXEC-03`–`06`, supply-chain qualification |
| `S1-DEF-052` | `DEFERRED` | Automated destructive, irreversible, or semantically lossy migration effects | These cannot be made safe by a generic retry/rollback story and S1 performs no target mutation. | Effect intent classifies reversibility, prerequisites, blast radius, compensation limits, exception policy and evaluator. | Read-only/declarative non-production effects pass ACT-EXP-01 through 10 and a concrete customer runbook proves necessity/recovery. | Post-`G8-EXEC`, explicit product decision |

## `G1-RSCH` gate review

Review outcome:

- all 52 deferred items were reviewed against the completed A0–A7 research, exact OMP/Orca audits, gap-filler decisions, maturity placement, and the frozen S1 contract;
- no item is promoted, dropped, or replaced at this gate;
- no experiment has run yet, so no re-entry trigger has fired;
- DBOS and Inspect remain challenger spikes, not S1 dependencies;
- S1 still performs no external target effect, memory recall, skill promotion, semantic LLM judging, connector/CDC work, production sandbox/identity/policy, or domain semantic pack;
- next mandatory review is `G2-LAB`, and any earlier scope change must use the promotion procedure below.

## `G2-LAB` gate review

Review outcome:

- all 52 deferred items were reviewed against the executable lab, fixture calibration, non-agent baseline, fault matrix, sealed artifacts, runtime decision, and `WORKER-EXP-01` limitation;
- no item is promoted, dropped, or replaced at this gate;
- the synthetic profile/probe does not promote real connectors, snapshot/CDC, healthcare semantics, or corpus breadth;
- the private Node/TypeScript lab does not promote DBOS, Inspect, a memory backend, optimizer, OPA/SPIRE, a sandbox provider, remote relay, target effect, or production deployment cut;
- `WORKER-EXP-01` was inconclusive at `G2-LAB`, so that gate did not promote OMP internals; it later passed at `P4-AGNT-12` without making OMP task/session state product authority.
- next mandatory review is `G3-KERN`; any earlier scope change must use the promotion procedure below.

## `G3-KERN` gate review

Review outcome:

- all 52 items were reviewed against checksum-locked PostgreSQL authority, idempotent commands, append-only events, fencing, explicit unknown effects, replay, and restart convergence;
- no deferred capability was promoted, replaced, or dropped: the kernel proved control semantics without a connector, semantic retrieval, memory recall, learned skill, external target, or production deployment dependency.

## `G4-AGNT` gate review

Review outcome:

- all 52 items were reviewed against isolated OMP RPC, exact context/result/tool authority, specialist/apex/disagreement contracts, process reconstruction, and real pinned-binary containment;
- no deferred capability was promoted, replaced, or dropped: product-owned one-level dispatch passed, but no evidence showed a need for durable OMP subagents, swarms, voting, multiple apexes, persistent personas, or production execution infrastructure.

## `G5-KNOW` gate review

Review outcome:

- all 52 items were reviewed against immutable corpus/provenance, authorization-before-ranking, reproducible context manifests, governed memory/skill registries, migration 008, and sealed `EXP-06`/`EXP-07`;
- `S1-DEF-001` is `PROMOTED`: `G5-KNOW` passes and `P6-DISC-01` begins the first licensed fixture/connector path;
- `S1-DEF-013` is `REPLACED`: sparse governed semantic projection recovers the five lexical misses and reaches 20/20 without a vector backend;
- `S1-DEF-014` is `PROMOTED`: all five memory classes, use tracing, lifecycle/invalidation, isolation, and help/harm measurement now exist; adaptive consolidation remains separately deferred under `S1-DEF-040`;
- production memory backend selection, legal deletion orchestration, cross-tenant learning, adaptive consolidation, and skill promotion/drift/canary automation remain deferred;
- next mandatory review is `G6-DISC`; any earlier scope change must use the promotion procedure below.

## Promotion procedure

When a trigger fires:

1. Change status from `DEFERRED` to `PROMOTED`.
2. Name the triggering experiment/evidence.
3. Add or activate the roadmap coordinate.
4. Define acceptance evidence.
5. Update architecture/ADR only if the promoted item changes boundaries.
6. Retain the original reason and date so scope history remains reconstructable.
