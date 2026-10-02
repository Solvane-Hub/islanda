import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The `/api/nova/speak` route — Nova's server-side voice.
 *
 * The security-critical behaviours, tested at the handler boundary:
 *   • an unauthenticated request is rejected before anything else (401)
 *   • a missing Fish configuration degrades to 503, not a 500 or a leak
 *   • a provider failure becomes a clean 502 — never a broken response
 *   • the API key is never returned to the caller
 *
 * The Supabase client, auth, env and network are all mocked: this asserts the
 * handler's own logic, not Supabase or Fish.
 */

const h = vi.hoisted(() => ({
  user: null as { id: string } | null,
  env: { FISH_API_KEY: 'secret-key', FISH_NOVA_VOICE_ID: 'voice-1' } as {
    FISH_API_KEY?: string;
    FISH_NOVA_VOICE_ID?: string;
  },
}));

vi.mock('@/lib/supabase/server', () => ({ createClient: vi.fn(async () => ({})) }));
vi.mock('@/services/auth', () => ({ getCurrentUser: vi.fn(async () => h.user) }));
vi.mock('@/lib/env', () => ({ serverEnv: h.env }));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { POST } from '@/app/api/nova/speak/route';

function post(body: unknown): Request {
  return new Request('http://localhost/api/nova/speak', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  h.user = { id: 'user-1' };
  h.env.FISH_API_KEY = 'secret-key';
  h.env.FISH_NOVA_VOICE_ID = 'voice-1';
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('POST /api/nova/speak', () => {
  it('rejects an unauthenticated request with 401', async () => {
    h.user = null;
    const res = await POST(post({ text: 'Let me look at that.' }));
    expect(res.status).toBe(401);
  });

  it('returns 503 when the Fish voice is not configured', async () => {
    h.env.FISH_API_KEY = undefined;
    const res = await POST(post({ text: 'Let me look at that.' }));
    expect(res.status).toBe(503);
  });

  it('rejects a malformed body with 400', async () => {
    const res = await POST(post('not json'));
    expect(res.status).toBe(400);
  });

  it('rejects an empty text with 400', async () => {
    const res = await POST(post({ text: '   ' }));
    expect(res.status).toBe(400);
  });

  it('returns 502 when the provider fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('upstream error', { status: 500 })),
    );
    const res = await POST(post({ text: 'Let me look at that.' }));
    expect(res.status).toBe(502);
  });

  it('returns 502 when the provider is unreachable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down');
      }),
    );
    const res = await POST(post({ text: 'Let me look at that.' }));
    expect(res.status).toBe(502);
  });

  it('returns audio on success and never echoes the API key', async () => {
    const fetchMock = vi.fn(async () => new Response(new ArrayBuffer(16), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    const res = await POST(post({ text: 'I found two passages.' }));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('audio/mpeg');

    // The key travels only in the upstream Authorization header, never back out.
    const body = await res.clone().text();
    expect(body).not.toContain('secret-key');

    // And it WAS sent to the provider as a bearer token, server-side.
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toContain('secret-key');

    // The free developer-tier model is used — the paid models 402 without credit.
    expect(url).toBe('https://api.fish.audio/v1/tts');
    expect(headers.model).toBe('s2.1-pro-free');

    // The configured voice is passed as reference_id.
    expect(String(init.body)).toContain('voice-1');
  });
});
