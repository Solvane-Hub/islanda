# FoundryAI — Context for AI Coding Assistants

This file mirrors the **Claude Code Master Context** into the repository so AI
assistants read it automatically. The Knowledge Base remains canonical.

## Role

You are a lead software engineer on FoundryAI. You implement software.
You do not redesign architecture. You do not redefine product scope.

## Read before implementing

Constitution → Codex → PRD → Platform Architecture → AI System Architecture →
Knowledge Architecture → Database Architecture → Trust Layer → Security Architecture →
Frontend Architecture → Backend Architecture → Development Roadmap.

## Hard rules

- Never invent functionality, regulations, fees, agencies, or citations.
- Never contradict the documentation. If it is unclear, ask — do not assume.
- Never hard-code country-specific assumptions outside the Knowledge Pack.
- Never bypass authentication, authorization, or Row Level Security.
- Never let an AI agent write to the database. Agents return validated JSON;
  Application Services perform every write.
- Prefer Server Components. Client Components only for interaction, forms,
  animation, local state, or browser APIs.
- TypeScript strict. No `any` without documented justification.
- Business logic lives in `services/` — never in `app/` or `components/`.

## Layer boundaries (enforced by ESLint)

```
app/ → services/ → lib/db/ → Supabase
```

- `app/` must not import `lib/db`.
- `lib/ai/` must not import `lib/db` or `services/`.
- `components/` must not import `services/` or `lib/db`.

## Working method

1. Read the docs. 2. Identify affected systems. 3. Plan. 4. Get approval if
   architecture changes. 5. Build in small increments. 6. Test. 7. Summarize and
   recommend the next step.

## Architecture documents

`docs/architecture/DOCUMENT_MANIFEST.md` is the register of every architecture
document — status, version, Notion URL, local path, Drive location, owner,
related documents, ADRs, evidence. **A document not in the manifest is not
canonical.** Read the manifest before assuming a document does or does not exist.

Decisions live in `docs/decisions/` as ADR-0001 … ADR-0021 and are binding.

## Trust model (Trust Layer Specification v1.0)

**Four independent dimensions** (ADR-0015, ratified 2026-08-07). Do not conflate
them and do not introduce a fifth:

| Dimension                | Scale        | Property of                                                     |
| ------------------------ | ------------ | --------------------------------------------------------------- |
| **Source Authority**     | 1–5          | a _document_ — Research Agent Spec scale is canonical           |
| **Evidence Strength**    | 1–5          | a _passage↔claim link_ — "does this passage actually say this?" |
| **Reasoning Confidence** | HIGH/MED/LOW | an _inference_ — how far we travelled from evidence             |
| **Coverage Confidence**  | HIGH/MED/LOW | a _set_ — guards against omission                               |

**Trust Level** (🟢 verified · 🟡 derived · 🔵 recommended · ⚪ unknown) and
**Trust Score (0–100)** are **derived** from those four. Never agent-assigned —
a component that both produces and validates a claim provides no assurance.

Hard rules:

- 🟢 **VERIFIED requires Source Authority ≥ 4** — legislation/regulations only.
  Official guidance (3) can be 🟡 DERIVED at most.
- Evidence Strength ≤ 2 and Reasoning LOW can never be verified or derived.
- Score `< 50` is quarantined; `unknown` is exempt and always shown.
- **Coverage Confidence is computed and stored but NOT displayed in v1.**
  Therefore copy must say _"Requirements we found"_, never _"Your complete
  requirements"_ (Constitution Article VII).

Trust validation **fails closed** — unvalidated guidance is worse than none.
This is deliberately the opposite of audit logging, which fails open (ADR-0012).

## AI workflow execution (ADR-0016)

**A workflow is a state machine in PostgreSQL, not a running process. Each worker
invocation advances it by exactly one step.**

- Never hold an HTTP request open for a generation run.
- Every step writes `agent_executions`; `(workflow_run_id, sequence_no)` is unique,
  so **every step must be idempotent**.
- Retries are per-step (max 3, exponential backoff). Cancellation is cooperative,
  checked between steps — never mid-inference.
- **Partial results are always retained.** A failed run keeps completed steps;
  never show a founder a blank failure.
- Agents **plan**; the runner **executes**. The Coordinator emits an Execution
  Plan and does not call other agents.

## AI subsystem rules (documents 4–15)

- **Agent output contract (ADR-0017).** One envelope. Every claim carries the
  `chunk_id`s it came from **and a verbatim quote from each**. A chunk not
  returned by the current run's retrieval is fabrication. `unresolved[]` is
  **mandatory** — never silently drop what could not be determined.
- **Every step is idempotent.** Stable `claim_id` from normalised content, no
  wall-clock dependence. Retries are normal operation.
- **Evaluation gates every AI change (ADR-0018).** Prompt, model, chunking or
  retrieval. Hard gates: coverage recall ≥ 95%, citation validity 100%,
  domain-declaration recall ≥ 99%, fabrication 0.
- **Prompts are source code.** In Git, semantically versioned, schema-validated,
  with a mandatory refusal test. Never in a database or vendor console.
- **Conversation is never evidence.** Structured facts get columns, not chat
  history. Agent reasoning is never re-fed into a later run.
- **Provider SDKs only inside `lib/ai/providers/` (ADR-0019).** Agents request a
  capability tier, never a model name. Failover is off by default.
- **Never claim completeness.** Copy says "Requirements we found", never "Your
  complete requirements" — a safety control, not a style preference.
- **Refusal is a designed output.** A falling refusal rate is an alert, not an
  improvement.

## Current position

Sprint 1 (Platform Foundation) is **complete** — 8 of 9 phases; Phase 2 partial,
blocked on brand tokens. Working: auth, application shell, business creation,
founder intake, dashboard, settings, hardening.

AI Architecture documentation series: **15 of 15 complete.** See
`docs/architecture/DOCUMENT_MANIFEST.md`.

Knowledge Engineering series: **7 of 7 registered and mirrored** into
`docs/architecture/knowledge-engineering/` (K1–K7, completed 2026-08-08). Notion is
the **authoring surface**; the repo mirror is what CI and assistants read. Each mirror
header records its Notion URL — change both in the same session or the mirror lies.

✅ **Conflicts C1–C3 and R1–R3 resolved 2026-08-08** (all founder-approved;
ADR-0015 unchanged). Key outcomes now binding:

- **Authority is a property of the document, not the publisher.** An Act is
  Level 5, a regulation Level 4, and the guidance page explaining it Level 3 —
  even from the same ministry. Level 3 can never reach 🟢 VERIFIED.
- **One canonical citation object** — Trust Layer §8. `chunk_id` is
  **mandatory**; it binds a claim to the exact chunk from the current retrieval
  run. Other documents **reference** it; never restate it.
- **K6 (Knowledge Monitoring) is the canonical monitoring spec.** AI-6
  Knowledge Freshness is **retired** — retained for history only, do not
  implement from it.
- **"Reasoning Confidence"** is the canonical dimension name, never
  "Reasoning Quality".

✅ **K2/K3/K5/K7 audit A1–A12 resolved 2026-08-08.** Additional binding rules:

- **Trust is never a chunk property.** A chunk carries **Source Authority only**.
  Evidence Strength, Reasoning Confidence, Trust Level and Trust Score are
  derived per claim — a chunk has no claim to be strong evidence _for_.
- **`chunk_id` is mandatory** on every chunk returned by retrieval, stable within
  its Knowledge Pack version. It is the **single** citation identity — never add
  a competing identifier.
- **Retrieval reports; the Coordinator decides.** Retrieval may report coverage
  limitations but must never trigger founder clarification itself.
- **Retrieval is deterministically reproducible.** Same ordered result set for a
  fixed knowledge version, config, query representation, filters, ranking config
  and embedding model/version. Persist those inputs or replay is impossible.
- **Embeddings are retrieval artifacts, not Knowledge Pack versions.**
  Regenerating them does not increment the Pack version; changing the model
  rebuilds retrieval artifacts only. Record model, version, **dimensions**,
  timestamp, source Pack version, config version, chunk version, status.
- **Legal Source Category** (6 values) is metadata alongside the 5-level Source
  Authority scale. It orders conflicts _within_ a level. There is no sixth level.

✅ **Four unregistered documents retired 2026-08-08 (founder decisions D1–D5).**

- **Retrieval Engine Spec** 🟡 superseded by K5 + Coordinator · **Knowledge Graph Architecture**
  ⛔ archived · **FoundryAI Reasoning Model** 🟡 superseded by ADR-0016/0017 + AI-1/2/3/4 ·
  **Evidence & Citation Architecture** 🟡 superseded in schema by Trust Layer §8 + K4.
  **Do not implement from any of them**, despite each declaring "Status: Canonical".
- **Graph-first retrieval was NOT adopted.** The path is **K3 chunks → K5 deterministic
  filtering → semantic/hybrid retrieval → trust filtering**. The Knowledge Graph is not the
  system of record; traversal is not a prerequisite for discovering obligations.
- **24 shadow ADRs retired** (`ADR-RE-*`, `ADR-KG-*`, `ADR-RM-*`, `ADR-EC-*`), none promoted.
  Binding decisions live only in `docs/decisions/` as ADR-0001 … ADR-0020.
- **Harvested:** "Why?" evidence panel → **Launch Plan §5A** · taxonomy expansion →
  **Coordinator §5A** · conditional requirement logic → **K3 §7.1**. Mapping in the manifest.

**Nova (Extractive) is IN SCOPE — founder-approved 2026-07-31.** Nova is being
built as the first founder-facing AI surface under **Option A: extractive**.
Retrieval runs over the published Knowledge Pack; the reasoner is
**deterministic TypeScript that composes answers from verbatim quoted passages**.
There is no model call, no provider SDK and no generative reasoning anywhere in
the path — fabrication is prevented by construction, not by evaluation.

Nothing about this relaxes the existing contracts. Binding as before:

- The Specialist Agent Contract envelope (document 4 §5) — `status`, `claims`
  with `chunk_id` **and a verbatim quote**, and a mandatory `unresolved[]`.
- K5 retrieval, including deterministic filters before ranking and mandatory
  `chunk_id` on every result.
- Trust Layer §8 citations, and evidence binding to the **current run**.
- `A5 — Structured refusal`: `NO_AUTHORITATIVE_INFORMATION_FOUND` is a designed
  output. Nova must never answer a regulatory question from model memory,
  because it has no model to remember with.

**Generative Nova remains out of scope** until ADR-0018's evaluation harness
exists and its hard gates (citation validity 100%, fabrication 0) can be
demonstrated. The reasoner is isolated behind one module so that swap is
contained.

**Still out of scope until their phases: generative AI agents, Knowledge
authoring, Funding, Compliance.** Do not implement them, and never add mock data
that could be mistaken for real guidance — including in seeds, placeholders and
demos.

**Implementation is blocked on founder decisions:** embedding model (KI1/MP-1),
gold-standard curation (EV1), data residency (MP-2), reviewer staffing (HR1),
legal disclaimer and accountability (SF1/SF3), reproducibility vs erasure (VR1).

Extractive Nova does **not** depend on KI1/MP-1 or MP-2 — it performs no
embedding and makes no external inference call, so neither the model nor the
residency decision gates it. **SF1/SF3 still gates it**: Nova is founder-facing
regulatory guidance, and the disclaimer and accountability position must be
settled before it ships to founders, even though every sentence it produces is a
quotation with a citation.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
