import type {
  EvidenceRef,
  IntelligenceConfidence,
  IntelligenceOutcome,
  IntelligenceRecommendation,
} from '@/lib/intelligence/types';
import type { DeterministicFinancialAnswer } from '@/lib/intelligence/financial-answer';

/**
 * Nova's financial view — the presentation projection of a gateway outcome.
 *
 * It unifies the three outcomes into one shape the UI renders: a deterministic
 * answer (no LLM), a validated LLM answer, or a calm unavailable state. Answer
 * first, evidence second — the conversational text and the evidence are separate
 * fields so the UI can keep the answer clean and the evidence in a quiet rail.
 */
export type NovaFinanceStatus = 'deterministic' | 'answered' | 'unavailable';

export interface NovaFinanceView {
  status: NovaFinanceStatus;
  question: string;
  category: string;
  /** Null only on an unavailable outcome with nothing deterministic to show. */
  answer: string | null;
  confidence: IntelligenceConfidence | null;
  recommendations: readonly IntelligenceRecommendation[];
  evidence: readonly EvidenceRef[];
  followUps: readonly string[];
  unknowns: readonly string[];
  /** Present only when status is 'unavailable'. */
  reason?: 'provider_not_configured' | 'provider_error' | 'validation_failed' | 'unrecognized';
  /** True when a model was actually invoked (drives the "reasoned" affordance). */
  llmCalled: boolean;
}

const UNAVAILABLE_COPY: Record<NonNullable<NovaFinanceView['reason']>, string> = {
  provider_not_configured:
    'Nova’s reasoning layer isn’t configured yet, so I can’t interpret that right now. I can still answer questions about your recorded figures.',
  provider_error:
    'Nova’s reasoning layer is temporarily unavailable, so I can’t interpret that right now. Your recorded figures are unaffected — try again shortly.',
  validation_failed:
    'I wasn’t able to produce an answer I could stand behind for that, so I’m not going to guess. Try rephrasing, or ask about a specific figure.',
  unrecognized:
    'I can answer questions about your recorded figures — revenue, expenses, profit, margin and growth. I couldn’t match that one to your financial data.',
};

export function toNovaFinanceView(
  question: string,
  outcome: IntelligenceOutcome,
  deterministic: DeterministicFinancialAnswer | null,
): NovaFinanceView {
  if (outcome.status === 'deterministic') {
    if (deterministic) {
      return {
        status: 'deterministic',
        question,
        category: outcome.category,
        answer: deterministic.answer,
        confidence: 'high', // a recorded/derived figure is not a guess
        recommendations: [],
        evidence: deterministic.evidence,
        followUps: [],
        unknowns: deterministic.unknowns,
        llmCalled: false,
      };
    }
    return {
      status: 'unavailable',
      question,
      category: outcome.category,
      answer: null,
      confidence: null,
      recommendations: [],
      evidence: [],
      followUps: [],
      unknowns: [],
      reason: 'unrecognized',
      llmCalled: false,
    };
  }

  if (outcome.status === 'answered') {
    const r = outcome.response;
    return {
      status: 'answered',
      question,
      category: r.category,
      answer: r.answer,
      confidence: r.confidence,
      recommendations: r.recommendations,
      evidence: r.evidence,
      followUps: r.followUps,
      unknowns: r.unknowns,
      llmCalled: true,
    };
  }

  // unavailable
  return {
    status: 'unavailable',
    question,
    category: outcome.category,
    answer: null,
    confidence: null,
    recommendations: [],
    evidence: [],
    followUps: [],
    unknowns: [],
    reason: outcome.reason,
    llmCalled: outcome.usage.llmCalled,
  };
}

export function novaFinanceUnavailableCopy(reason: NonNullable<NovaFinanceView['reason']>): string {
  return UNAVAILABLE_COPY[reason];
}
