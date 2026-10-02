# Intelligence Gateway (P5)

**Status:** Foundation implemented (post-competition, private). **Date:** 2026-09-09.

The single controlled entry point for FoundryAI's LLM-powered capabilities. Nova,
financial intelligence, compliance, document intelligence, planning, growth and
monitoring will all go through it. It is not a chatbot and not a generic SDK
wrapper — it is the infrastructure that keeps AI **profitable, deterministic,
provenance-preserving, secure, provider-independent, structured and auditable**.

## Core principle — the LLM is never the source of truth

Deterministic application logic remains authoritative for calculations, financial
metrics, dates, expiration, compliance status, ownership, permissions, RLS,
business identity, provenance, source selection, verification state, document
relationships and database facts. The LLM only reasons and communicates on top of
those facts: explanation, synthesis, comparison, interpretation, recommendations,
strategy, planning, clarifying questions.

**If deterministic logic can answer correctly, no LLM is invoked.** The router
defaults to `deterministic`.

## Deterministic vs LLM responsibilities

| Concern                                            | Owner                          |
| -------------------------------------------------- | ------------------------------ |
| Figures, calculations, growth %, goal progress     | Deterministic services (P2–P4) |
| Provenance, verification state, RLS, identity      | Deterministic services         |
| "How much did revenue grow?"                       | Deterministic                  |
| "Why did revenue grow?"                            | LLM (mini)                     |
| "12-month growth strategy from my history + goals" | Premium reasoning              |

## Architecture

```
User → Nova → runIntelligence()
                 ├─ router.classify (free, deterministic)
                 │     ├─ deterministic → outcome:'deterministic' (Nova answers from services)
                 │     └─ llm | premium ↓
                 ├─ context builder (controlled, identifier-free)
                 ├─ provider (ModelClient adapter, server-side)
                 ├─ validator (schema + evidence-id check, fail-safe)
                 ├─ cost + usage recording (ai_usage, append-only)
                 └─ outcome:'answered' | 'unavailable'
```

- **Pure core** — `lib/intelligence/`: `types.ts`, `router.ts`, `models.ts`,
  `cost.ts`, `schema.ts`, `validator.ts`, `prompt.ts`, `context.ts`. No I/O, no
  SDK; unit-tested in isolation.
- **Provider adapters** — `lib/ai/providers/`: `model-client.ts` (interface),
  `openai.ts` (initial adapter; ADR-0019 restricts provider code to this dir).
- **Application service** — `services/intelligence/`: `gateway.ts`
  (orchestrator, dependency-injected), `context.ts` (assembles the controlled
  context from existing services), `usage.ts` (fail-open recorder), `index.ts`
  (production wiring).
- **Accounting** — `ai_usage` table (append-only, RLS on with zero policies,
  service-role written; migration `20260909000000_ai_usage.sql`).

## Provider abstraction (ADR-0019)

Callers depend on `ModelClient`, never a vendor SDK. Tier→model is configuration
(env overrides `OPENAI_MODEL_*`). Only OpenAI is implemented; Anthropic/Google/
others are new files in `lib/ai/providers/` behind the same interface. **Failover
is off** — the gateway degrades to `unavailable` rather than substituting an
unevaluated model (ADR-0018/0019). API keys are server-only (`serverEnv`).

## Routing

`classifyIntelligence(question, hint?)` → `{ category, determination, tier }`.
Categories: regulatory, compliance, financial, business, performance, documents,
strategy, growth, creative, registry, monitoring, general. Determination:
`deterministic` (default) · `llm` (mini) · `premium`. Rule-based and free.

## Cost control

`nano`/`mini`/`premium` tiers with per-tier estimated pricing; premium is never
the default. Every request writes one `ai_usage` row: category, determination,
`llm_called`, provider, model, tier, model reason, input/output tokens, estimated
USD cost, validation outcome, failure and error code — enough to compute
**business → AI usage → estimated cost**. No customer billing, no subscriptions.

## Context & security

The context builder assembles only non-sensitive Business Object + P4 performance
data and turns real facts into an evidence set with ids. **There is no field for a
tax id, registration or licence number** — the exclusion is structural. The
assembler runs through the RLS-scoped client and existing services, so it reads
only what the caller owns; the gateway refuses a request whose context business
id ≠ request business id (isolation). No secrets or content are logged.

## Epistemic types

`FACT`, `VERIFIED_FACT`, `FOUNDER_PROVIDED`, `DOCUMENT_DERIVED`, `EXTERNAL_DATA`,
`CALCULATION`, `REGULATORY_EVIDENCE`, `RECOMMENDATION`, `INFERENCE`, `UNKNOWN`.
The prompt forbids the model from upgrading `FOUNDER_PROVIDED` to `VERIFIED_FACT`
or turning `UNKNOWN` into `FACT`; recommendations may only be `RECOMMENDATION`/
`INFERENCE` (schema-enforced).

## Structured response & validation

LLM → structured intelligence, never UI. `{ answer, category, confidence,
recommendations[], evidence[], followUps[], unknowns[] }`. Every response passes
`validateIntelligenceResponse`: schema, allowed category/confidence/basis, and
**evidence ids must be a subset of the supplied evidence** (no fabricated
evidence). Failure → `unavailable`, never a repaired/fake answer.

## Evidence

Evidence is separate from the answer text. The context supplies evidence refs
(`{ id, type, source, provenance }`); the response cites ids. The evidence-rail
UI is deferred; the contract is established.

## Financial intelligence preparation

`assembleIntelligenceContext` already feeds P4's `toNovaPerformanceContext(view)`
into the gateway. The next build lets Nova answer "how is my business doing?",
"what changed between Q1 and Q2?", "how does performance relate to my goals?" —
facts/calculations from deterministic services, LLM reasoning on top.

## Future Nova behavior (not implemented here)

"How are we doing?" → combine business context, performance, goals, documents and
regulatory context to answer **What changed / Why it may matter / What we know /
What we don't / What to investigate / Possible next actions**, keeping
evidence-vs-strategy explicit. Nova is not wired to the gateway yet (separate
redesign task).

## Extension points

New provider → new file in `lib/ai/providers/`. New category → extend
`IntelligenceCategory`. New capability (compliance, documents, growth) → a caller
that assembles its context and calls `runIntelligence`. Vector/RAG only if a real
requirement appears — not introduced speculatively.

## Nova Financial Intelligence (P6) — the first end-to-end loop

The first capability to consume the gateway. `askNovaFinanceAction`
(`app/(app)/intelligence/actions.ts`) is the caller:

```
Nova (dashboard panel) → askNovaFinanceAction
  → rate limit (reuses Nova's limiter; fails closed)
  → assembleIntelligenceContext (real P4 data, RLS-scoped, identifier-free)
  → runIntelligence(defaultGatewayDeps())
       ├─ deterministic → answerFinancialDeterministically(question, context)
       └─ llm/premium   → validated structured response
  → toNovaFinanceView → NovaFinance panel (answer + evidence rail)
  → audit event (shape only); gateway already wrote ai_usage
```

- **Deterministic bypass (mandatory).** Factual, comparison and derived-metric
  questions ("how much revenue?", "how did revenue grow from Q1 to Q2?", "what's
  my margin?") are answered by `answerFinancialDeterministically` straight from
  the P4 performance context — **no model call**. The gateway records
  `determination: deterministic`, `llm_called: false`, zero cost. It only reports
  figures that exist and their provenance; a missing figure is an honest unknown.
- **LLM reasoning.** Synthesis/interpretation ("how is my business doing?", "why
  did revenue change?", "what should I do?") routes to the `mini` tier. Premium is
  never expanded here — only the existing router's premium classification.
- **Causal claims — known limitation.** Deterministic growth/comparison answers
  state change only, never a cause (tested: the answer text never contains
  "because"). "Why" questions route to LLM reasoning, and the model is currently
  free to offer a causal explanation in `answer`; that explanation is **not**
  structurally or evidence-enforced today — the validator rejects fabricated
  evidence ids and malformed JSON, but does not require a causal claim to trace to
  supplied evidence or otherwise land in `unknowns`. This is a follow-up
  hardening item, not yet implemented. It does not affect recommendations, which
  remain separately and correctly epistemically typed (`RECOMMENDATION`/
  `INFERENCE`, schema-enforced) regardless of this limitation.
- **Evidence rail.** The answer text and the evidence are separate fields
  (`NovaFinanceView`). The UI shows a natural answer first and a quiet evidence
  rail (grouped: financial records / derived / goals / documents), each item with
  its epistemic type. Only evidence returned by the context is shown.
- **Provenance & document linkage.** Recorded → `FOUNDER_PROVIDED` (or
  `DOCUMENT_DERIVED` when linked to an uploaded document), derived → `CALCULATION`.
  The document relationship is preserved; extraction is never implied.
- **Failure & unknowns.** Provider/validation failure → a calm `unavailable`
  state, never a fabricated answer; deterministic answers are unaffected by an LLM
  outage. Unknowns are first-class.
- **Security.** Server-side execution, RLS-scoped context, business-isolation
  guard in the gateway, no sensitive identifiers in context, key server-only.

Nova's regulatory (extractive) console at `/assistant` is unchanged; unifying the
two Nova surfaces is a later redesign.
