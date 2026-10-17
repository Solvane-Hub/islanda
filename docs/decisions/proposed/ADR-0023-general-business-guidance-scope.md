# ADR-0023 — General business guidance in Nova (scope amendment)

**Date:** 2026-10-10 · **Status:** 🟡 **PARTIALLY ACCEPTED (2026-10-10) — internal testing only.** D1 accepted in principle, D2 accepted as an exception for internal testing; D3/D4 open blockers for founder-facing release.
Filed under `docs/decisions/proposed/` and deliberately absent from `DOCUMENT_MANIFEST.md`;
on acceptance it moves to `docs/decisions/`, is registered, and `CLAUDE.md` is amended.

## Context

`CLAUDE.md` (Current position) states: _"Generative Nova remains out of scope until ADR-0018's
evaluation harness exists and its hard gates (citation validity 100%, fabrication 0) can be
demonstrated."_ That harness does not exist — the AI Evaluation Framework is blocked on EV1.

The founder has asked for Nova to answer general business questions (marketing, branding,
pricing, planning) using the existing OpenAI provider, while regulatory research stays
extractive. An implementation exists on `post-competition/business-object`, uncommitted.

Governing documents: ADR-0015 (trust model), ADR-0017 (agent output contract), ADR-0018
(evaluation gates), ADR-0019 (provider abstraction; **residency outstanding**), AI Safety
Framework (doc 14: S1–S5, §6 advice boundary, §10 PII to providers, SF1–SF3), Prompt
Engineering Standard (doc 8 §8 testing obligations), `intelligence-gateway.md` (P5–P6).

Precedent: the finance panel (P6) already sends business context to OpenAI through the
Intelligence Gateway with prompt `intelligence-gateway@1.0.0`, also without an ADR-0018
evaluation run. This ADR does not ratify that retroactively; it records it.

## Options considered

1. **Keep Nova fully extractive** until the ADR-0018 harness exists. Safest; no general
   answers at all.
2. **Route every question to the model, with citations where available.** Rejected: a model in
   the regulatory path reintroduces H2 (fabrication), which the extractive design makes
   structurally impossible.
3. **Split by question type** — general guidance through the gateway; regulatory and compliance
   research on the unchanged extractive path, with a router that fails toward extractive.

## Decision (proposed)

**Option 3**, with these boundaries:

### A. General business guidance — MAY use the Intelligence Gateway

- Only questions that match a recognised general-business topic AND carry no regulatory,
  permission/obligation, or regulated-domain signal (`lib/nova/routing.ts`, an allowlist).
  Anything unrecognised is regulatory.
- Through `runIntelligence` only: tier-based model selection (ADR-0019), schema validation,
  evidence-id validation, `ai_usage` accounting, business-isolation guard, failover off.
- Two further gates, each sufficient to discard an answer unseen and re-run the question on the
  extractive path: the model's own category (`regulatory`/`compliance`), and a legal-vocabulary
  scan of the answer and recommendations.
- Rendered as a distinct type (`NovaGeneralAnswerView`, `outcome: 'general'`) with no claims,
  citations, Trust Level or knowledge version, in its own panel, with a permanent notice:
  general guidance, not from cited sources, not legal/tax/regulatory advice.
- Suggestions are typed `RECOMMENDATION`/`INFERENCE` only (schema-enforced). Business
  suggestions about marketing, branding, pricing tactics and planning are treated as
  **information-adjacent guidance, not regulated advice**. Legal, tax, employment, business-
  structure and financial-product questions are vetoed by the router (AI Safety §6, H5).
- Not an `agent_executions` run (no agent, no pack). Recorded by the `ai_usage` row and a
  shape-only audit event, as for the finance panel.

### B. Regulatory and compliance research — MUST NOT call a generative model

- Unchanged: Knowledge Pack retrieval (K5), deterministic quoting reasoner, ADR-0017 envelope,
  `assertCitationsGrounded`, amendment handling, `agent_executions` (fails closed).
- No code path from a regulatory question to a model. A model's judgement can only move a
  question TOWARD this path, never away from it.
- Answering regulatory questions never depends on `OPENAI_API_KEY`.

### C. Gateway prompt rule 9 (`intelligence-gateway@1.1.0`, shared with the finance panel)

Forbids stating laws, rates, fees, deadlines or requirements, or naming a legal source; asks for
a `regulatory`/`compliance` category instead; explicitly does not restrict figures, labels or
goals supplied in context. Shared deliberately: 1.0.0 did not forbid the finance panel from
stating a tax rate from memory.

### D. What this ADR does NOT decide (remains open)

- **ADR-0018 evaluation.** No harness exists. See _Interim gate_ below — requires founder
  acceptance; it is an exception to ADR-0018's letter, not a satisfaction of it.
- **SF1 (disclaimer) / SF3 (accountability).** Unresolved. The general-guidance notice is
  engineer-written copy, not a legal determination.
- **MP-2 / ADR-0019 residency, and AI Safety §10 zero-retention terms.** Unresolved. The general
  path sends business context (legal and trading name, industry, location, activities, goals,
  recorded figures) to a US provider. For a sole trader, the legal name may be a personal name.
  Provider retention terms have not been verified.
- **Generative regulatory interpretation.** Still out of scope until ADR-0018's hard gates can be
  demonstrated. Nothing here relaxes that.

### Decision register (founder decisions recorded 2026-10-10)

| #   | Decision                                                                                                                    | Founder decision                                                                     |
| --- | --------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| D1  | Scope split (A/B above); amends `CLAUDE.md` "generative Nova remains out of scope"                                          | ✅ **Accepted in principle.** `CLAUDE.md` not yet amended                            |
| D2  | Interim gate below as an **explicit exception to ADR-0018**                                                                 | ✅ **Accepted for internal testing only** — an exception, NOT fulfilment of ADR-0018 |
| D3  | SF1 (disclaimer) / SF3 (accountability)                                                                                     | 🔴 **Open — blocker for founder-facing release**                                     |
| D4  | MP-2 data residency (ADR-0019) and AI Safety §10 zero-retention terms                                                       | 🔴 **Open — blocker for founder-facing release**                                     |
| D5  | Advice boundary: marketing/branding/pricing/planning suggestions in scope; legal, tax, employment, structure, financial out | ✅ Accepted                                                                          |
| D6  | Rule 9 shared with the finance panel (with the context carve-out)                                                           | 🟡 **Shared provisionally**, subject to finance-panel regression tests               |
| D7  | Refusals for some benign questions as the cost of default-to-regulatory routing                                             | ✅ Accepted                                                                          |
| D8  | Premium escalation: the gateway's PREMIUM pattern matches bare "strategy" and "business plan" (see below)                   | ⏳ **Pending** — no model policy changed                                             |

**Still outstanding under D2 (not waived):** the ADR-0018 evaluation harness (EV1), and live-model
behavioural refusal and injection tests (Prompt Engineering Standard §8).

**D8 — finding.** `lib/intelligence/router.ts` sends any question containing "strategy" or
"business plan" to the premium tier (`gpt-5.4`, about 10× mini on input and 5× on output at the
configured prices). "What is a good pricing strategy for a new bakery?" and "How do I write a simple
business plan?" therefore escalate, on the finance panel as well as Nova's general path. The gateway
doc reserves premium for _explicit multi-source_ strategy/planning ("12-month growth strategy from my
history + goals"), so this looks like regex over-breadth, not intended policy. Options: (a) narrow the
PREMIUM pattern to explicit multi-source/period planning (affects both surfaces); (b) cap Nova's
general path at `mini`; (c) keep as is. Recommendation: (a). Not implemented pending decision.

### Interim gate — an EXCEPTION to ADR-0018, not compliance with it (proposed, D2)

ADR-0018 requires an evaluation-suite run before merging any prompt or model change. No suite
exists (EV1). The gate below substitutes for it on the general path only, until it does. It does
not satisfy ADR-0018's hard gates, and it confers nothing on the regulatory path.

Until the ADR-0018 harness exists, a change to the gateway prompt, model tier mapping, or Nova
routing may merge only if:

1. the routing regression corpus (`tests/unit/nova/routing.test.ts`) passes 100%, with every
   newly discovered false negative added as a case;
2. the gateway's fixture tests pass — schema conformance, fabricated-evidence rejection, model-
   category re-route, output-scan re-route, unconfigured/provider-error degradation;
3. a recorded manual smoke run against the real provider covers at least: three general
   questions, three regulatory questions (no `ai_usage` row), and two adversarial prompts
   attempting to elicit a rate or deadline (must be discarded or refused).

Known shortfall against doc 8 §8: there is no **behavioural** refusal or injection test against a
live model — only static and fixture tests. This is accepted for the interim, not waived.

### Interim gate record (2026-10-10/11)

Live checks, recorded from what actually ran — not from mocked tests:

| Check                                              | How performed                                                                   | Result                                                                                                                                                                                               |
| -------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| General answers                                    | Founder's smoke test in the local app; `ai_usage` rows inspected                | ✅ 3 `gpt-5.4-mini` answers, validated, audited shape-only                                                                                                                                           |
| Adversarial leak (probe)                           | Real provider + real prompt 1.1.0 + real gates, synthetic context, no DB writes | ❌ 1 of 4 shown: "…percentage gets added to prices at checkout" — invented a reason for the charge. **Fixed** by the imposed-charge router group, gate 1 inside the service, and a wider output scan |
| Adversarial A (original leak) and B, after the fix | Local app (current working tree), signed in as the e2e test account             | ✅ Both routed to the cited path; quoted the VAT Act; **no `ai_usage` row** (no model call)                                                                                                          |
| Regulatory isolation, same code version            | Same session                                                                    | ✅ `agent_executions` with `none:deterministic-extractive`; no `ai_usage` row                                                                                                                        |
| General control, same code version                 | Same session                                                                    | ✅ 1 `gpt-5.4-mini` answer, labelled general guidance                                                                                                                                                |
| Missing API key                                    | —                                                                               | ⏳ **Not yet performed live.** Requires removing the key from `.env.local` and restarting the dev server (founder action). Covered only by unit tests so far                                         |

## Consequences

- Founders can get general guidance without weakening any regulatory guarantee.
- The router defaults to regulatory, so some benign questions receive an extractive refusal
  ("the sources do not cover this"). Accepted: a false positive costs a refusal; a false
  negative costs trust (S1).
- Two Nova capabilities now differ in epistemic standing; the UI must keep them visually and
  textually distinct. A future redesign must not merge their panels.
- Follow-ups: add `prompt_version` to `ai_usage` (today rows from 1.0.0 and 1.1.0 are
  distinguishable only by time); build the general-path portion of the evaluation harness when
  EV1 is resolved; revisit router vocabulary per jurisdiction as Knowledge Packs are added.

## References

`CLAUDE.md` · ADR-0015 · ADR-0017 · ADR-0018 · ADR-0019 · AI Safety Framework §4, §6, §10, §15 ·
Prompt Engineering Standard §8 · `docs/architecture/intelligence-gateway.md` ·
`lib/nova/routing.ts` · `services/nova/general.ts` · `lib/intelligence/prompt.ts`
