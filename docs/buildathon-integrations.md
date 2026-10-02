# Buildathon Provider Audit — Future Caribbean partner benefits

**Version:** 1.0 · **Status:** Operational audit — **NOT canonical** · **Owner:** Jamil Nash
**Date:** 2026-07-31 · **Author:** Lead engineering (audit only, no integration performed)

---

## 0. What this document is, and is not

This is an **operational audit** of the partner benefits attached to the Future Caribbean
Buildathon account. It is deliberately **not** registered in `DOCUMENT_MANIFEST.md` and is
therefore **not canonical** under the authority hierarchy in `ARCHITECTURE_MAP.md` §1.

**It amends nothing.** Every existing contract remains authoritative and unchanged:

- ADR-0019 — capability-tier `ModelClient`; provider SDKs only inside `lib/ai/providers/`
- ADR-0017 — the agent output envelope, `chunk_id` + verbatim quote, mandatory `unresolved[]`
- ADR-0018 — evaluation gates on every AI change
- K5 — retrieval pipeline, deterministic filters, mandatory `chunk_id`
- Trust Layer §8 — the canonical citation object
- AI-14 §8 — structured refusal as a designed output

No provider named here may weaken any of those. If a provider's convenience conflicts with a
contract, the contract wins and the provider is not used.

### Evidence rules applied

| Marker      | Meaning                                                               |
| ----------- | --------------------------------------------------------------------- |
| **SHOWN**   | Stated verbatim in the Builder Portal screenshots supplied 2026-07-31 |
| **DOC**     | Found in public provider documentation, cited inline                  |
| **UNKNOWN** | Not established by screenshot, repository, or provider documentation  |

**No credit balance, quota, rate limit, model list, or entitlement is asserted unless it is
SHOWN or DOC.** Where a number would be useful and is not evidenced, this document says
UNKNOWN rather than estimating. §12 lists exactly what must be verified in the Builder Portal.

---

## 1. Evidence ledger — what the screenshots actually show

Screenshot 1 is `os.futurecaribbean.com/builder/team`, section **"Partner benefits (9)"**.
Screenshot 2 is `os.futurecaribbean.com/builder/resources`, showing the **Impala × Highrise
Hackathon** gateway quickstart.

> ⚠️ **The header says 9 benefits. Eight are visible.** The BOARDY card is cut off mid-row and
> at least one further benefit sits below the fold. **The ninth benefit is UNKNOWN.**

| #   | Provider   | Offer text (verbatim from screenshot)                                                                                                                                                                                                                                                      |
| --- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | GIOTTO     | "Register for Free Giotto OS Plan here." Free builder API credentials by contacting Daniel Alvarez at `d.alvarez@giotto.ai`, mentioning FutureCaribbean. Two setup links given: a Python/API library article and a VS Code / OpenCode integration section, both on `giottoai.zendesk.com`. |
| 2   | TENKI      | "Sign up and get **$100 in free credits**."                                                                                                                                                                                                                                                |
| 3   | NOINFRA    | "Free VPS, Tokens & Support for FC Teams" — "**21 days free** on a dedicated VPS, **5M NoInfra tokens** included, and daily office hours + support." Form must be submitted; onboarding guide follows.                                                                                     |
| 4   | NEBIUS     | "**Extra Credits**" — no amount stated                                                                                                                                                                                                                                                     |
| 5   | NEBIUS     | "**Tenki Credits**" — no amount stated                                                                                                                                                                                                                                                     |
| 6   | OLLYGARDEN | "Enterprise Plan (Free Upgrade)" — sign up at `ollygarden.app`, go to "Instrumentation", **connect your GitHub repositories**                                                                                                                                                              |
| 7   | MINIMAX    | Create account, "Select Plan Details. Where it says 'Token Plan,' select 'Redeem' and paste the code provided to you." **The code itself is not shown.**                                                                                                                                   |
| 8   | BOARDY     | Card truncated — offer text UNKNOWN                                                                                                                                                                                                                                                        |
| 9   | UNKNOWN    | Below the fold                                                                                                                                                                                                                                                                             |

**Impala × Highrise (Resources page), verbatim:**

- "an OpenAI-compatible inference platform"
- "We've provisioned a shared gateway, a model, and a virtual key for every team"
- "Everything is pre-provisioned. You don't need to sign up or create a key — your team is
  assigned a virtual key **at check-in**."
- "Drop-in compatible… change the `base_url`, swap in your team key, set the model name."
- "**One model, one endpoint.** Every team hits the same gateway (`ht.getimpala.ai`) and the
  same model (`qwen3.6-27b`). Your virtual key is what identifies your team."

Note that **Impala is not listed among the nine partner benefits** — it is Resources-page
infrastructure provided to all teams. It is a different kind of entitlement.

---

## 2. The finding that governs everything below

**Extractive Nova requires no inference provider.**

Option A, approved 2026-07-31, makes the reasoner deterministic TypeScript that composes
answers from verbatim quoted passages. It performs no embedding and makes no external
inference call. Day 1 retrieval is lexical and runs entirely inside Postgres and Node.

Therefore **none of these providers is on the critical path to a working internal Nova
demonstration.** What blocks that demonstration is content — no Knowledge Pack is published,
and `supabase/seed.sql` contains none — not compute.

Three contract-level constraints reinforce this:

1. **ADR-0019:** _"Embedding models are not interchangeable. Changing one invalidates the
   entire vector corpus; it is a migration, not a configuration change."_ Selecting an
   embedding provider because it is temporarily free creates an obligation to re-embed the
   entire corpus when the credits end. **Free credits are the worst possible basis for this
   decision.**
2. **KI1 / MP-1 is an open founder decision.** Choosing an embedding model _is_ deciding KI1.
   It cannot be done incidentally by claiming a credit.
3. **ADR-0019 consequences:** _"adding a provider requires a full evaluation run before it may
   be used at all"_ — and ADR-0018's evaluation harness is blocked on **EV1**. Any generative
   provider is therefore gated behind EV1 no matter how many tokens are free.

---

## 3. Provider audits

Each provider is assessed against the thirteen questions. "Nova inference" means serving the
generative reasoner in a future Option B; it is **not** required by Option A.

---

### 3.1 IMPALA × HIGHRISE — `ht.getimpala.ai`

| #   | Question               | Finding                                                                                                                                                                                                                    |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits         | **SHOWN:** shared gateway, one model, one virtual key per team, pre-provisioned, **assigned at check-in**. Quota, rate limit and expiry: **UNKNOWN**.                                                                      |
| 2   | What it provides       | **SHOWN:** OpenAI-compatible chat completions against `qwen3.6-27b`. **DOC:** Impala AI is an inference platform for high-volume asynchronous workloads.                                                                   |
| 3   | Nova inference         | **Yes, technically** — OpenAI-compatible, so a `lib/ai/providers/impala.ts` adapter is straightforward. **But gated by EV1/ADR-0018.**                                                                                     |
| 4   | Embeddings             | **UNKNOWN.** The quickstart says "one model, one endpoint" and names only `qwen3.6-27b`. No embeddings endpoint is documented. **Assume not available until verified.**                                                    |
| 5   | Rerank/retrieval infra | No vector store or rerank endpoint documented. A chat model could be used as an LLM reranker, but that is a design choice, not a provider capability.                                                                      |
| 6   | Agent/tool execution   | **UNKNOWN** — tool-calling support on this gateway is not stated. Irrelevant regardless: our agents have no tools by design (AI-14 §10, "Autonomous action: None").                                                        |
| 7   | Suitability            | **Buildathon demo only.** A shared multi-tenant hackathon gateway with a check-in-scoped key is not production infrastructure.                                                                                             |
| 8   | Abstraction fit        | Clean. OpenAI-compatible → one adapter behind `ModelClient`, tier `reasoning` or `fast`. No leakage.                                                                                                                       |
| 9   | Lock-in                | **Very low.** OpenAI-compatible surface; swapping means changing `base_url`, key and model name.                                                                                                                           |
| 10  | Secrets                | `IMPALA_BASE_URL`, `IMPALA_API_KEY`, `IMPALA_MODEL`. Server-only, never `NEXT_PUBLIC_`.                                                                                                                                    |
| 11  | Security               | ⚠️ **Shared gateway.** Prompts from all teams traverse common infrastructure. AI-14 §10 requires "zero-retention terms" before PII reaches a provider — **retention terms are UNKNOWN**. Do not send founder profile data. |
| 12  | Cost after credits     | **UNKNOWN.** Public pricing for `getimpala.ai` was not located. Presumed to end with the event.                                                                                                                            |
| 13  | Priority               | **P0 to claim** (free, zero effort, obtained at check-in). **P3 to integrate.**                                                                                                                                            |

---

### 3.2 NEBIUS — two benefit rows

| #   | Question               | Finding                                                                                                                                                                                                                                |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits         | **SHOWN:** two rows, "Extra Credits" and "Tenki Credits". **Amounts UNKNOWN for both.** Whether they stack, and whether "Tenki Credits" means Tenki compute billed through Nebius or Nebius credits granted via Tenki, is **UNKNOWN**. |
| 2   | What it provides       | **DOC:** Nebius AI Studio / Token Factory — inference over 60+ open-source models, usage-based per-token pricing, and **three embedding models: BGE-ICL, e5-mistral-7b-instruct, bge-multilingual-gemma2**.                            |
| 3   | Nova inference         | **Yes.** Mature managed inference.                                                                                                                                                                                                     |
| 4   | Embeddings             | **Yes — the only provider in this set with documented, named embedding models.** This makes it the sole credible answer to KI1 among the benefits.                                                                                     |
| 5   | Rerank/retrieval infra | Provides embedding vectors. **No vector database** — that stays `pgvector` in our own Postgres, which is correct and keeps retrieval reproducibility (K5 §3.8) under our control.                                                      |
| 6   | Agent/tool execution   | Inference only. Appropriate — we do not want provider-side agent frameworks.                                                                                                                                                           |
| 7   | Suitability            | **Development, demo, and a genuine production candidate.**                                                                                                                                                                             |
| 8   | Abstraction fit        | Excellent. Satisfies both `ModelClient` tiers and the existing `EmbeddingProvider` interface in `lib/ai/providers/embedding.ts`, which currently throws by design.                                                                     |
| 9   | Lock-in                | **Low for inference. HIGH for embeddings** — not because of Nebius, but because ADR-0019 makes _any_ embedding choice a corpus-wide migration. The lock-in is structural, not vendor-specific.                                         |
| 10  | Secrets                | `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, plus — mandatory per K7 §3.1 — pinned `NEBIUS_EMBEDDING_MODEL`, `NEBIUS_EMBEDDING_MODEL_VERSION`, `NEBIUS_EMBEDDING_DIMENSIONS`.                                                                  |
| 11  | Security               | Standard managed-API posture. **Relevant to MP-2:** Nebius is a European cloud, which may matter to the Bahamas Data Protection Act analysis ADR-0019 flags as outstanding. That is a legal determination, not an engineering one.     |
| 12  | Cost after credits     | **DOC:** usage-based per-token, no commitment. Exact per-model rates not captured here — verify on Nebius's pricing page before relying on any figure.                                                                                 |
| 13  | Priority               | **P0 — highest strategic value of any benefit in the set.** Register and confirm balances now; integrate only when KI1 is formally decided.                                                                                            |

---

### 3.3 MINIMAX

| #   | Question               | Finding                                                                                                                                                                                                                                                           |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits         | **SHOWN:** a "Token Plan" redeemed with a code. **The code is not in the screenshot and the plan tier is UNKNOWN.**                                                                                                                                               |
| 2   | What it provides       | **DOC:** MiniMax-M3, open-weight multimodal MoE, text/image/video input, tool use, up to 1M context; standard tier ~$0.30/M input and ~$1.20/M output at ≤512K. Token Plans listed publicly at $20/$50/$120 per month. **Which tier our code grants is UNKNOWN.** |
| 3   | Nova inference         | **Yes**, technically strong — long context and tool use suit a future generative Nova. Still gated by EV1/ADR-0018.                                                                                                                                               |
| 4   | Embeddings             | **UNKNOWN** — no dedicated embedding model surfaced in documentation. Do not assume.                                                                                                                                                                              |
| 5   | Rerank/retrieval infra | None documented.                                                                                                                                                                                                                                                  |
| 6   | Agent/tool execution   | **DOC:** tool use on documented routes. Not needed — our agents have no tools by design.                                                                                                                                                                          |
| 7   | Suitability            | Development and demo. Production would require the EV1 evaluation run and an MP-2 residency answer.                                                                                                                                                               |
| 8   | Abstraction fit        | Good, via a `lib/ai/providers/minimax.ts` adapter behind `ModelClient`.                                                                                                                                                                                           |
| 9   | Lock-in                | Low-to-moderate. Open-weight model, so the weights are portable even if the API is not.                                                                                                                                                                           |
| 10  | Secrets                | `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, possibly `MINIMAX_GROUP_ID`.                                                                                                                                                                              |
| 11  | Security               | Third-party API; residency and retention terms **UNKNOWN**, and MP-2 is unresolved.                                                                                                                                                                               |
| 12  | Cost after credits     | **DOC:** monthly Token Plans or per-token pay-as-you-go at the rates above.                                                                                                                                                                                       |
| 13  | Priority               | **P1, not P0.** It is a second generative option we cannot use until EV1 is answered. Redeem the code so the entitlement is not lost; integrate nothing.                                                                                                          |

---

### 3.4 NOINFRA — `noinfra.ai`

| #   | Question               | Finding                                                                                                                                                                                                                                                                                                                                                                                                           |
| --- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits         | **SHOWN:** 21 days free dedicated VPS, 5M NoInfra tokens, daily office hours. Requires submitting a form first. **Token unit definition UNKNOWN** — "NoInfra tokens" is not established as equivalent to LLM tokens.                                                                                                                                                                                              |
| 2   | What it provides       | **DOC:** hosted AI agents with managed runtimes and starter tokens — "managed tokens are installed server-side into the runtime, while users see status and balance, **not provider keys**." Plus a dedicated VPS.                                                                                                                                                                                                |
| 3   | Nova inference         | **Indirectly**, via its managed runtime.                                                                                                                                                                                                                                                                                                                                                                          |
| 4   | Embeddings             | **UNKNOWN.**                                                                                                                                                                                                                                                                                                                                                                                                      |
| 5   | Rerank/retrieval infra | The VPS could host anything we install, but that means we operate it.                                                                                                                                                                                                                                                                                                                                             |
| 6   | Agent/tool execution   | **Yes — this is its core proposition.**                                                                                                                                                                                                                                                                                                                                                                           |
| 7   | Suitability            | **Demo only.** A 21-day window cannot underpin anything durable.                                                                                                                                                                                                                                                                                                                                                  |
| 8   | Abstraction fit        | ⚠️ **Poor, and this is the important finding.** NoInfra's model is a _hosted agent runtime_ that abstracts provider keys away from us. That is the direct inverse of ADR-0019, which requires that **we** pin and record model, version and dimensions per call for K5 §3.8 reproducibility. A runtime that hides which provider served a request makes reproducible retrieval and per-call recording impossible. |
| 9   | Lock-in                | **High at the agent-runtime layer.** Low if used purely as a VPS.                                                                                                                                                                                                                                                                                                                                                 |
| 10  | Secrets                | `NOINFRA_API_KEY` and/or VPS SSH credentials.                                                                                                                                                                                                                                                                                                                                                                     |
| 11  | Security               | Server-side key custody by a third party; opaque provider routing; a dedicated VPS we would be responsible for hardening.                                                                                                                                                                                                                                                                                         |
| 12  | Cost after credits     | **UNKNOWN.**                                                                                                                                                                                                                                                                                                                                                                                                      |
| 13  | Priority               | **Demote from P0 to P2.** The agent-runtime layer conflicts with ADR-0019. The VPS is useful only if we need to host something outside Vercel, and today we do not.                                                                                                                                                                                                                                               |

---

### 3.5 GIOTTO — `giotto.ai`

| #   | Question               | Finding                                                                                                                                                                                                                                                                                                                                                              |
| --- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits         | **SHOWN:** free Giotto OS plan by self-registration; free **builder API credentials** require emailing `d.alvarez@giotto.ai` citing FutureCaribbean. **Quota, model and duration all UNKNOWN.**                                                                                                                                                                      |
| 2   | What it provides       | **DOC:** _"next generation portable reasoning model and AI operating system"_, agentic reasoning on a single GPU, runnable on infrastructure of your choice; assistant, document upload, code support, API, agents. ⚠️ **Do not confuse with `giotto-tda` / `giotto-ph`**, which are unrelated AGPLv3 topological-data-analysis libraries under the same GitHub org. |
| 3   | Nova inference         | **Possibly**, but the API surface is not documented publicly enough to assess — the two links given are Zendesk help-centre articles, not an API reference. **UNKNOWN.**                                                                                                                                                                                             |
| 4   | Embeddings             | **UNKNOWN.**                                                                                                                                                                                                                                                                                                                                                         |
| 5   | Rerank/retrieval infra | **UNKNOWN.**                                                                                                                                                                                                                                                                                                                                                         |
| 6   | Agent/tool execution   | Claimed ("experiment with agents"), unverified.                                                                                                                                                                                                                                                                                                                      |
| 7   | Suitability            | Development experimentation only, until the API surface is known.                                                                                                                                                                                                                                                                                                    |
| 8   | Abstraction fit        | **Cannot assess.** If it is OpenAI-compatible, trivial; if it is a bespoke "AI OS" surface, it likely fights `ModelClient`.                                                                                                                                                                                                                                          |
| 9   | Lock-in                | **Potentially high** if the "AI operating system" framing means orchestration rather than plain inference. The self-hostable-on-your-own-GPU claim would reduce it, if true.                                                                                                                                                                                         |
| 10  | Secrets                | `GIOTTO_API_KEY`, `GIOTTO_BASE_URL`.                                                                                                                                                                                                                                                                                                                                 |
| 11  | Security               | **UNKNOWN.** Obtaining credentials requires an email exchange naming our team, which is fine, but no terms have been reviewed.                                                                                                                                                                                                                                       |
| 12  | Cost after credits     | **UNKNOWN.**                                                                                                                                                                                                                                                                                                                                                         |
| 13  | Priority               | **P2.** Costs one email to secure the entitlement. Do not design around it.                                                                                                                                                                                                                                                                                          |

---

### 3.6 OLLYGARDEN — `ollygarden.app`

| #   | Question               | Finding                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| --- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits         | **SHOWN:** "Enterprise Plan (Free Upgrade)". **Duration UNKNOWN.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 2   | What it provides       | **DOC:** OpenTelemetry instrumentation quality — an "Instrumentation Score", plus _Rose_, a **GitHub app that analyses instrumentation in pull requests**, and _Tulip_, a supported Collector distribution. Founded by an OpenTelemetry Governance Committee member.                                                                                                                                                                                                                                                                                       |
| 3   | Nova inference         | **No.** Not an inference provider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 4   | Embeddings             | **No.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 5   | Rerank/retrieval infra | **No.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 6   | Agent/tool execution   | **No.**                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 7   | Suitability            | Development-time tooling. Genuinely relevant to ADR-0014 (structured logging) and AI-11 observability — **later**.                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 8   | Abstraction fit        | Not applicable — it sits beside the application, not inside `ModelClient`.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| 9   | Lock-in                | **Low.** OpenTelemetry is a vendor-neutral standard; that is the point of it.                                                                                                                                                                                                                                                                                                                                                                                                                                                                              |
| 10  | Secrets                | GitHub App installation grant; possibly `OTEL_EXPORTER_OTLP_ENDPOINT` and `OTEL_EXPORTER_OTLP_HEADERS`.                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| 11  | Security               | ⚠️ **The instruction is "connect your GitHub repositories."** That grants a third party read access to a private repository containing the regulatory IP and the architecture documents. Two consequences: it is a supply-chain and confidentiality decision, not a tooling decision; and it interacts with the patent work in progress, where repository privacy is material to novelty in absolute-novelty jurisdictions. **A GitHub App grant is not a public disclosure, but it should be a deliberate decision with the terms read, not a checkbox.** |
| 12  | Cost after credits     | **UNKNOWN** — presumably a paid Enterprise tier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 13  | Priority               | **P2, and deliberately after the IP question is settled.** We have no OpenTelemetry instrumentation to score yet, so the benefit has nothing to act on today.                                                                                                                                                                                                                                                                                                                                                                                              |

---

### 3.7 TENKI — `tenki.cloud`

| #   | Question               | Finding                                                                                                                                                                                                                                                   |
| --- | ---------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits         | **SHOWN:** "$100 in free credits" on sign-up.                                                                                                                                                                                                             |
| 2   | What it provides       | **DOC:** **CI/CD — self-hosted GitHub Actions runners**, marketed at up to 90% cheaper and ~30% faster than GitHub-hosted runners; 12,500 free compute minutes monthly on the standard free tier.                                                         |
| 3   | Nova inference         | **No. Tenki is not an inference provider.** The buildathon blurb on the card ("Join a global agentic AI buildathon…") describes the event, not the product, and should not be read as an AI capability.                                                   |
| 4   | Embeddings             | **No.**                                                                                                                                                                                                                                                   |
| 5   | Rerank/retrieval infra | **No.**                                                                                                                                                                                                                                                   |
| 6   | Agent/tool execution   | **No** — it executes CI jobs, which is a different thing.                                                                                                                                                                                                 |
| 7   | Suitability            | Development infrastructure. Our CI is currently GitHub Actions (`.github/`) and is not a bottleneck.                                                                                                                                                      |
| 8   | Abstraction fit        | Not applicable.                                                                                                                                                                                                                                           |
| 9   | Lock-in                | **Low** — standard Actions workflows, "2-click migration" claimed.                                                                                                                                                                                        |
| 10  | Secrets                | Repository CI secrets would be exposed to Tenki-operated runners.                                                                                                                                                                                         |
| 11  | Security               | ⚠️ **Self-hosted runners execute our CI with our secrets.** Today those include `SUPABASE_SERVICE_ROLE_KEY` and the RLS test credentials, which bypass RLS. Moving CI to a third-party runner is a security decision requiring secret-scope review first. |
| 12  | Cost after credits     | **DOC:** usage-based; free tier of 12,500 minutes/month continues.                                                                                                                                                                                        |
| 13  | Priority               | **P3 — lowest of the technical set.** Correctly placed at P2 or below in your preliminary list; I would go lower. It solves a problem we do not have and touches secrets that bypass RLS.                                                                 |

---

### 3.8 BOARDY — business-development track

| #   | Question             | Finding                                                                                                        |
| --- | -------------------- | -------------------------------------------------------------------------------------------------------------- |
| 1   | Access/credits       | **UNKNOWN** — the card is truncated in the screenshot.                                                         |
| 2   | What it provides     | **DOC:** a voice-first AI networking agent that phones users and brokers double-opt-in introductions by email. |
| 3–6 | Technical capability | **None applicable.** Not infrastructure.                                                                       |
| 7   | Suitability          | Business development only.                                                                                     |
| 8   | Abstraction fit      | Not applicable.                                                                                                |
| 9   | Lock-in              | Not applicable.                                                                                                |
| 10  | Secrets              | None in this repository.                                                                                       |
| 11  | Security             | Personal contact data leaves our control by design. A founder-level judgement, not an engineering one.         |
| 12  | Cost                 | **UNKNOWN.**                                                                                                   |
| 13  | Priority             | **Separate track, as you had it.** No engineering time.                                                        |

---

## 4. Capability matrix

| Provider          | Nova inference | Embeddings        | Rerank | Agent runtime | CI  | Observability | Prod candidate |
| ----------------- | -------------- | ----------------- | ------ | ------------- | --- | ------------- | -------------- |
| Impala × Highrise | ✅ demo        | ❌ unknown        | ❌     | ❓            | ❌  | ❌            | ❌             |
| Nebius            | ✅             | ✅ **documented** | ❌     | ❌            | ❌  | ❌            | ✅             |
| MiniMax           | ✅             | ❓ unknown        | ❌     | ✅            | ❌  | ❌            | ⚠️ post-EV1    |
| NoInfra           | ⚠️ opaque      | ❓                | ❌     | ✅            | ❌  | ❌            | ❌             |
| Giotto            | ❓             | ❓                | ❓     | ❓            | ❌  | ❌            | ❓             |
| OllyGarden        | ❌             | ❌                | ❌     | ❌            | ❌  | ✅            | ✅ later       |
| Tenki             | ❌             | ❌                | ❌     | ❌            | ✅  | ❌            | ⚠️             |
| Boardy            | ❌             | ❌                | ❌     | ❌            | ❌  | ❌            | n/a            |

**Only Nebius has documented embedding models.** That single fact carries more weight than
every credit balance in the set, because KI1 is the critical-path founder decision per
`ARCHITECTURE_MAP.md` §9.

---

## 5. Provider-independence assessment

The architecture stays provider-independent under every option here, provided three rules hold:

1. **`lib/ai/providers/` remains the only directory importing a vendor SDK** (ADR-0019,
   already ESLint-enforced by the `lib/ai/**` restricted-import rule).
2. **Agents keep requesting a capability tier, never a model name.**
3. **No provider-side orchestration, agent runtime, or vector store is adopted.** This is the
   rule that excludes NoInfra's managed-agent layer, and it is not a preference — K5 §3.8
   reproducibility requires us to persist the exact model, version and dimensions per run,
   which is impossible when a runtime hides provider routing.

Retrieval must stay in our Postgres. `pgvector` in our own database is what makes
`RetrievalReproducibilityInputs` truthful. Moving the index to a managed vector service would
put the reproducibility contract in a vendor's hands.

---

## 6. Environment variables — reference only, none added

Nothing below has been added to `.env.example`, `lib/env.ts`, or any code. `lib/env.ts`
validates at boot and refuses to start on a half-configured environment; adding an unused
required variable would break local development for no benefit.

| Provider            | Variables (if ever integrated)                                                            | Notes                                                                          |
| ------------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| Impala              | `IMPALA_BASE_URL`, `IMPALA_API_KEY`, `IMPALA_MODEL`                                       | Server-only                                                                    |
| Nebius (inference)  | `NEBIUS_API_KEY`, `NEBIUS_BASE_URL`, `NEBIUS_MODEL`                                       | Server-only                                                                    |
| Nebius (embeddings) | `NEBIUS_EMBEDDING_MODEL`, `NEBIUS_EMBEDDING_MODEL_VERSION`, `NEBIUS_EMBEDDING_DIMENSIONS` | **All three mandatory** — K7 §3.1 requires dimensions be recorded, not assumed |
| MiniMax             | `MINIMAX_API_KEY`, `MINIMAX_BASE_URL`, `MINIMAX_MODEL`, possibly `MINIMAX_GROUP_ID`       | Server-only                                                                    |
| NoInfra             | `NOINFRA_API_KEY`, VPS SSH credentials                                                    | Not recommended                                                                |
| Giotto              | `GIOTTO_API_KEY`, `GIOTTO_BASE_URL`                                                       | Surface unknown                                                                |
| OllyGarden          | GitHub App grant; `OTEL_EXPORTER_OTLP_ENDPOINT`, `OTEL_EXPORTER_OTLP_HEADERS`             | Not a model provider                                                           |
| Tenki               | Existing CI secrets exposed to third-party runners                                        | Review secret scope first                                                      |

**None may carry the `NEXT_PUBLIC_` prefix.** Any provider key reaching the browser is a
disclosed key.

---

## 7. Cross-cutting security findings

1. **MP-2 (data residency) is unresolved**, and ADR-0019 records it as outstanding:
   _"The platform currently sends business profile data to US-based providers… This is a legal
   determination, not an engineering one."_ Every inference provider here makes that worse
   until it is answered. Nebius being a European cloud is the only datum that might help.
2. **AI-14 §10 requires zero-retention terms before PII reaches a provider.** Retention terms
   are **UNKNOWN for every provider in this set**. Until reviewed, no founder profile data
   should leave the platform — which extractive Nova already satisfies, because it sends
   nothing anywhere.
3. **Two benefits require granting third-party access to the private repository** — OllyGarden
   (GitHub App) and Tenki (CI runners holding secrets that bypass RLS). Both are supply-chain
   decisions, and OllyGarden additionally intersects the in-progress patent work, where
   repository confidentiality is material.
4. **Impala is a shared multi-tenant hackathon gateway.** Treat every prompt sent to it as
   potentially observable. Demo content only.
5. **NoInfra holds provider keys server-side on our behalf.** Convenient, and directly
   contrary to the per-call provenance ADR-0019 requires.

---

## 8. Recommended minimum stack — Day 1 to internal demonstration

**Minimum provider stack required: none.**

Nova reaches a working internal demonstration on what is already in the repository. The path is
unchanged from the approved plan:

| Day | Work                                                        | Provider needed |
| --- | ----------------------------------------------------------- | --------------- |
| 2   | Envelope, `claim-id`, deterministic reasoner, refusal test  | none            |
| 3   | Assistant Service, citation grounding gate                  | none            |
| 4   | Nova UI surface, insufficient-evidence state                | none            |
| 5   | `npm run verify`; **publish a minimal real Knowledge Pack** | none            |

**The binding constraint is the Knowledge Pack, not compute.** Two things follow, and neither
is solved by a credit:

- Trust Layer §4.6 requires **Source Authority ≥ 4 for 🟢 VERIFIED** — legislation and
  regulations only. The spec warns explicitly that a pack built from agency guidance pages
  makes almost everything display as 🟡 DERIVED. Sourcing must prioritise Acts and statutory
  instruments, and that is human work.
- Without a published pack, Nova will correctly answer `no_published_knowledge` to every
  question. That is honest, and it is not a demo.

### What to claim now, without integrating

| Action                                              | Why                                                                                | Effort  |
| --------------------------------------------------- | ---------------------------------------------------------------------------------- | ------- |
| Collect the **Impala virtual key at check-in**      | Free, zero effort, and it expires with the event                                   | minutes |
| **Register Nebius** and record both credit balances | Only documented embeddings; the sole real input to KI1; EU residency may help MP-2 | ~15 min |
| **Redeem the MiniMax code**                         | Entitlement is lost otherwise; no integration implied                              | ~10 min |
| **Email Giotto** for builder credentials            | One email preserves an option                                                      | ~5 min  |
| **Defer** NoInfra, OllyGarden, Tenki                | Runtime conflicts with ADR-0019; the other two need repo access decisions first    | —       |
| **Boardy** → business-development track             | Not engineering                                                                    | —       |

Total: under an hour of account admin, **zero lines of code, zero new dependencies, zero
architectural commitment.**

### If Option B (generative Nova) is later approved

Order of preference on current evidence: **Nebius** (mature, documented, EU) → **MiniMax**
(strong model, open weights) → **Impala** (demo only) → **Giotto** (unknown surface). All four
remain gated behind **EV1**, because ADR-0019 requires a full evaluation run before a provider
may be used at all, and ADR-0018's harness cannot be calibrated without the gold standard.

---

## 9. Recommended priority — revised

| Preliminary        | Revised                                    | Reason                                                                   |
| ------------------ | ------------------------------------------ | ------------------------------------------------------------------------ |
| P0 Impala/Highrise | **P0 claim / P3 integrate**                | Free and expiring, but demo-only shared infrastructure                   |
| P0 Nebius          | **P0 — confirmed, and the most important** | Only documented embeddings; only real KI1 candidate                      |
| P0 MiniMax         | **P1**                                     | Good model, unusable until EV1; redeem the code regardless               |
| P0 NoInfra         | **P2 — demoted**                           | Managed agent runtime conflicts with ADR-0019 per-call provenance        |
| P1 Giotto          | **P2**                                     | API surface undocumented; one email to preserve the option               |
| P1 OllyGarden      | **P2 — after the IP decision**             | Requires private-repo access; nothing to instrument yet                  |
| P2 Tenki           | **P3 — demoted**                           | CI/CD, not AI; would expose RLS-bypassing secrets to third-party runners |
| Boardy separate    | **Confirmed separate**                     | Business development                                                     |

---

## 10. What I need you to verify in the Builder Portal

Everything below is **UNKNOWN** and cannot be resolved from the screenshots, the repository, or
public documentation. Please do not let me guess at any of it.

1. **The ninth partner benefit.** Nine are claimed; eight are visible; BOARDY is truncated.
2. **Nebius "Extra Credits" — amount, expiry, and which Nebius product** (AI Studio / Token
   Factory) the credits apply to.
3. **Nebius "Tenki Credits" — amount**, and whether this is Nebius credit granted via Tenki or
   Tenki compute billed through Nebius. The two rows may or may not stack.
4. **MiniMax redeem code**, and which Token Plan tier it grants (Plus / Max / Ultra / other).
5. **Impala quota and rate limits** per team virtual key, and whether the gateway exposes an
   **embeddings endpoint** in addition to `qwen3.6-27b`.
6. **Impala data-retention terms** — required by AI-14 §10 before any real content is sent.
7. **NoInfra token unit** — are "5M NoInfra tokens" LLM tokens, and against which models?
8. **NoInfra start date** — does the 21 days begin at form submission or at provisioning?
9. **OllyGarden Enterprise Plan duration**, and the exact GitHub App permission scope requested.
10. **Giotto builder credentials** — model, quota, API surface, and whether it is
    OpenAI-compatible. Requires the email to `d.alvarez@giotto.ai`.
11. **Tenki $100 credit expiry.**
12. **Boardy offer terms** once the card is scrolled into view.

I will not update this document with any of these until you confirm them from the portal.

---

## 11. Sources

Provider documentation consulted for this audit:

- [Nebius AI Studio — embeddings, vision and language models](https://nebius.com/blog/posts/studio-embeddings-vision-and-language-models)
- [Nebius Token Factory](https://nebius.com/services/token-factory)
- [MiniMax API Docs — product pricing](https://platform.minimax.io/docs/pricing/overview)
- [MiniMax M3 — OpenRouter](https://openrouter.ai/minimax/minimax-m3)
- [Impala — inference for async AI agents](https://www.getimpala.ai/)
- [Impala AI emerges from stealth with $11M Seed — Calcalist](https://www.calcalistech.com/ctechnews/article/byuzxcykbl)
- [NoInfra — hosted AI agents without infrastructure setup](https://noinfra.ai/)
- [Tenki Cloud](https://tenki.cloud/)
- [Tenki Cloud docs — Built with Tenki / free credits](https://www.tenki.cloud/docs/built-with-tenki)
- [OllyGarden](https://ollygarden.com/)
- [Meet Rose — OllyGarden's AI instrumentation agent](https://blog.olly.garden/meet-rose-ollygardens-ai-instrumentation-agent)
- [Giotto.ai](https://www.giotto.ai/)
- [Boardy — TechCrunch coverage](https://techcrunch.com/2024/10/24/ai-networking-startup-boardy-raises-3m-pre-seed/)

Buildathon documentation consulted: Builder Portal `/builder/team` (Partner benefits) and
`/builder/resources` (Impala × Highrise gateway quickstart), via screenshots supplied
2026-07-31.
