'use server';

import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import type { NovaAnswerView } from '@/types/nova';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getCurrentUser } from '@/services/auth';
import { getIntakeProfile } from '@/services/intake';
import { recordAuditEvent } from '@/services/audit';
import { manifestForJurisdiction } from '@/services/knowledge/manifests/registry';
import { answerNovaQuestion } from '@/services/nova/answer';
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
 *   4. answer
 *   5. RECORD EXECUTION    → fails CLOSED; an unrecordable answer is withheld
 *   6. audit               → fails OPEN (ADR-0012), inside the service
 *   7. return the view
 *
 * ⚠ Returns a `NovaAnswerView`, never a `NovaAnswer`. The projection strips the
 *   envelope's machine-facing `reasoning`, which ADR-0017 §5 says is "never
 *   rendered to a founder".
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
  _previous: Result<NovaAnswerView> | null,
  formData: FormData,
): Promise<Result<NovaAnswerView>> {
  const correlationId = newCorrelationId();

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
