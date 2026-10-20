'use server';

import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import { canUse } from '@/lib/product/release';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import type { NovaResponseView } from '@/types/nova';
import { routeNovaQuestion } from '@/lib/nova/routing';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getCurrentUser } from '@/services/auth';
import { getIntakeProfile } from '@/services/intake';
import { recordAuditEvent } from '@/services/audit';
import { manifestForJurisdiction } from '@/services/knowledge/manifests/registry';
import { answerNovaQuestion } from '@/services/nova/answer';
import { answerGeneralNovaQuestion } from '@/services/nova/general';
import { buildNovaContext, buildQueryRepresentation } from '@/services/nova/context';
import { toNovaBusinessFacts } from '@/services/nova/business-awareness';
import { consumeNovaRateLimit, rateLimitMessage } from '@/services/nova/rate-limit';
import {
  executionEntryForAnswer,
  executionEntryForFailure,
  executionNotRecordedError,
  recordNovaExecution,
} from '@/services/nova/execution';
import { toNovaAnswerView } from '@/services/nova/view';

/**
 * Nova's server action.
 *
 * Thin by design (ADR-0003): validate, resolve, delegate. Every behaviour lives
 * in `services/nova/*`.
 *
 * Order matters, and each step's failure policy is deliberate:
 *
 *   1. validate            → reject malformed input
 *   2. resolve user + business
 *   3. RATE LIMIT          → fails CLOSED; an unreachable limiter denies
 *   4. answer — routed by `routeNovaQuestion`, which fails toward 4b:
 *        4a. general     → Intelligence Gateway (validated LLM, `ai_usage`)
 *        4b. regulatory  → extractive, cited, no model (unchanged)
 *   5. RECORD EXECUTION    → 4b only; fails CLOSED; an unrecordable answer is withheld
 *   6. audit               → fails OPEN (ADR-0012), inside the service
 *   7. return the view
 *
 * ⚠ Returns a `NovaResponseView`, never a `NovaAnswer`. The projection strips the
 *   envelope's machine-facing `reasoning`, which ADR-0017 §5 says is "never
 *   rendered to a founder". A general answer is a separate type
 *   (`outcome: 'general'`) that cannot carry claims or citations.
 */

const askSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, 'Ask a question of at least a few words.')
    .max(500, 'Keep your question under 500 characters.'),
});

async function requestMeta(): Promise<{ ipAddress: string | null; userAgent: string | null }> {
  const h = await headers();
  return {
    ipAddress: h.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null,
    userAgent: h.get('user-agent'),
  };
}

export async function askNovaAction(
  _previous: Result<NovaResponseView> | null,
  formData: FormData,
): Promise<Result<NovaResponseView>> {
  const correlationId = newCorrelationId();
  // Not released to founders yet: refuse before reading or rate-limiting anything.
  if (!canUse('cited_answers')) {
    return fail(
      new AppError({
        code: 'NOT_FOUND',
        humanMessage: 'This is not available.',
        correlationId,
      }),
    );
  }

  const parsed = askSchema.safeParse({ question: formData.get('question') });
  if (!parsed.success) {
    return fail(
      new AppError({
        code: 'VALIDATION_FAILED',
        humanMessage: 'That question could not be sent.',
        correlationId,
      }),
      toFieldErrors(parsed.error.issues),
    );
  }

  const { question } = parsed.data;

  const db = await createClient();
  const [user, businesses, store, meta] = await Promise.all([
    getCurrentUser(db),
    listBusinesses(db),
    cookies(),
    requestMeta(),
  ]);

  if (!user) {
    return fail(
      new AppError({
        code: 'AUTH_SESSION_EXPIRED',
        humanMessage: 'Sign in to ask Nova a question.',
        correlationId,
      }),
    );
  }

  const business = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);
  if (!business) {
    return fail(
      new AppError({
        code: 'NOT_FOUND',
        humanMessage: 'Create a business before asking Nova a question.',
        correlationId,
      }),
    );
  }

  // ── 3. Rate limit — fails closed ────────────────────────────────────────
  try {
    const limit = await consumeNovaRateLimit(db, {
      userId: user.id,
      businessId: business.id,
    });

    if (!limit.allowed) {
      await recordAuditEvent({
        event: 'nova.rate_limited',
        actorId: user.id,
        businessId: business.id,
        correlationId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        // Shape only. No question, no content.
        metadata: { scope: limit.deniedScope, retryAfterSeconds: limit.retryAfterSeconds },
      });

      return fail(
        new AppError({
          code: 'RATE_LIMITED',
          humanMessage: rateLimitMessage(limit),
          correlationId,
        }),
      );
    }
  } catch (error) {
    // An unreachable limiter is not permission. Deny, loudly.
    logger.error('nova.rate_limit_unavailable', {
      correlationId,
      code: error instanceof Error ? error.name : 'unknown',
    });
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'Nova is temporarily unavailable. Please try again shortly.',
        developerMessage: 'Rate limiter unavailable; request denied rather than assumed permitted.',
        correlationId,
        cause: error,
      }),
    );
  }

  // ── 4a. General path — allowlisted general-business questions only ───────
  //
  // `routeNovaQuestion` is an allowlist; anything unrecognised takes 4b. See
  // lib/nova/routing.ts. A general answer is not regulatory guidance and carries
  // no claims or citations, so it is not an `agent_executions` run: the gateway's
  // `ai_usage` row (provider, model, tokens, cost, validation) is its record,
  // exactly as for the finance surface. If the model labels the question
  // regulatory, or its answer uses legal vocabulary, the answer is discarded
  // unseen and the question falls through to the cited path below.
  if (routeNovaQuestion(question) === 'general') {
    try {
      const general = await answerGeneralNovaQuestion(db, {
        question,
        businessId: business.id,
        actorId: user.id,
        correlationId,
      });

      if (general.kind === 'general') {
        await recordAuditEvent({
          event: general.view.status === 'answered' ? 'nova.answered' : 'nova.failed',
          actorId: user.id,
          businessId: business.id,
          correlationId,
          ipAddress: meta.ipAddress,
          userAgent: meta.userAgent,
          // Shape only. No question, no content.
          metadata: {
            surface: 'general',
            category: general.outcome.category,
            determination: general.outcome.usage.determination,
            llmCalled: general.outcome.usage.llmCalled,
            status: general.view.status,
            ...(general.view.reason ? { reason: general.view.reason } : {}),
          },
        });
        return ok(general.view);
      }

      // The deferral carries no model output by construction — only the reason.
      logger.info('nova.general_deferred_to_regulatory', { correlationId, reason: general.reason });
    } catch (error) {
      logger.error('nova.general_unexpected', {
        correlationId,
        code: error instanceof Error ? error.name : 'unknown',
      });
      await recordAuditEvent({
        event: 'nova.failed',
        actorId: user.id,
        businessId: business.id,
        correlationId,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
        metadata: {
          surface: 'general',
          code: error instanceof AppError ? error.code : 'UNEXPECTED',
        },
      });
      if (error instanceof AppError) return fail(error);
      return fail(
        new AppError({
          code: 'UNEXPECTED',
          humanMessage: 'Nova could not answer that. Please try again.',
          correlationId,
          cause: error,
        }),
      );
    }
  }

  // ── 4b. Regulatory path — extractive, cited, no model ────────────────────
  const queryRepresentation = buildQueryRepresentation(question, business, null);

  try {
    const profile = await getIntakeProfile(db, business.id);

    // The amendment chain for this jurisdiction. Resolved from the registry
    // rather than passed in or hard-coded, so no country is special-cased in
    // the runtime path. A jurisdiction with no registered manifest does NOT
    // silently lose its amendment handling — every claim's current position
    // becomes explicitly unestablished. See services/knowledge/manifests/registry.ts.
    const manifest = manifestForJurisdiction(business.country_code);

    const answer = await answerNovaQuestion(db, {
      context: buildNovaContext(business, profile),
      question,
      queryRepresentation: buildQueryRepresentation(question, business, profile),
      // Non-sensitive Business Object facts for the business-aware layer. This
      // builder has no identifier field, so a tax id or registration number
      // cannot travel with the request or reach the execution record.
      business: toNovaBusinessFacts(business, profile),
      ...(manifest ? { manifest } : {}),
    });

    // ── 5. Reproducibility — fails closed ─────────────────────────────────
    try {
      await recordNovaExecution(
        executionEntryForAnswer({
          answer,
          businessId: business.id,
          actorId: user.id,
          correlationId,
          queryRepresentation: buildQueryRepresentation(question, business, profile),
        }),
      );
    } catch (error) {
      return fail(executionNotRecordedError(correlationId, error));
    }

    // ── 6. Audit — fails open, per ADR-0012 ───────────────────────────────
    await recordAuditEvent({
      event: 'nova.answered',
      actorId: user.id,
      businessId: business.id,
      correlationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        outcome: answer.outcome,
        knowledgeVersion: answer.knowledgeVersion,
        claimCount: answer.envelope?.claims.length ?? 0,
        unresolvedCount: answer.unresolved.length,
      },
    });

    return ok(toNovaAnswerView(answer, question));
  } catch (error) {
    logger.error('nova.unexpected', {
      correlationId,
      code: error instanceof Error ? error.name : 'unknown',
    });

    // A failed run is still a run. Record it, but do not let a recording
    // failure mask the original error the founder needs to hear about.
    try {
      await recordNovaExecution(
        executionEntryForFailure({
          businessId: business.id,
          actorId: user.id,
          correlationId,
          queryRepresentation,
        }),
      );
    } catch {
      logger.error('nova.failure_not_recorded', { correlationId });
    }

    await recordAuditEvent({
      event: 'nova.failed',
      actorId: user.id,
      businessId: business.id,
      correlationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: { code: error instanceof AppError ? error.code : 'UNEXPECTED' },
    });

    if (error instanceof AppError) return fail(error);
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'Nova could not answer that. Please try again.',
        correlationId,
        cause: error,
      }),
    );
  }
}
