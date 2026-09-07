import { describe, expect, it } from 'vitest';
import { assertTransition, canTransition, resolveCurrentBusiness } from '@/services/business';
import { AppError, fail } from '@/lib/errors';
import type { Business } from '@/types/business';

/**
 * The database enum constrains the vocabulary; the service constrains the
 * sequence. Postgres accepts any enum value, so these rules exist only here —
 * which makes them worth testing carefully.
 */
describe('business lifecycle (ADR-0007)', () => {
  it('allows the documented forward path', () => {
    expect(canTransition('draft', 'intake_started')).toBe(true);
    expect(canTransition('intake_started', 'intake_complete')).toBe(true);
    expect(canTransition('intake_complete', 'launch_plan_generated')).toBe(true);
    expect(canTransition('launch_plan_generated', 'active')).toBe(true);
  });

  it('forbids skipping intake', () => {
    expect(canTransition('draft', 'active')).toBe(false);
    expect(canTransition('draft', 'launch_plan_generated')).toBe(false);
    expect(canTransition('intake_started', 'active')).toBe(false);
  });

  it('allows archiving from every live state', () => {
    for (const s of [
      'draft',
      'intake_started',
      'intake_complete',
      'launch_plan_generated',
      'active',
    ] as const) {
      expect(canTransition(s, 'archived')).toBe(true);
    }
  });

  it('treats archived as terminal', () => {
    for (const s of ['draft', 'active', 'intake_started'] as const) {
      expect(canTransition('archived', s)).toBe(false);
    }
  });

  it('permits stepping back to correct earlier answers', () => {
    expect(canTransition('intake_complete', 'intake_started')).toBe(true);
    expect(canTransition('launch_plan_generated', 'intake_complete')).toBe(true);
  });

  it('assertTransition surfaces a founder-safe humanMessage', () => {
    // toThrow() matches Error.message, which is DELIBERATELY the developer
    // message (see lib/errors — human and developer messages are separate, and
    // fail() serializes only humanMessage). Asserting on humanMessage is what
    // actually protects the founder-facing path.
    try {
      assertTransition('draft', 'active');
      expect.unreachable('expected assertTransition to throw');
    } catch (error) {
      const e = error as AppError;
      expect(e).toBeInstanceOf(AppError);
      expect(e.humanMessage).toMatch(/not available/i);
      // The founder must never see internals.
      expect(e.humanMessage).not.toMatch(/transition|status|draft|active|->/i);
    }
  });

  it('assertTransition preserves developer context internally', () => {
    try {
      assertTransition('draft', 'active');
      expect.unreachable('expected assertTransition to throw');
    } catch (error) {
      const e = error as AppError;
      expect(e.message).toContain('draft -> active');
      expect(e.code).toBe('FORBIDDEN');
      expect(e.correlationId).toMatch(/^[0-9a-f-]{36}$/);
    }
  });

  it('what reaches the client carries no developer detail', () => {
    // This is the real boundary test: whatever fail() puts on the wire is what
    // a founder can see.
    try {
      assertTransition('draft', 'active');
      expect.unreachable('expected assertTransition to throw');
    } catch (error) {
      const wire = fail(error as AppError);
      expect(wire.ok).toBe(false);
      if (!wire.ok) {
        expect(wire.message).toMatch(/not available/i);
        expect(JSON.stringify(wire)).not.toContain('draft -> active');
        expect(JSON.stringify(wire)).not.toMatch(/Illegal/i);
      }
    }
  });

  it('assertTransition passes on a legal move', () => {
    expect(() => assertTransition('draft', 'intake_started')).not.toThrow();
  });
});

function biz(id: string, name = id): Business {
  return {
    id,
    name,
    owner_id: 'owner-1',
    country_code: 'BS',
    industry: null,
    status: 'draft',
    business_mode: 'build',
    legal_name: null,
    trading_name: null,
    business_type: null,
    archived_at: null,
    created_at: '2026-08-05T00:00:00Z',
    updated_at: '2026-08-05T00:00:00Z',
  };
}

describe('resolveCurrentBusiness', () => {
  it('returns null when the founder has no businesses', () => {
    expect(resolveCurrentBusiness([], 'anything')).toBeNull();
  });

  it('honours a valid preferred id', () => {
    const list = [biz('a'), biz('b')];
    expect(resolveCurrentBusiness(list, 'b')?.id).toBe('b');
  });

  it('falls back to the most recent when the cookie is absent', () => {
    expect(resolveCurrentBusiness([biz('a'), biz('b')], undefined)?.id).toBe('a');
  });

  it('ignores an id that is not in the RLS-scoped list', () => {
    // The cookie is client-controllable. A foreign id must never select a
    // business the founder cannot see — it silently falls back instead.
    const list = [biz('a')];
    expect(resolveCurrentBusiness(list, 'someone-elses-business-id')?.id).toBe('a');
  });

  it('ignores a stale id for an archived business', () => {
    // listBusinesses excludes archived rows, so a stale cookie behaves like a
    // foreign one.
    expect(resolveCurrentBusiness([biz('a')], 'archived-b')?.id).toBe('a');
  });
});
