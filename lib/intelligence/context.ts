import type { FactProvenance } from '@/types/business';
import type { NovaPerformanceContext } from '@/lib/business-intelligence/performance';
import type { EpistemicType, EvidenceRef, IntelligenceContext } from '@/lib/intelligence/types';

/**
 * Context builder — the controlled assembly of what an LLM may see. Pure.
 *
 * ⚠ There is no field here for a tax id, registration or licence number. The
 *   input shape cannot carry one, so a sensitive identifier can never reach the
 *   model context — the exclusion is structural, not a filter (Security/Privacy
 *   by Default, continuing the P0–P4 principle).
 *
 * It also turns the business's real facts into an EVIDENCE set with ids, so the
 * response can reference evidence rather than restating figures — and the
 * validator can reject any evidence id the LLM did not receive.
 */

export interface IntelligenceContextInput {
  businessId: string;
  identity: {
    legalName: string | null;
    tradingName: string | null;
    businessType: string | null;
    industry: string | null;
    jurisdiction: string | null;
    stage: string | null;
    operatingStatus: string | null;
  };
  definition: {
    activities: string | null;
    productsServices: string | null;
    targetCustomers: string | null;
    location: string | null;
  };
  goals: { title: string; targetLabel: string | null; progressPercent: number | null }[];
  performance: NovaPerformanceContext | null;
}

/** Map a stored metric's provenance to an epistemic type for the LLM. */
function epistemicForMetric(
  basis: 'recorded' | 'derived',
  provenance: FactProvenance | null,
): EpistemicType {
  if (basis === 'derived') return 'CALCULATION';
  switch (provenance) {
    case 'user_document':
      return 'DOCUMENT_DERIVED';
    case 'external_public_data':
      return 'EXTERNAL_DATA';
    case 'evidence_verified':
      return 'VERIFIED_FACT';
    case 'ai_inferred':
      return 'INFERENCE';
    case 'founder_provided':
    default:
      return 'FOUNDER_PROVIDED';
  }
}

export function buildIntelligenceContext(input: IntelligenceContextInput): IntelligenceContext {
  const evidence: EvidenceRef[] = [];

  if (input.performance) {
    const source = input.performance.periodLabel ?? 'current period';
    for (const m of input.performance.metrics) {
      evidence.push({
        id: `metric:${m.key}:${m.basis}`,
        type: 'financial_metric',
        source,
        provenance: epistemicForMetric(m.basis, m.provenance),
      });
    }
  }

  input.goals.forEach((g, i) => {
    evidence.push({
      id: `goal:${i}`,
      type: 'goal',
      source: g.title,
      provenance: 'FOUNDER_PROVIDED',
    });
  });

  return {
    businessId: input.businessId,
    identity: { ...input.identity },
    definition: { ...input.definition },
    goals: input.goals.map((g) => ({ ...g })),
    performance: input.performance,
    evidence,
  };
}
