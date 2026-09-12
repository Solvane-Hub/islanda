import { intelligenceResponseSchema } from '@/lib/intelligence/schema';
import type { IntelligenceResponse } from '@/lib/intelligence/types';

/**
 * The validation choke point (ADR-0019 §"validation inside the client"): no LLM
 * output reaches the UI unless it passes. Fails safe — a malformed or
 * evidence-fabricating response is rejected, never repaired into a fake answer.
 */
export type ValidationResult =
  | { ok: true; response: IntelligenceResponse }
  | { ok: false; reason: 'not_json' | 'schema' | 'unknown_evidence' };

export function validateIntelligenceResponse(
  raw: unknown,
  allowedEvidenceIds: readonly string[],
): ValidationResult {
  let candidate: unknown = raw;
  if (typeof raw === 'string') {
    try {
      candidate = JSON.parse(raw);
    } catch {
      return { ok: false, reason: 'not_json' };
    }
  }

  const parsed = intelligenceResponseSchema.safeParse(candidate);
  if (!parsed.success) return { ok: false, reason: 'schema' };

  // The LLM may only cite evidence that was actually supplied to it — it cannot
  // invent an evidence id. This is the structural anti-fabrication guard.
  const allowed = new Set(allowedEvidenceIds);
  for (const ref of parsed.data.evidence) {
    if (!allowed.has(ref.id)) return { ok: false, reason: 'unknown_evidence' };
  }

  return { ok: true, response: parsed.data as IntelligenceResponse };
}
