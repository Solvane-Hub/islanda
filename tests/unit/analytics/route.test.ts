import { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  ingest: vi.fn(),
  limit: vi.fn(),
  getUser: vi.fn(),
}));
vi.mock('@/lib/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mocks.getUser } }),
}));
vi.mock('@/services/analytics', () => ({ ingestClientEvent: mocks.ingest }));
vi.mock('@/services/analytics/context', () => ({
  analyticsContext: () => ({ ip: '203.0.113.7' }),
  consumeAnalyticsRateLimit: mocks.limit,
}));

import { GET, POST } from '@/app/api/analytics/route';

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('https://www.islanda.app/api/analytics', {
    method: 'POST',
    body: typeof body === 'string' ? body : JSON.stringify(body),
    headers: { host: 'www.islanda.app', 'content-type': 'application/json', ...headers },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.limit.mockResolvedValue({ allowed: true });
  mocks.getUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
});

describe('POST /api/analytics', () => {
  it('always answers 204 with no body — it never reveals what happened', async () => {
    mocks.ingest.mockResolvedValue('ignored_bot');
    const res = await POST(post({ name: 'page_view', path: '/' }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
  });

  it('ignores cross-site posts without processing them', async () => {
    const res = await POST(
      post({ name: 'page_view', path: '/' }, { origin: 'https://evil.example' }),
    );
    expect(res.status).toBe(204);
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it('ignores malformed and oversized bodies', async () => {
    await POST(post('not json'));
    await POST(post('x'.repeat(5000)));
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it('drops events once the per-client budget is spent', async () => {
    mocks.limit.mockResolvedValue({ allowed: false });
    await POST(post({ name: 'page_view', path: '/' }));
    expect(mocks.ingest).not.toHaveBeenCalled();
  });

  it('looks up the verified session user only for application pages', async () => {
    await POST(post({ name: 'page_view', path: '/' }));
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.ingest.mock.calls[0]![2]).toBeNull();

    await POST(post({ name: 'page_view', path: '/dashboard', userId: 'forged-id' }));
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.ingest.mock.calls[1]![2]).toBe('user-1');
  });

  it('a limiter or storage failure is swallowed (fails open for the visitor)', async () => {
    mocks.limit.mockRejectedValue(new Error('db down'));
    expect((await POST(post({ name: 'page_view', path: '/' }))).status).toBe(204);
  });

  it('GET is not allowed', () => {
    expect(GET().status).toBe(405);
  });
});
