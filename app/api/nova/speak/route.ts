import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/server';
import { getCurrentUser } from '@/services/auth';
import { serverEnv } from '@/lib/env';
import { stripUnspeakable } from '@/lib/nova/speech';
import { logger } from '@/lib/logger';

/**
 * Nova's voice — server-side text-to-speech via Fish Audio.
 *
 * ## Why this is a server route and not a client call
 *
 * `FISH_API_KEY` is a paid-provider bearer credential. A client-side call would
 * put it in the browser bundle or in a network request the user can read, which
 * is the exact "client-side API route that leaks credentials" the directive
 * forbids. So the key stays in `serverEnv` (a build error to import client-side),
 * the browser only ever sends TEXT, and audio comes back as an opaque stream.
 *
 * ## The order of checks, and why each fails the way it does
 *
 *   1. AUTHENTICATE first. TTS is a cost the founder's session pays for; an
 *      unauthenticated request is rejected before anything else runs (401).
 *   2. CONFIG. With no Fish credentials this returns 503 — "the voice is not
 *      available here" — rather than 500. A deployment without a Fish account is
 *      a supported configuration; the UI treats 503 as "voice off, quietly".
 *   3. VALIDATE. Only a short piece of text is accepted (≤600 chars). Nothing
 *      else — no voice id from the client (that is server config), no format
 *      choice, no model. The browser cannot steer the provider.
 *   4. SANITISE. `stripUnspeakable` runs again here, server-side, so even a
 *      hand-crafted request can never make Nova read a URL or an identifier.
 *   5. CALL Fish, server-side, with a timeout. Any provider failure becomes a
 *      clean 502 the client handles by falling silent — never a broken player.
 *
 * ⚠ The key is never logged. `logger.redact` also strips `authorization`, but
 *   the primary control is simply never passing it into a log context.
 */

export const runtime = 'nodejs';

/** Only text. The voice id, format and model are server configuration. */
const bodySchema = z.object({
  text: z.string().trim().min(1).max(600),
});

const FISH_TTS_ENDPOINT = 'https://api.fish.audio/v1/tts';

/**
 * The TTS model, selected via the `model` header.
 *
 * `s2.1-pro-free` is Fish Audio's free developer tier (per the official API
 * reference: "Use s2.1-pro-free for the free developer tier"). It requires an
 * API key but no paid API credit, supports `reference_id` custom/cloned voices,
 * and is what makes Nova's voice usable without funding a paid model. The paid
 * models (`s1`, `s2-pro`, `s2.1-pro`) return 402 when the account has no API
 * credit, which is exactly what the earlier `s1` value did.
 */
const FISH_MODEL = 's2.1-pro-free';

/** Upstream timeout. A hung provider must not hold a founder's request open. */
const UPSTREAM_TIMEOUT_MS = 15_000;

export async function POST(request: Request): Promise<Response> {
  // 1. Authenticate — RLS-scoped client, getUser() (never getSession()).
  const db = await createClient();
  const user = await getCurrentUser(db);
  if (!user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  // 2. Is the voice configured at all?
  const apiKey = serverEnv.FISH_API_KEY;
  const voiceId = serverEnv.FISH_NOVA_VOICE_ID;
  if (!apiKey || !voiceId) {
    return NextResponse.json({ error: 'voice_unavailable' }, { status: 503 });
  }

  // 3. Validate the request body.
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  // 4. Sanitise — never send an identifier to the provider or let one be spoken.
  const text = stripUnspeakable(parsed.data.text);
  if (!text) {
    return NextResponse.json({ error: 'empty_text' }, { status: 400 });
  }

  // 5. Call Fish Audio, server-side, with a hard timeout.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), UPSTREAM_TIMEOUT_MS);

  try {
    const upstream = await fetch(FISH_TTS_ENDPOINT, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        // Model is selected by header in Fish's HTTP API.
        model: FISH_MODEL,
      },
      body: JSON.stringify({
        text,
        reference_id: voiceId,
        format: 'mp3',
        // A calm, even delivery. Normalisation smooths numbers and punctuation
        // into speech; the trained Nova voice carries the tone.
        normalize: true,
      }),
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!upstream.ok) {
      // Shape only — never the response body, which can echo the request, and
      // never the key. The founder sees "voice unavailable"; the log sees status.
      logger.error('nova.tts_upstream_failed', { code: `http_${upstream.status}` });
      return NextResponse.json({ error: 'tts_failed' }, { status: 502 });
    }

    const audio = await upstream.arrayBuffer();
    if (audio.byteLength === 0) {
      logger.error('nova.tts_empty_audio', {});
      return NextResponse.json({ error: 'tts_failed' }, { status: 502 });
    }

    return new NextResponse(audio, {
      status: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': String(audio.byteLength),
        // Nova's audio is per-answer and per-user; never cache it anywhere.
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError';
    logger.error('nova.tts_unreachable', { code: aborted ? 'timeout' : 'network' });
    return NextResponse.json({ error: 'tts_unreachable' }, { status: 502 });
  } finally {
    clearTimeout(timeout);
  }
}
