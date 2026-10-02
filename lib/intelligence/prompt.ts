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
export const INTELLIGENCE_PROMPT_VERSION = 'intelligence-gateway@1.0.0';

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
