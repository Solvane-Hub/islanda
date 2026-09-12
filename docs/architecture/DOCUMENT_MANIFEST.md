# FoundryAI — Architecture Document Manifest

**Purpose:** the single register of every canonical architecture document, where it lives, and what it depends on.
**Owner:** Jamil Nash (Co-Founder & CEO) · **Maintained by:** Lead Software Engineer
**Last updated:** 2026-09-11 — **ADR-0021** accepted (institutional access extension point, documentation only); `business-intelligence-core.md` and `intelligence-gateway.md` registered (private, post-competition P2–P6, previously undocumented). Previously: 2026-08-09 — **ADR-0020** accepted (one business profile; intake progress reads knowledge, not the guided-flow cursor; Nova extension point documented, Nova not implemented). Previously: 2026-08-08 — four previously unregistered documents retired (D1–D5); Knowledge Engineering series **7 of 7 registered and mirrored**; ✅ **zero unresolved conflicts** (C1–C3, R1–R3, A1–A12 all resolved; ADR-0015 unchanged throughout). Previously: 2026-08-07 — **AI Architecture series complete (15/15)**; ADRs 0015–0019 ratified/accepted

**Milestone update (2026-08-11):** ADR-0020 now has a live per-slot provenance seam and a shared confirmed / declined / unknown / needs-confirmation reader for dashboard, intake, and review. Nova conversation remains unimplemented.

> **Rule:** every architecture document must appear here. A document that is not in this manifest is not canonical. Update this file in the same commit as the document it describes.

**Legend —** Status: `Canonical` · `Draft` · `Superseded` · `Planned` · `Blocked`

---

## Field definitions

| Field          | Meaning                                                                                               |
| -------------- | ----------------------------------------------------------------------------------------------------- |
| **Status**     | `Canonical` · `Draft` · `Superseded` · `Planned` · `Blocked`                                          |
| **Impl.**      | Implementation status of what the document specifies: `Built` · `Partial` · `Not started` · `Blocked` |
| **Depends on** | Documents that must be settled before this one can be implemented                                     |
| **Related**    | Documents that reference or are referenced by this one                                                |
| **ADRs**       | Binding decisions governing this document                                                             |
| **Evidence**   | Verification artefacts proving the implementation behaves as specified                                |

---

## AI Architecture series — **COMPLETE (15/15 canonical)**

| #   | Title                                 | Status                            | Ver | Impl.                      | Local path                                       | Notion                                                            |
| --- | ------------------------------------- | --------------------------------- | --- | -------------------------- | ------------------------------------------------ | ----------------------------------------------------------------- |
| 1   | Trust Layer Specification             | **Canonical**                     | 1.0 | Not started                | `trust-layer-specification.md`                   | [link](https://app.notion.com/p/3b39910b029a805c8a63fe8aef167450) |
| 2   | Launch Plan Architecture              | **Canonical**                     | 1.0 | Not started                | `launch-plan-architecture.md`                    | [link](https://app.notion.com/p/3b69910b029a81a88114fd9efc00ae1b) |
| 3   | Coordinator Agent Specification       | **Canonical** (supersedes v1.0)   | 2.0 | Not started                | `coordinator-agent-specification.md`             | [link](https://app.notion.com/p/3b39910b029a80e4a395c97adacd5a66) |
| 4   | Specialist Agent Contract             | **Canonical**                     | 1.0 | Not started                | `specialist-agent-contract.md`                   | [link](https://app.notion.com/p/3b69910b029a81889d78eecca262472a) |
| 5   | Knowledge Ingestion Pipeline          | **Canonical**                     | 1.0 | 🔴 **Blocked** (KI1)       | `knowledge-ingestion-pipeline.md`                | [link](https://app.notion.com/p/3b69910b029a81429ee6cc4245eb03b9) |
| 6   | ~~Knowledge Freshness Specification~~ | ⛔ **RETIRED — superseded by K6** | 1.0 | n/a                        | `knowledge-freshness-specification.md` (history) | [link](https://app.notion.com/p/3b69910b029a81b19f9fedd44786e413) |
| 7   | AI Evaluation Framework               | **Canonical**                     | 1.0 | 🔴 **Blocked** (EV1)       | `ai-evaluation-framework.md`                     | [link](https://app.notion.com/p/3b69910b029a81288bdac0436e8835ad) |
| 8   | Prompt Engineering Standard           | **Canonical**                     | 1.0 | Not started                | `prompt-engineering-standard.md`                 | [link](https://app.notion.com/p/3b69910b029a816f800dd5b2fe3ae9e7) |
| 9   | Agent Memory Architecture             | **Canonical**                     | 1.0 | Not started                | `agent-memory-architecture.md`                   | [link](https://app.notion.com/p/3b69910b029a8154bdd8fde5c9f5bbf0) |
| 10  | Human Review Workflow                 | **Canonical**                     | 1.0 | Not started                | `human-review-workflow.md`                       | [link](https://app.notion.com/p/3b69910b029a81fba83bc92b1b49c8b1) |
| 11  | Observability & Telemetry             | **Canonical**                     | 1.0 | **Partial** (ADR-0014)     | `observability-and-telemetry.md`                 | [link](https://app.notion.com/p/3b69910b029a81a6a635c7d90d6b713e) |
| 12  | Model Provider Architecture           | **Canonical**                     | 1.0 | 🔴 **Blocked** (MP-1/MP-2) | `model-provider-architecture.md`                 | [link](https://app.notion.com/p/3b69910b029a8165aeeece3a2e640597) |
| 13  | AI Cost Optimisation                  | **Canonical**                     | 1.0 | Not started                | `ai-cost-optimisation.md`                        | [link](https://app.notion.com/p/3b69910b029a8192b511d6f5e5237ef0) |
| 14  | AI Safety Framework                   | **Canonical**                     | 1.0 | Not started                | `ai-safety-framework.md`                         | [link](https://app.notion.com/p/3b69910b029a8144af44e2d5d131c301) |
| 15  | Versioning & Reproducibility          | **Canonical**                     | 1.0 | Not started                | `versioning-and-reproducibility.md`              | [link](https://app.notion.com/p/3b69910b029a810b91b1e755e0eea55a) |

All local paths are relative to `docs/architecture/`. Drive location for all: `03 Architecture`.

### Dependencies, relationships, ADRs and evidence

| #   | Depends on                                     | Related                              | ADRs                             | Evidence                           |
| --- | ---------------------------------------------- | ------------------------------------ | -------------------------------- | ---------------------------------- |
| 1   | Knowledge Arch · Research Agent Spec · DB Arch | Constitution · docs 2,4,5,7,10,14    | **0015**, 0009, 0011, 0012, 0014 | —                                  |
| 2   | doc 1 · DB Arch · PRD                          | Frontend Arch · docs 3,4,6,10,15     | **0016**, 0015, 0007, 0009, 0011 | —                                  |
| 3   | **0016** · docs 1,2 · DB Arch                  | AI System Arch · docs 4,5,7,8,9,13   | **0016**, **0015**, 0014, 0007   | —                                  |
| 4   | docs 1,3 · **0016**                            | Research Agent Spec · docs 7,8,9,15  | **0017**, 0016, 0015             | —                                  |
| 5   | Knowledge Arch · **KI1**                       | docs 6,7 · DB Arch                   | 0015, 0016                       | —                                  |
| 6   | doc 5                                          | Knowledge Arch · docs 2,10           | 0016, 0015, 0014                 | —                                  |
| 7   | docs 1,4,5,3                                   | TRL Evidence Register · doc 10       | **0018**, 0015, 0004             | —                                  |
| 8   | doc 4                                          | docs 12,15,14                        | 0005, 0016, 0018                 | —                                  |
| 9   | doc 4 · DB Arch                                | AI System Arch · docs 3,14           | 0015, 0016, 0014                 | —                                  |
| 10  | docs 1,5,6                                     | docs 7,11,14                         | 0015, 0016, 0012, 0018           | —                                  |
| 11  | Backend Arch · **0014**                        | docs 7,10,13,15                      | **0014**, 0016                   | `2026-08-07-sprint1-completion.md` |
| 12  | AI System Arch · **0016**                      | docs 5,8,13,15 · Security Arch       | **0019**, 0016, 0005             | —                                  |
| 13  | docs 11,12                                     | docs 1,3,7                           | 0016, 0019, 0018                 | —                                  |
| 14  | docs 1,5,7,8                                   | Constitution · Security Arch · doc 2 | 0015, 0018, 0016                 | —                                  |
| 15  | **0016** · docs 1,5,12                         | docs 4,8,10,11                       | 0016, 0015, 0012, 0008           | —                                  |

**Critical path:** 1 → 5 → 4 → 3 → 2, with **7 gating any claim that the system works**.

**Execution foundation:** ADR-0016 governs every AI workflow. Documents 3, 4, 9, 13 and 15 all assume persisted workflow runs and step idempotency.

**Implementation blockers (all founder decisions):**

| #          | Blocker                                    | Blocks                                   |
| ---------- | ------------------------------------------ | ---------------------------------------- |
| KI1 / MP-1 | Embedding model & dimensionality           | doc 5 → everything downstream            |
| EV1        | Who compiles the requirement gold standard | doc 7 → **TRL 3**                        |
| MP-2       | Data residency legal assessment            | doc 12 → institutional partnerships      |
| HR1        | Who performs human review                  | doc 10                                   |
| SF1/SF3    | Legal disclaimer; accountability           | doc 14 → public launch                   |
| VR1        | Reproducibility vs erasure                 | doc 15 → before founder data accumulates |

## Knowledge Engineering series (7 documents)

Notion parent: [Knowledge Engineering](https://app.notion.com/p/3b69910b029a80d88859df39edaab80a) (under Master Documentation Index).
Local path root: `docs/architecture/knowledge-engineering/`. Drive: `03 Architecture`.

| #   | Title                                                 | Status        | Ver | Mirrored locally                                  | Notion                                                            |
| --- | ----------------------------------------------------- | ------------- | --- | ------------------------------------------------- | ----------------------------------------------------------------- |
| K1  | Knowledge Pack Authoring Guide                        | **Canonical** | 1.0 | ✅ `knowledge-pack-authoring-guide.md`            | [link](https://app.notion.com/p/3b69910b029a80c580bef58ed40d17d0) |
| K2  | Knowledge Validation Standard                         | **Canonical** | 1.0 | ✅ `knowledge-validation-standard.md`             | [link](https://app.notion.com/p/3b69910b029a8086b80fe8b072cd1acd) |
| K3  | Knowledge Chunking Strategy                           | **Canonical** | 1.0 | ✅ `knowledge-chunking-strategy.md`               | [link](https://app.notion.com/p/3b69910b029a8064924ae0b662f2be18) |
| K4  | Metadata & Citation Standard                          | **Canonical** | 1.0 | ✅ `metadata-and-citation-standard.md`            | [link](https://app.notion.com/p/3b69910b029a801caa4acac8d7d5c6d6) |
| K5  | Retrieval Architecture (RAG) Specification            | **Canonical** | 1.0 | ✅ `retrieval-architecture.md`                    | [link](https://app.notion.com/p/3b69910b029a801b9323cb24bef41654) |
| K6  | Knowledge Monitoring & Change Detection Specification | **Canonical** | 1.0 | ✅ `knowledge-monitoring-and-change-detection.md` | [link](https://app.notion.com/p/3b69910b029a80b1aaa8e7f640dfd878) |
| K7  | Knowledge Publishing Pipeline Specification           | **Canonical** | 1.0 | ✅ `knowledge-publishing-pipeline.md`             | [link](https://app.notion.com/p/3b69910b029a80dbaef2c618e40683f2) |

✅ **Mirroring complete — 7 of 7 (2026-08-08).** All Knowledge Engineering documents are
mirrored under `docs/architecture/knowledge-engineering/`. Each mirror opens with an HTML
comment recording its Notion source URL and mirror date.

**Canonicity:** Notion remains the **authoring surface**; the repository holds the mirror that
CI, ESLint and AI assistants read. A change made in one must be applied to the other in the
same working session — a mirror that has silently drifted is worse than no mirror, because it
is trusted. The mirror header exists so drift is detectable.

All mirrors were verified line-by-line against their Notion sources on 2026-08-08; the
consistency report is in `docs/evidence/`.

### Cross-references to the AI Architecture series

| Knowledge Eng. doc               | Overlaps / relates to                                 | Relationship                                                                                                          |
| -------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| K1 Authoring Guide               | AI-5 Knowledge Ingestion Pipeline · AI-1 Trust Layer  | K1 is the **methodology**; AI-5 is the **pipeline**. K1 §1.4 declares itself subordinate to the Trust Layer           |
| K2 Validation Standard           | AI-5 §5.6 (review gate) · AI-10 Human Review Workflow | Defines the validation AI-5 requires before publication                                                               |
| K3 Chunking Strategy             | AI-5 §5.3 (chunking) · **KI1/MP-1 embedding blocker** | Supersedes AI-5 §5.3's placeholder; still gated on the embedding decision                                             |
| K4 Metadata & Citation Standard  | AI-1 §8 (citation object) · AI-5 §5.4                 | ✅ **Resolved (C3).** K4 §6 **references** the canonical citation object in Trust Layer §8; `chunk_id` mandatory      |
| K5 Retrieval (RAG) Specification | AI-4 Specialist Agent Contract · Research Agent Spec  | Defines retrieval that AI-4's evidence binding depends on                                                             |
| K6 Monitoring & Change Detection | ~~AI-6 Knowledge Freshness Specification~~            | ✅ **Resolved (C2).** AI-6 **retired**; its five mechanisms absorbed into K6 §2A. K6 is the canonical monitoring spec |
| K7 Publishing Pipeline           | AI-5 §5.7 (publish) · AI-15 Versioning                | Defines the publication step AI-5 references                                                                          |

---

## ⛔ Retired / non-canonical documents

**Founder decisions D1–D5, applied 2026-08-08.** These four documents existed in Notion, each
self-declaring `Status: Canonical`, none registered here. They are now registered with explicit
non-canonical status so the register reflects reality. **Their content is retained for history.
None may be implemented from.**

| Document                         | Notion                                                            | Status                                    | Replaced by                                                                                                                           | Harvested into                                                 |
| -------------------------------- | ----------------------------------------------------------------- | ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| Retrieval Engine Specification   | [link](https://app.notion.com/p/3b59910b029a80c99f7bdb0070b1b45c) | 🟡 **SUPERSEDED**                         | **K5** Retrieval Architecture · **AI-3** Coordinator                                                                                  | §6 taxonomy → Coordinator §5A · §8 conditional logic → K3 §7.1 |
| Knowledge Graph Architecture     | [link](https://app.notion.com/p/3b59910b029a80289cc0d58e22bf327b) | ⛔ **ARCHIVED** — historical architecture | Not superseded by a single document; **graph-first retrieval was not adopted (D1)**                                                   | §8 conditional logic → K3 §7.1                                 |
| FoundryAI Reasoning Model        | [link](https://app.notion.com/p/3b59910b029a8036b414dcf1c72c50c4) | 🟡 **SUPERSEDED**                         | **ADR-0016** · **ADR-0017** · **AI-3** Coordinator · **AI-4** Specialist Agent Contract · **AI-1** Trust Layer · **AI-2** Launch Plan | none                                                           |
| Evidence & Citation Architecture | [link](https://app.notion.com/p/3b59910b029a80bfa591c9051fd31a47) | 🟡 **SUPERSEDED in schema**               | **Trust Layer §8** (citation object) · **K4** · **ADR-0015** (badges) · **K6 §2A.4** (freshness states)                               | §12 "Why?" panel → **AI-2 Launch Plan §5A**                    |

**D1 — retrieval architecture unchanged.** The canonical v1 path stands: **K3 chunks → K5
deterministic filtering → semantic/hybrid retrieval → trust filtering.** Graph-first retrieval
was **not** adopted. The Knowledge Graph is **not** the system of record. Graph traversal is
**not** a prerequisite for discovering legal obligations. **K5 and K3 were not reopened.**

**D5 — ADR-0018 unchanged.** The Retrieval Engine §16 targets (<2 s latency, ≥99% requirement
recall) were **not** promoted into a binding ADR. They may be tracked later as implementation
or evaluation objectives. ADR-0018 remains the sole owner of release gates.

### Retired shadow ADR register (24)

Each retired document carried its own decision series outside `docs/decisions/`. **All 24 are
retired as a parallel decision register** and preserved for history only. **None was promoted.**
Binding decisions live only in `docs/decisions/` as ADR-0001 … ADR-0020.

| Series           | IDs | Source document                  | Canonical equivalent, where one exists                                                                                                                                                                                 |
| ---------------- | --- | -------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ADR-RE-001…006` | 6   | Retrieval Engine Spec            | RE-002/003/005/006 align with K5 §3.9, §3.4, §13, §11. **RE-001 (graph traversal precedes semantic retrieval) contradicts K5 §4 and was rejected under D1.** RE-004 coverage gating → K5 §10 + Coordinator §7.1        |
| `ADR-KG-001…006` | 6   | Knowledge Graph Architecture     | KG-002/004/006 align with the no-agent-writes rule, ⚪ UNKNOWN, and K2 §6. **KG-001 (graph is the canonical source of regulatory truth) contradicts K1/K7 and was rejected under D1.** KG-003/005 unadopted            |
| `ADR-RM-001…006` | 6   | FoundryAI Reasoning Model        | RM-001/002/003/005/006 align with K5 §3.1, ADR-0017, ADR-0015. **RM-004 (Coordinator orchestrates and delegates to specialists) directly contradicts ADR-0016 — "Agents plan; the runner executes" — and is rejected** |
| `ADR-EC-001…006` | 6   | Evidence & Citation Architecture | EC-001/002/003/004/005/006 align with ADR-0017, K7 §4.3, ADR-0015, K2 §8.2 and AI-2. None adds a rule not already binding                                                                                              |

**Proposed future ADR inputs — not binding, not adopted.** Recorded so the material is not lost;
each would require separate founder ratification if ever raised:

- **Jurisdictional inheritance** (KG §7) — "lower levels inherit obligations from higher levels
  unless explicitly overridden". No canonical document specifies inheritance; K5 §3.2 specifies
  jurisdiction _isolation_, which is a different mechanism. **Gap acknowledged, not filled.**
- **Typed relationship vocabulary superset** (KG §6, 16 types vs K3 §7's 6). Would require
  reconciliation under K4 §8 controlled vocabularies.
- **Consolidated failure-mode taxonomy** (RM §15, EC §14) — partly covered by K5 §13 and AI-14.

---

## ✅ Conflict register — zero unresolved

Every conflict raised to date (C1–C3, R1–R3, A1–A12) is **resolved and founder-approved**.
**ADR-0015 was never modified** — each conflict was resolved by aligning the subordinate
document, per the authority hierarchy in `ARCHITECTURE_MAP.md` §1.

Entries are retained in full, struck through, with the original description preserved so the
reasoning survives. A resolved entry is history, not clutter — it records why a rule exists.

> **Not tracked here:** the six open **founder decisions** (KI1/MP-1, EV1, MP-2, HR1, SF1/SF3,
> VR1) listed in the blockers table above. Those are pending inputs, not conflicts.

### ~~C1~~ — Source Authority scale — ✅ **RESOLVED 2026-08-08**

K1 §4.3 aligned to ADR-0015 in both Notion and the local mirror; new §4.3.1 states authority is a property of the document, not the publisher. ADR-0015 unchanged.

<details><summary>Original conflict (retained for history)</summary>

| Level | ADR-0015 (ratified 2026-08-07)                     | K1 Authoring Guide §4.3                                                          |
| ----- | -------------------------------------------------- | -------------------------------------------------------------------------------- |
| 5     | Legislation — Acts and statutes                    | Primary Legal Authority — Acts, **Statutory Instruments, Regulations**, Gazette  |
| 4     | **Statutory instruments and official regulations** | **Competent Regulatory Authority — Ministries, Departments** (an _organisation_) |
| 3     | Official government guidance                       | Official Operational Guidance                                                    |

**Two material differences.**

1. Regulations sit at Level 5 in K1 and Level 4 in ADR-0015. Low practical impact — both are ≥ 4, so the VERIFIED outcome is unchanged — but the scales do not align.
2. **Level 4 changes meaning entirely.** ADR-0015 defines Source Authority as _"a property of a **document**"_, objective and assignable at registration. K1's Level 4 classifies by _who published it_ — an organisation.

**Why this matters:** under K1, anything published by a ministry is Level 4 and therefore qualifies for 🟢 VERIFIED. ADR-0015 explicitly decided that official agency guidance is Level 3 and _"can be 🟡 DERIVED at most"_. **K1 as written would loosen precisely the control the founder tightened when ratifying VERIFIED ≥ 4.**

**Resolution path (as proposed at the time).** K1 §1.4 declares itself _subordinate to the Trust Layer Specification_, so the ratified ADR-0015 scale governs and K1 §4.3 should be aligned.

> ✅ **Superseded — this path was founder-approved and applied on 2026-08-08.** K1 §4.3 is aligned to ADR-0015 in both Notion and the local mirror, and §4.3.1 was added. The status note that previously appeared here ("not applied; requires founder direction") described the position before approval and no longer holds.

### ~~C2~~ — Freshness vs Monitoring overlap (K6 vs AI-6) — ✅ **RESOLVED 2026-08-08**

**K6 is the canonical monitoring specification.** AI-6 Knowledge Freshness Specification is **retired**; its five policy mechanisms were absorbed into K6 §2A (review cadence by source class · −10 staleness penalty · plan cascade · "a 404 is not an unpublish" · coverage recovery). AI-6 is retained at `knowledge-freshness-specification.md` for history only — **do not implement from it.** K6 §17 records the supersession; the AI Architecture table above marks AI-6 ⛔ RETIRED.

<details><summary>Original conflict (retained for history)</summary>

_Knowledge Monitoring & Change Detection Specification_ (K6) and _Knowledge Freshness Specification_ (AI-6) both specified change detection, review cadence and staleness propagation. One needed to supersede the other, or their scopes needed to be explicitly divided. At the time of the report neither had been retired and both were listed as canonical.

</details>

### ~~C3~~ — Citation object — ✅ **RESOLVED 2026-08-08**

`chunk_id` was **missing** from K4's citation object. One **canonical citation object** now lives in Trust Layer §8 — the union of both formats: `chunk_id` (mandatory, retrieval identity), agency, document, section, publication_date, last_reviewed_date, knowledge_version, url, accessed_at, plus K4's optional `clause` and `page`. K4 §6, `schema-future-phases.sql` and the Specialist Agent Contract now **reference** it rather than restating it.

### ~~R1/R2~~ — Trust Layer internal contradictions — ✅ **RESOLVED 2026-08-08**

§9 Decision Flow carried pre-ratification three-dimension logic (VERIFIED at authority ≥ 3) contradicting §4.6. Rewritten to implement all four dimensions. Stale open questions T1, T2 and T4 marked resolved.

### ~~R3~~ — "Reasoning Quality" vs "Reasoning Confidence" — ✅ **RESOLVED 2026-08-08**

**Reasoning Confidence** is canonical (ADR-0015). Two occurrences in K4 corrected. Unrelated uses of "quality" left untouched.

### ~~A1–A12~~ — K2/K3/K5/K7 audit findings — ✅ **RESOLVED 2026-08-08**

All founder-approved. **ADR-0015 unchanged throughout.**

| #     | Doc                            | Resolution                                                                                                                                                                                                   |
| ----- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A1–A3 | K2 ×2, K5 ×1                   | "Reasoning Quality" → **Reasoning Confidence**                                                                                                                                                               |
| A4    | K2 §8                          | Six legal-source categories retained as **Legal Source Category metadata**, mapped to the ratified 5 levels. Conflict resolution orders by Authority, then category, then recency. **No sixth trust level.** |
| A5    | K2 §14                         | Hierarchy corrected — Trust Layer governs                                                                                                                                                                    |
| A6    | K3 §12                         | Circular ordering resolved: **K3 → K4**                                                                                                                                                                      |
| A7    | K3 §5, §8 · K5 §3.4            | Chunks carry **Source Authority only**. Evidence Strength, Reasoning Confidence, Trust Level and Trust Score are **derived per claim, never stored on a chunk**. Provenance preserved.                       |
| A8    | K5 §10                         | Retrieval **reports** coverage limitations; **the Coordinator decides** clarification                                                                                                                        |
| A9    | K5 §3.8, §12                   | Deterministic reproducibility — same ordered result set for fixed inputs; replay inputs persisted                                                                                                            |
| A10   | K7 §3, §3.1, §7                | **Embeddings are retrieval artifacts, not Knowledge Pack versions** (K1 canonical). Model change rebuilds artifacts without incrementing the Pack version. Full manifest recorded. No model chosen.          |
| A12   | K5 §3.10, §11, §12 · AI-4 §5.0 | **`chunk_id` mandatory** in the retrieval → agent contract. Single citation identity; no competing field.                                                                                                    |

**Downstream propagation:** Specialist Agent Contract §5.0 · Coordinator §7.0 · AI-5 §5.5 ·
Trust Layer §8 · `schema-future-phases.sql`.

## Existing canonical documents (Notion-primary)

| Title                         | Status    | Notion                                                            | Local mirror                         | Updated    |
| ----------------------------- | --------- | ----------------------------------------------------------------- | ------------------------------------ | ---------- |
| FoundryAI Constitution v1.0   | Canonical | [link](https://app.notion.com/p/3b39910b029a80c2bdade3b540a17785) | —                                    | 2026-08-05 |
| FoundryAI Codex v1.0          | Canonical | [link](https://app.notion.com/p/3b39910b029a80d1bef7e2bcd459609f) | —                                    | 2026-08-05 |
| Master Documentation Index    | Canonical | [link](https://app.notion.com/p/3b39910b029a80978814f9b2a5c241d9) | —                                    | 2026-08-07 |
| Product Requirements Document | Canonical | [link](https://app.notion.com/p/3b39910b029a80daa8c0fd1d758c3046) | —                                    | 2026-08-05 |
| Development Roadmap           | Canonical | [link](https://app.notion.com/p/3b39910b029a800fa84ad9b837a5502d) | —                                    | 2026-08-07 |
| Platform Architecture         | Canonical | [link](https://app.notion.com/p/3b39910b029a8022800de6d0df2f23c2) | —                                    | 2026-08-05 |
| AI System Architecture        | Canonical | [link](https://app.notion.com/p/3b39910b029a809986b7ebbc27a109bd) | —                                    | 2026-08-07 |
| Knowledge Architecture        | Canonical | [link](https://app.notion.com/p/3b39910b029a80219f43f768be49b943) | —                                    | 2026-08-05 |
| Database Architecture         | Canonical | [link](https://app.notion.com/p/3b39910b029a8091985bcda4b37051f4) | `docs/architecture/schema-design.md` | 2026-08-05 |
| Frontend Architecture         | Canonical | [link](https://app.notion.com/p/3b39910b029a80789e7ac8e6d8a3af9d) | —                                    | 2026-08-07 |
| Backend Architecture          | Canonical | [link](https://app.notion.com/p/3b39910b029a803591f1dde555270654) | —                                    | 2026-08-07 |
| API Architecture              | Canonical | [link](https://app.notion.com/p/3b39910b029a801893f8f05af3fa62b4) | —                                    | 2026-08-07 |
| Security Architecture         | Canonical | [link](https://app.notion.com/p/3b39910b029a80d6b413d8f83148ac09) | —                                    | 2026-08-05 |
| Engineering Standards         | Canonical | [link](https://app.notion.com/p/3b39910b029a80f28319c58d5a6e424d) | —                                    | 2026-08-05 |
| Claude Code Master Context    | Canonical | [link](https://app.notion.com/p/3b39910b029a8008b5a7db393f9027a4) | `CLAUDE.md`                          | 2026-08-07 |
| Agent Specifications          | Canonical | [link](https://app.notion.com/p/3b39910b029a8013a878e3ae79ea3b27) | —                                    | 2026-08-05 |
| Research Agent Specification  | Canonical | [link](https://app.notion.com/p/3b39910b029a8022941be1af98e37b10) | —                                    | 2026-08-05 |

## Repository-primary documents

| Title                                                        | Path                                              | Updated    |
| ------------------------------------------------------------ | ------------------------------------------------- | ---------- |
| ER Diagram & Relationships                                   | `docs/architecture/er-diagram.md`                 | 2026-08-05 |
| Schema Design & Decisions                                    | `docs/architecture/schema-design.md`              | 2026-08-05 |
| Future-phase schema design                                   | `docs/architecture/schema-future-phases.sql`      | 2026-08-05 |
| Changelog                                                    | `CHANGELOG.md`                                    | 2026-08-07 |
| Business Intelligence Core (private, post-competition P2–P4) | `docs/architecture/business-intelligence-core.md` | 2026-09-11 |

## Architecture Decision Records

`docs/decisions/ADR-0001 … ADR-0014`. Drive copy: `03 Architecture/2026-08-07_ADR_Register_0001-0013.md` (⚠️ predates ADR-0014).

| ADR      | Decision                                                                                                                                                                                                                                                      |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0001     | Repository structure & enforced layer boundaries                                                                                                                                                                                                              |
| 0002     | TypeScript strictness                                                                                                                                                                                                                                         |
| 0003     | Server Actions default, REST by exception                                                                                                                                                                                                                     |
| 0004     | Testing strategy                                                                                                                                                                                                                                              |
| 0005     | Zod as the single validation layer                                                                                                                                                                                                                            |
| 0006     | Tenancy — user-owned, multi-business                                                                                                                                                                                                                          |
| 0007     | Business lifecycle states                                                                                                                                                                                                                                     |
| 0008     | Primary key strategy                                                                                                                                                                                                                                          |
| 0009     | RLS policy pattern                                                                                                                                                                                                                                            |
| 0010     | `auth.users` owns identity                                                                                                                                                                                                                                    |
| 0011     | Controlled denormalization for RLS                                                                                                                                                                                                                            |
| 0012     | Audit write path & fail-open policy                                                                                                                                                                                                                           |
| 0013     | Password policy                                                                                                                                                                                                                                               |
| 0014     | Structured logging & correlation IDs                                                                                                                                                                                                                          |
| **0015** | **Unified trust and confidence model** — ✅ ratified. Four dimensions; VERIFIED requires Authority ≥ 4                                                                                                                                                        |
| **0016** | **Long-running AI workflow execution** — ✅ accepted. Persisted workflow runs; one step per invocation. Foundation for all AI orchestration                                                                                                                   |
| **0017** | Shared agent output contract — envelope, evidence binding, idempotency, mandatory `unresolved[]`                                                                                                                                                              |
| **0018** | Evaluation gates & release criteria — hard gates; coverage recall ≥ 95% is also the TRL 3 gate                                                                                                                                                                |
| **0019** | Model provider abstraction & data residency — capability tiers; failover off by default                                                                                                                                                                       |
| **0020** | **One business profile; intake measures knowledge, not visitation** — ✅ accepted. Nova writes the same profile through the Intake service; provenance goes in the existing `responses` jsonb; no migration                                                   |
| **0021** | **Institutional access extension point** (private, post-competition, P7.0) — documentation only. Reaffirms ADR-0006's `app.business_access()` seam and records its exact future extension shape (one grants table, one function-body change); no code changed |

## Evidence

| File                                                     | Covers                                    |
| -------------------------------------------------------- | ----------------------------------------- |
| `docs/evidence/2026-08-05-phase1-schema-verification.md` | Schema, RLS, functions, append-only audit |
| `docs/evidence/2026-08-05-phase1-test-results.md`        | Phase 0–1 gate, layer-boundary proof      |
| `docs/evidence/2026-08-05-phase3-auth-verification.md`   | Authentication, route protection          |
| `docs/evidence/2026-08-07-phase4-6-verification.md`      | Shell, business creation, intake          |
| `docs/evidence/2026-08-07-sprint1-completion.md`         | Sprint 1 completion report                |

Drive: `13 Buildathon/Judging Evidence`, `13 Buildathon/TRL Evidence`, `04 Database`, `03 Architecture`, `09 Daily Log`.
