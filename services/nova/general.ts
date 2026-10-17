import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { NovaGeneralAnswerView } from '@/types/nova';
import type { IntelligenceOutcome } from '@/lib/intelligence/types';
import { AppError } from '@/lib/errors';
import { containsLegalVocabulary, routeNovaQuestion } from '@/lib/nova/routing';
import {
  assembleIntelligenceContext,
  defaultGatewayDeps,
  runIntelligence,
  type GatewayDeps,
} from '@/services/intelligence';

type Db = SupabaseClient<Database>;

/**
 * Nova's general path — non-regulatory questions answered through the
 * Intelligence Gateway.
 *
 * Reached only when `routeNovaQuestion` found no regulatory signal at all. It
 * reuses the gateway end to end rather than calling a provider itself: the
 * gateway owns tier selection (ADR-0019), the provider call, the
 * evidence-id validator, `ai_usage` cost recording and the business-isolation
 * guard. This module adds exactly three things:
 *
 *   1. `requiresReasoning` — Nova has no deterministic answerer for general
 *      questions, so a `deterministic` routing becomes the `mini` tier.
 *   2. **Gate 2 — the model's category.** If the model classifies the question
 *      as regulatory or compliance (prompt rule 9 asks it to), the answer is
 *      DISCARDED, never shown, and the caller re-runs the question on the
 *      extractive path.
 *   3. **Gate 3 — an output scan.** If the answer or a recommendation uses legal
 *      vocabulary (law, licence, permit, tax, penalty…), it is discarded the
 *      same way. Rule 9 forbids that content; this checks the model obeyed.
 *
 * A model's judgement can only ever move a question TOWARD cited research,
 * never away from it.
 *
 * ⚠ Nothing here is evidence in the Trust Layer sense. A general answer has no
 *   claims and no citations, and its view type cannot carry any.
 */

/** Categories whose answers belong to the extractive, cited path — never to a model. */
const REGULATORY_CATEGORIES: ReadonlySet<string> = new Set(['regulatory', 'compliance']);

/**
 * ⚠ A deferral carries NO model output — not the answer, not a suggestion, not
 *   an unknown. The discarded response is dropped here, at the source, so no
 *   caller can return or log it even by accident. Only why it was deferred.
 */
export type NovaGeneralResult =
  | { kind: 'general'; view: NovaGeneralAnswerView; outcome: IntelligenceOutcome }
  | { kind: 'defer_to_regulatory'; reason: 'router' | 'model_category' | 'output_scan' };

export interface NovaGeneralRequest {
  question: string;
  businessId: string;
  actorId: string | null;
  correlationId: string;
}

/** Project a gateway outcome into the founder-facing general view. Pure. */
export function toNovaGeneralView(
  question: string,
  outcome: IntelligenceOutcome,
): NovaGeneralAnswerView {
  if (outcome.status === 'answered') {
    const r = outcome.response;
    return {
      outcome: 'general',
      status: 'answered',
      question,
      answer: r.answer,
      confidence: r.confidence,
      recommendations: r.recommendations,
      evidence: r.evidence,
      followUps: r.followUps,
      unknowns: r.unknowns,
    };
  }

  return {
    outcome: 'general',
    status: 'unavailable',
    question,
    answer: null,
    confidence: null,
    recommendations: [],
    evidence: [],
    followUps: [],
    unknowns: [],
    // `deterministic` cannot occur here (`requiresReasoning` is always set), but
    // if it ever did there is no answer to show, so it degrades like a response
    // we could not stand behind rather than inventing one.
    reason: outcome.status === 'unavailable' ? outcome.reason : 'validation_failed',
  };
}

export async function answerGeneralNovaQuestion(
  db: Db,
  request: NovaGeneralRequest,
  deps: GatewayDeps = defaultGatewayDeps(),
): Promise<NovaGeneralResult> {
  // Gate 1, repeated here so no caller can reach the model with a question the
  // safety router would not allow — even one that skipped the action's check.
  if (routeNovaQuestion(request.question) !== 'general') {
    return { kind: 'defer_to_regulatory', reason: 'router' };
  }

  // RLS-scoped: returns null for a business the caller does not own.
  const context = await assembleIntelligenceContext(db, request.businessId);
  if (!context) {
    throw new AppError({
      code: 'NOT_FOUND',
      humanMessage: 'We could not find that business.',
      correlationId: request.correlationId,
    });
  }

  const outcome = await runIntelligence(
    {
      question: request.question,
      businessId: request.businessId,
      context,
      actorId: request.actorId,
      correlationId: request.correlationId,
      requiresReasoning: true,
    },
    deps,
  );

  if (outcome.status === 'answered') {
    const r = outcome.response;
    // Gate 2: the model's own category. Gate 3: legal or imposed-charge
    // vocabulary in anything that would be SHOWN — the answer, every
    // suggestion and every "unknown". Either discards the whole response.
    const shown = [r.answer, ...r.recommendations.map((rec) => rec.text), ...r.unknowns];
    if (REGULATORY_CATEGORIES.has(r.category)) {
      return { kind: 'defer_to_regulatory', reason: 'model_category' };
    }
    if (containsLegalVocabulary(shown.join('\n'))) {
      return { kind: 'defer_to_regulatory', reason: 'output_scan' };
    }
  }

  return { kind: 'general', view: toNovaGeneralView(request.question, outcome), outcome };
}
