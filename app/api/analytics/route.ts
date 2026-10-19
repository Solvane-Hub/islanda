import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isProductPath } from '@/lib/analytics/classify';
import { ingestClientEvent } from '@/services/analytics';
import { analyticsContext, consumeAnalyticsRateLimit } from '@/services/analytics/context';

/**
 * First-party analytics ingestion.
 *
 * Accepts ONE small event per request (sendBeacon or fetch keepalive) and
 * always answers 204 with no body, whatever happened — the response never
 * tells a caller whether an event was stored, rejected as a bot, or rate
 * limited. Validation, bot filtering and storage live in services/analytics.
 *
 * The user id attached to application-page events comes from the verified
 * session (`getUser()`), never from the request body.
 */

export const runtime = 'nodejs';

const MAX_BODY_BYTES = 4096;

function noContent(): NextResponse {
  return new NextResponse(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}

export async function POST(request: NextRequest) {
  // Same-origin only: a beacon from another site is not our traffic.
  const origin = request.headers.get('origin');
  if (origin) {
    let originHost: string | null = null;
    try {
      originHost = new URL(origin).host;
    } catch {
      return noContent();
    }
    if (originHost !== request.headers.get('host')) return noContent();
  }

  const length = Number(request.headers.get('content-length') ?? '0');
  if (length > MAX_BODY_BYTES) return noContent();

  let body: unknown;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return noContent();
    body = JSON.parse(text);
  } catch {
    return noContent();
  }

  const ctx = analyticsContext(request.headers, (name) => request.cookies.get(name)?.value);

  try {
    const db = await createClient();
    const limit = await consumeAnalyticsRateLimit(db, ctx);
    if (!limit.allowed) return noContent();

    const path =
      body && typeof body === 'object' && 'path' in body && typeof body.path === 'string'
        ? body.path
        : '';
    let userId: string | null = null;
    if (path.startsWith('/') && isProductPath(path.split(/[?#]/)[0] ?? '')) {
      const {
        data: { user },
      } = await db.auth.getUser();
      userId = user?.id ?? null;
    }

    await ingestClientEvent(body, ctx, userId);
  } catch {
    // Analytics fails open for the visitor: a limiter or storage problem is
    // never surfaced, and the event is simply not recorded.
  }

  return noContent();
}

export function GET() {
  return new NextResponse(null, { status: 405, headers: { Allow: 'POST' } });
}
