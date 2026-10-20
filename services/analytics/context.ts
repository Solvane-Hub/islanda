import { createHash } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { consumeRateLimit, type RateLimitDecision } from '@/lib/db/rate-limit';
import { CONSENT_COOKIE, VISITOR_COOKIE } from '@/lib/analytics/events';
import { ownHostsFor, type AnalyticsRequestContext } from './index';

/**
 * Builds the analytics view of a request from its headers and cookies.
 *
 * `x-forwarded-for` and the geo header are supplied by the hosting platform
 * (Vercel) in production. The IP is used only transiently, inside the daily
 * visitor hash and the rate-limit subject hash; it is never stored.
 *
 * A browser privacy signal — Global Privacy Control (`Sec-GPC: 1`) or Do Not
 * Track (`DNT: 1`) — overrides any earlier "Allow": the persistent id is
 * ignored and the visit counts only under the daily rotating key.
 */
export function analyticsContext(
  headers: Headers,
  cookie: (name: string) => string | undefined,
): AnalyticsRequestContext {
  const privacySignal = headers.get('sec-gpc') === '1' || headers.get('dnt') === '1';
  return {
    ip: headers.get('x-forwarded-for')?.split(',')[0]?.trim() || headers.get('x-real-ip') || null,
    userAgent: headers.get('user-agent'),
    country: headers.get('x-vercel-ip-country'),
    consent: privacySignal ? 'denied' : (cookie(CONSENT_COOKIE) ?? null),
    visitorId: privacySignal ? null : (cookie(VISITOR_COOKIE) ?? null),
    ownHosts: ownHostsFor(headers.get('host')),
  };
}

const INGEST_LIMIT = 300;
const INGEST_WINDOW_SECONDS = 10 * 60;

/**
 * Per-client ingestion budget, through the same fail-closed limiter as the
 * waitlist and Nova. The subject is a SHA-256 of the IP, so the counter table
 * never holds an IP address.
 */
export async function consumeAnalyticsRateLimit(
  db: SupabaseClient<Database>,
  ctx: AnalyticsRequestContext,
): Promise<RateLimitDecision> {
  const subject = createHash('sha256')
    .update(`analytics|${ctx.ip ?? 'unknown'}`)
    .digest('hex');
  return consumeRateLimit(db, {
    scope: 'analytics:ingest',
    subjectId: subject,
    windowSeconds: INGEST_WINDOW_SECONDS,
    limit: INGEST_LIMIT,
  });
}
