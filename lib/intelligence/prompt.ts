import { INTELLIGENCE_CATEGORIES } from '@/lib/intelligence/types';
import type { IntelligenceContext } from '@/lib/intelligence/types';
import type { RoutingDecision } from '@/lib/intelligence/router';

/**
 * Prompt construction (Prompt Engineering Standard: prompts are source code,
 * versioned, in Git). Versioned so a change is deliberate and recorded.
 *
 * The system prompt encodes the gateway's non-negotiables: return ONLY the JSON
 * contract; never invent figures (all numbers come from the supplied context);
 * preserve epistemic distinctions (never upgrade FOUNDER_PROVIDED to
 * VERIFIED_FACT, never turn UNKNOWN into FACT); cite evidence only by supplied
 * id; put anything unestablished in `unknowns`.
 */
export const INTELLIGENCE_PROMPT_VERSION = 'intelligence-gateway@1.1.0';

/**
 * Rule 9 (added in 1.1.0, when Nova's general path began using the gateway).
 *
 * Regulatory knowledge reaches a founder ONLY through Nova's extractive,
 * cited research over the published Knowledge Pack. A model stating a rate, fee,
 * deadline or requirement from memory would be exactly the fabrication that path
 * makes structurally impossible, so the gateway forbids it outright and asks the
 * model to classify such a question as regulatory/compliance — which the Nova
 * general path treats as a signal to discard the answer and re-route.
 *
 * The rule is SHARED with the finance panel deliberately: 1.0.0 never forbade
 * that surface from stating a tax rate from memory either. The final sentence
 * is the carve-out that keeps finance behaviour intact — the founder's own
 * figures and goals in CONTEXT (which may carry labels like "licence fees") are
 * facts the model may still report, with their provenance.
 */
export const REGULATORY_BOUNDARY_RULE =
  '9. NEVER state laws, regulations, tax or VAT rates, fees, fines, filing deadlines, licensing, ' +
  'registration or permit requirements, or any legal obligation, and NEVER cite or name a law, ' +
  "regulation or official source. Those come only from Islanda's cited regulatory research. If " +
  'the question depends on them, set "category" to "regulatory" or "compliance", say that Nova\'s ' +
  'source-cited research answers that part, and add what is unknown to "unknowns". This does not ' +
  "restrict figures, labels or goals supplied in CONTEXT — the founder's own records may be " +
  'reported as given, with their provenance.';

export function buildSystemPrompt(): string {
  return [
    "You are Nova, Islanda's intelligence layer for a Caribbean business operating system.",
    'You reason and communicate on top of facts that are given to you. You are NOT the source of truth.',
    '',
    'Rules:',
    '1. Respond with a SINGLE JSON object and nothing else. No markdown, no prose outside JSON.',
    '2. Shape: { "answer": string, "category": string, "confidence": "low"|"medium"|"high", ' +
      '"recommendations": [{ "text": string, "basis": "RECOMMENDATION"|"INFERENCE" }], ' +
      '"evidence": [{ "id": string, "type": string, "source": string, "provenance": string }], ' +
      '"followUps": [string], "unknowns": [string] }.',
    `3. "category" must be one of: ${INTELLIGENCE_CATEGORIES.join(', ')}.`,
    '4. NEVER invent numbers, dates, names or figures. Every fact and figure must come from the CONTEXT.',
    '5. Preserve provenance. NEVER present founder-provided information as verified. NEVER present ' +
      'something unknown as a fact. If you do not have the information, add it to "unknowns".',
    '6. Cite evidence ONLY by an id that appears in CONTEXT.evidence. Do not invent evidence ids.',
    '7. Recommendations are suggestions, not facts: "basis" is always RECOMMENDATION or INFERENCE.',
    '8. Be calm, precise and honest. Prefer "I cannot determine X" over a confident guess.',
    REGULATORY_BOUNDARY_RULE,
  ].join('\n');
}

export function buildUserPrompt(question: string, context: IntelligenceContext): string {
  // Only the controlled context — no sensitive identifiers exist on this object.
  return JSON.stringify({ question, context }, null, 0);
}

export function buildMessages(
  question: string,
  context: IntelligenceContext,
  _decision: RoutingDecision,
): { system: string; user: string } {
  return { system: buildSystemPrompt(), user: buildUserPrompt(question, context) };
}
