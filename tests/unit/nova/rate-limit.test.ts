import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

import { RateLimitUnavailableError, consumeRateLimit } from '@/lib/db/rate-limit';
import {
  NOVA_BUSINESS_LIMIT,
  NOVA_BUSINESS_SCOPE,
  NOVA_USER_LIMIT,
  NOVA_USER_SCOPE,
  consumeNovaRateLimit,
  rateLimitMessage,
} from '@/services/nova/rate-limit';

/**
 * Rate limiting.
 *
 * The invariant that matters most is the failure one: a limiter that cannot be
 * consulted must DENY. Assuming permission when the counter is unreachable is
 * exactly what an attacker causing database pressure would rely on.
 */

type RpcRow = {
  allowed: boolean;
  current_count: number;
  window_started_at: string;
  retry_after_seconds: number;
};

/** Stubs the RPC, returning a row per scope in call order. */
function mockDb(responses: Record<string, RpcRow | 'error' | 'empty'>): SupabaseClient<Database> {
  const rpc = vi.fn(async (_fn: string, args: { p_scope: string }) => {
    const response = responses[args.p_scope];
    if (response === 'error') return { data: null, error: { message: 'connection refused' } };
    if (response === 'empty' || response === undefined) return { data: [], error: null };
    return { data: [response], error: null };
  });

  return { rpc } as unknown as SupabaseClient<Database>;
}

function row(overrides: Partial<RpcRow> = {}): RpcRow {
  return {
    allowed: true,
    current_count: 1,
    window_started_at: '2026-08-24T00:00:00.000Z',
    retry_after_seconds: 1800,
    ...overrides,
  };
}

describe('consumeRateLimit — fails closed', () => {
  it('throws rather than allowing when the counter errors', async () => {
    await expect(
      consumeRateLimit(mockDb({ x: 'error' }), {
        scope: 'x',
        subjectId: 'u1',
        windowSeconds: 60,
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it('throws when the counter returns no row', async () => {
    // A successful call that returned nothing is not a permissive answer; it is
    // an answer we do not have.
    await expect(
      consumeRateLimit(mockDb({ x: 'empty' }), {
        scope: 'x',
        subjectId: 'u1',
        windowSeconds: 60,
        limit: 5,
      }),
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it('returns the decision when the counter answers', async () => {
    const decision = await consumeRateLimit(
      mockDb({ x: row({ allowed: true, current_count: 3 }) }),
      { scope: 'x', subjectId: 'u1', windowSeconds: 60, limit: 5 },
    );

    expect(decision.allowed).toBe(true);
    expect(decision.currentCount).toBe(3);
  });
});

describe('Nova rate limit — allowed, boundary, exceeded', () => {
  it('allows a request inside both windows', async () => {
    const result = await consumeNovaRateLimit(
      mockDb({
        [NOVA_USER_SCOPE]: row({ allowed: true, current_count: 1 }),
        [NOVA_BUSINESS_SCOPE]: row({ allowed: true, current_count: 1 }),
      }),
      { userId: 'u1', businessId: 'b1' },
    );

    expect(result.allowed).toBe(true);
    expect(result.deniedScope).toBeNull();
  });

  it('allows the request that lands exactly ON the user limit', async () => {
    // The boundary case. `count <= limit` is the contract, so the Nth request
    // in a window is the last allowed one, not the first denied one.
    const result = await consumeNovaRateLimit(
      mockDb({
        [NOVA_USER_SCOPE]: row({ allowed: true, current_count: NOVA_USER_LIMIT }),
        [NOVA_BUSINESS_SCOPE]: row({ allowed: true, current_count: 5 }),
      }),
      { userId: 'u1', businessId: 'b1' },
    );

    expect(result.allowed).toBe(true);
  });

  it('denies the request one past the user limit', async () => {
    const result = await consumeNovaRateLimit(
      mockDb({
        [NOVA_USER_SCOPE]: row({ allowed: false, current_count: NOVA_USER_LIMIT + 1 }),
        [NOVA_BUSINESS_SCOPE]: row({ allowed: true, current_count: 5 }),
      }),
      { userId: 'u1', businessId: 'b1' },
    );

    expect(result.allowed).toBe(false);
    expect(result.deniedScope).toBe(NOVA_USER_SCOPE);
  });

  it('denies on the business window even when the user window is fine', async () => {
    // A user with several businesses must not be able to multiply one
    // business's allowance, and vice versa.
    const result = await consumeNovaRateLimit(
      mockDb({
        [NOVA_USER_SCOPE]: row({ allowed: true, current_count: 2 }),
        [NOVA_BUSINESS_SCOPE]: row({ allowed: false, current_count: NOVA_BUSINESS_LIMIT + 1 }),
      }),
      { userId: 'u1', businessId: 'b1' },
    );

    expect(result.allowed).toBe(false);
    expect(result.deniedScope).toBe(NOVA_BUSINESS_SCOPE);
  });

  it('consumes BOTH windows even when the first denies', async () => {
    // A denied request that costs nothing lets the cheaper limit be probed for
    // free, so both counters are consumed on every attempt.
    const rpc = vi.fn(async () => ({ data: [row({ allowed: false })], error: null }));
    const db = { rpc } as unknown as SupabaseClient<Database>;

    await consumeNovaRateLimit(db, { userId: 'u1', businessId: 'b1' });

    expect(rpc).toHaveBeenCalledTimes(2);
  });

  it('propagates unavailability rather than allowing', async () => {
    await expect(
      consumeNovaRateLimit(mockDb({ [NOVA_USER_SCOPE]: 'error' }), {
        userId: 'u1',
        businessId: 'b1',
      }),
    ).rejects.toBeInstanceOf(RateLimitUnavailableError);
  });

  it('scopes the user window to the user, not the business', async () => {
    const rpc = vi.fn(async () => ({ data: [row()], error: null }));
    const db = { rpc } as unknown as SupabaseClient<Database>;

    await consumeNovaRateLimit(db, { userId: 'user-42', businessId: 'biz-7' });

    expect(rpc).toHaveBeenNthCalledWith(
      1,
      'consume_rate_limit',
      expect.objectContaining({ p_scope: NOVA_USER_SCOPE, p_subject_id: 'user-42' }),
    );
    expect(rpc).toHaveBeenNthCalledWith(
      2,
      'consume_rate_limit',
      expect.objectContaining({ p_scope: NOVA_BUSINESS_SCOPE, p_subject_id: 'biz-7' }),
    );
  });
});

describe('rate limit messaging', () => {
  it('names the business window without exposing the counter', () => {
    const message = rateLimitMessage({
      allowed: false,
      deniedScope: NOVA_BUSINESS_SCOPE,
      retryAfterSeconds: 3600,
    });

    expect(message).toContain('daily limit');
    expect(message).not.toMatch(/\d+ of \d+/);
  });

  it('names the user window', () => {
    expect(
      rateLimitMessage({ allowed: false, deniedScope: NOVA_USER_SCOPE, retryAfterSeconds: 120 }),
    ).toContain('hourly limit');
  });

  it('never tells a founder to wait zero minutes', () => {
    expect(
      rateLimitMessage({ allowed: false, deniedScope: NOVA_USER_SCOPE, retryAfterSeconds: 5 }),
    ).toContain('1 minute');
  });
});
