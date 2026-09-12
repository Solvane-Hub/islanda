'use server';

import { cookies, headers } from 'next/headers';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { AppError, fail, newCorrelationId, ok, type Result } from '@/lib/errors';
import { toFieldErrors } from '@/lib/validation/field-errors';
import { logger } from '@/lib/logger';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { getCurrentUser } from '@/services/auth';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { recordAuditEvent } from '@/services/audit';
import { consumeNovaRateLimit, rateLimitMessage } from '@/services/nova/rate-limit';
import {
  assembleIntelligenceContext,
  defaultGatewayDeps,
  runIntelligence,
} from '@/services/intelligence';
import { answerFinancialDeterministically } from '@/lib/intelligence/financial-answer';
import { toNovaFinanceView, type NovaFinanceView } from '@/lib/intelligence/nova-finance';

/**
 * Nova Financial Intelligence — the first end-to-end production intelligence loop.
 *
 * Nova → assemble real context (P4) → P5 gateway → deterministic answer OR
 * validated LLM reasoning → structured view. Deterministic questions never call
 * the LLM. Failures degrade gracefully — never a fabricated answer. Rate-limited
 * and usage-recorded (the gateway writes `ai_usage`; this also records an audit
 * event of shape only).
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

export async function askNovaFinanceAction(
  _previous: Result<NovaFinanceView> | null,
  formData: FormData,
): Promise<Result<NovaFinanceView>> {
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
        humanMessage: 'Sign in to ask Nova.',
        correlationId,
      }),
    );
  }

  const business = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);
  if (!business) {
    return fail(
      new AppError({
        code: 'NOT_FOUND',
        humanMessage: 'Create a business before asking Nova.',
        correlationId,
      }),
    );
  }

  // Rate limit — fails closed (cost control), reusing Nova's limiter.
  try {
    const limit = await consumeNovaRateLimit(db, { userId: user.id, businessId: business.id });
    if (!limit.allowed) {
      return fail(
        new AppError({
          code: 'RATE_LIMITED',
          humanMessage: rateLimitMessage(limit),
          correlationId,
        }),
      );
    }
  } catch (error) {
    logger.error('nova_finance.rate_limit_unavailable', {
      correlationId,
      code: error instanceof Error ? error.name : 'unknown',
    });
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'Nova is temporarily unavailable. Please try again shortly.',
        correlationId,
        cause: error,
      }),
    );
  }

  try {
    const context = await assembleIntelligenceContext(db, business.id);
    if (!context) {
      return fail(
        new AppError({
          code: 'NOT_FOUND',
          humanMessage: 'We could not find that business.',
          correlationId,
        }),
      );
    }

    const outcome = await runIntelligence(
      { question, businessId: business.id, context, actorId: user.id, correlationId },
      defaultGatewayDeps(),
    );

    // Deterministic questions are answered from real data — no model call.
    const deterministic =
      outcome.status === 'deterministic'
        ? answerFinancialDeterministically(question, context)
        : null;

    const view = toNovaFinanceView(question, outcome, deterministic);

    // Reuse the Nova execution-recording pattern: shape-only audit. The gateway
    // has already written the detailed `ai_usage` row (category, determination,
    // llm_called, model/tier, tokens, cost, validation, failure).
    await recordAuditEvent({
      event: outcome.status === 'unavailable' ? 'nova.failed' : 'nova.answered',
      actorId: user.id,
      businessId: business.id,
      correlationId,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      metadata: {
        surface: 'finance',
        category: outcome.category,
        determination: outcome.usage.determination,
        llmCalled: outcome.usage.llmCalled,
        status: view.status,
      },
    });

    return ok(view);
  } catch (error) {
    logger.error('nova_finance.unexpected', {
      correlationId,
      code: error instanceof Error ? error.name : 'unknown',
    });
    return fail(
      new AppError({
        code: 'UNEXPECTED',
        humanMessage: 'Nova could not complete that. Please try again.',
        correlationId,
        cause: error,
      }),
    );
  }
}
