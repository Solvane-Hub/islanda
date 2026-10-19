import { createHmac, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { createAdminClient } from '@/lib/supabase/admin';
import { clientEnv, serverEnv } from '@/lib/env';
import { insertAnalyticsEvents, type AnalyticsEventRow } from '@/lib/db/analytics';
import { logger } from '@/lib/logger';
import {
  CLIENT_EVENTS,
  ERROR_CATEGORIES,
  type ErrorCategory,
  type ServerEventName,
} from '@/lib/analytics/events';
import {
  browserFamily,
  cleanPath,
  cleanUtm,
  countryCode,
  deviceCategory,
  isLikelyBot,
  isProductPath,
  referrerHost,
  templatePath,
} from '@/lib/analytics/classify';

/**
 * First-party analytics — ingestion.
 *
 * What is stored for an event: its name, time, a pseudonymous visitor key,
 * the page path (no query string), the referring HOST, standard UTM tags, a
 * country code from the hosting platform's header, a device category, a
 * browser family, and — for signed-in application pages only — the user id.
 *
 * What is never stored: an IP address, a raw user agent, a query string, form
 * content, Nova prompts, document contents, names or email addresses.
 *
 * Visitor keys:
 *   - `c:<uuid>` when the visitor granted analytics consent: a random
 *     first-party id that lets the dashboard tell new from returning visitors.
 *   - `d:<hmac>` otherwise: HMAC-SHA256 of (UTC day, IP, user agent) under a
 *     server secret. It changes every day and cannot be reversed to an IP, so
 *     it counts distinct visitors per day without storing anything on the
 *     device and without a persistent identifier.
 *
 * Analytics fails OPEN: an ingestion problem is logged and swallowed. It must
 * never break a page, a signup or a save.
 */

export interface AnalyticsRequestContext {
  ip: string | null;
  userAgent: string | null;
  /** Platform geo header value (e.g. x-vercel-ip-country). */
  country: string | null;
  consent: string | null;
  visitorId: string | null;
  /** Hosts considered "internal" for referrer purposes. */
  ownHosts: string[];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function hashKey(): string | null {
  return serverEnv.ANALYTICS_HASH_SECRET ?? serverEnv.SUPABASE_SERVICE_ROLE_KEY ?? null;
}

/** The pseudonymous visitor key for a request (see module comment). */
export function visitorKey(ctx: AnalyticsRequestContext, now: Date = new Date()): string | null {
  if (ctx.consent === 'granted' && ctx.visitorId && UUID.test(ctx.visitorId)) {
    return `c:${ctx.visitorId.toLowerCase()}`;
  }
  const key = hashKey();
  if (!key || !ctx.ip) return null;
  const day = now.toISOString().slice(0, 10);
  const digest = createHmac('sha256', key)
    .update(`${day}|${ctx.ip}|${ctx.userAgent ?? ''}`)
    .digest('hex');
  return `d:${digest}`;
}

export function ownHostsFor(requestHost: string | null): string[] {
  const hosts = new Set<string>(['islanda.app', 'www.islanda.app', 'localhost']);
  try {
    hosts.add(new URL(clientEnv.NEXT_PUBLIC_APP_URL).hostname);
  } catch {
    // An invalid app URL is caught at boot by lib/env; nothing to add here.
  }
  if (requestHost) hosts.add(requestHost.split(':')[0]!.toLowerCase());
  return [...hosts];
}

/* ── Client events ────────────────────────────────────────────────────── */

const propertyValue = z.union([z.string().max(100), z.number().finite(), z.boolean()]);

export const clientEventSchema = z.object({
  id: z.uuid(),
  name: z.enum(CLIENT_EVENTS),
  path: z.string().max(2000),
  referrer: z.string().max(2000).nullable().optional(),
  utm: z
    .object({
      source: z.string().max(200).nullable().optional(),
      medium: z.string().max(200).nullable().optional(),
      campaign: z.string().max(200).nullable().optional(),
    })
    .optional(),
  // A handful of small scalar values (e.g. a section number). Never free text from a form.
  props: z
    .record(z.string().regex(/^[a-z][a-z0-9_]{0,30}$/), propertyValue)
    .refine((p) => Object.keys(p).length <= 8, 'Too many properties.')
    .optional(),
});

export type ClientEventInput = z.infer<typeof clientEventSchema>;

export type IngestOutcome =
  'stored' | 'ignored_bot' | 'ignored_invalid' | 'ignored_path' | 'unavailable';

/**
 * Validates and stores one browser event. `userId` is the verified session
 * user (from getUser(), never from the request body) and is attached only to
 * signed-in application pages.
 */
export async function ingestClientEvent(
  raw: unknown,
  ctx: AnalyticsRequestContext,
  userId: string | null,
): Promise<IngestOutcome> {
  if (isLikelyBot(ctx.userAgent)) return 'ignored_bot';

  const parsed = clientEventSchema.safeParse(raw);
  if (!parsed.success) return 'ignored_invalid';
  const event = parsed.data;

  const path = cleanPath(event.path);
  if (!path) return 'ignored_invalid';
  if (/^\/(admin|api|auth)(\/|$)/.test(path)) return 'ignored_path';

  const product = isProductPath(path);
  const row: AnalyticsEventRow = {
    event_id: event.id,
    kind: product ? 'product' : 'web',
    event_name: event.name,
    visitor_key: visitorKey(ctx),
    user_id: product ? userId : null,
    path: templatePath(path),
    referrer_host: referrerHost(event.referrer ?? null, ctx.ownHosts),
    utm_source: cleanUtm(event.utm?.source),
    utm_medium: cleanUtm(event.utm?.medium),
    utm_campaign: cleanUtm(event.utm?.campaign),
    country_code: countryCode(ctx.country),
    device: deviceCategory(ctx.userAgent),
    browser: browserFamily(ctx.userAgent),
    properties: event.props ?? {},
  };

  return store([row]);
}

/* ── Server events ────────────────────────────────────────────────────── */

export interface ServerEventInput {
  name: ServerEventName;
  path: string;
  status?: 'success' | 'failure';
  errorCategory?: ErrorCategory;
  userId?: string | null;
  businessId?: string | null;
  durationMs?: number;
  properties?: Record<string, string | number | boolean>;
}

/**
 * Records an event that the SERVER has verified happened. Uses the same
 * visitor key as the browser's events, so a signup can be attributed to the
 * session (and traffic source) that produced it.
 */
export async function recordServerEvent(
  input: ServerEventInput,
  ctx: AnalyticsRequestContext,
): Promise<void> {
  if (isLikelyBot(ctx.userAgent)) return;
  const path = cleanPath(input.path) ?? '/';
  const errorCategory =
    input.errorCategory && (ERROR_CATEGORIES as readonly string[]).includes(input.errorCategory)
      ? input.errorCategory
      : null;

  await store([
    {
      event_id: randomUUID(),
      kind: isProductPath(path) ? 'product' : 'web',
      event_name: input.name,
      visitor_key: visitorKey(ctx),
      user_id: input.userId ?? null,
      business_id: input.businessId ?? null,
      path: templatePath(path),
      country_code: countryCode(ctx.country),
      device: deviceCategory(ctx.userAgent),
      browser: browserFamily(ctx.userAgent),
      status: input.status ?? null,
      error_category: errorCategory,
      duration_ms:
        input.durationMs !== undefined
          ? Math.max(0, Math.min(3_600_000, Math.round(input.durationMs)))
          : null,
      properties: input.properties ?? {},
    },
  ]);
}

async function store(rows: AnalyticsEventRow[]): Promise<IngestOutcome> {
  try {
    const admin = createAdminClient();
    if (!admin) return 'unavailable';
    const { error } = await insertAnalyticsEvents(admin, rows);
    if (error) {
      logger.error('analytics.write_failed', { code: 'insert_failed' });
      return 'unavailable';
    }
    return 'stored';
  } catch {
    logger.error('analytics.write_failed', { code: 'unexpected' });
    return 'unavailable';
  }
}

/** Maps an application error code to a safe analytics category. */
export function errorCategoryFor(code: string | undefined): ErrorCategory {
  switch (code) {
    case 'VALIDATION_FAILED':
      return 'validation';
    case 'RATE_LIMITED':
    case 'AUTH_RATE_LIMITED':
      return 'rate_limited';
    case 'NOT_FOUND':
      return 'not_found';
    case 'FORBIDDEN':
      return 'forbidden';
    case 'UNAVAILABLE':
      return 'unavailable';
    default:
      return 'unexpected';
  }
}
