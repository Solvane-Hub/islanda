import { describe, expect, it } from 'vitest';
import { registerSourceSchema } from '@/lib/validation/knowledge';
import { syntheticRegistration } from '@/tests/fixtures/knowledge/synthetic-source';

/**
 * Freshness must be stated, never defaulted.
 *
 * The database declared `freshness_state not null default 'current'` and no
 * application code ever wrote it, so every source silently asserted currency.
 * The first real corpus disproved that assertion twice over — the VAT Act
 * reprint is amended by three later Acts, and the Data Protection Act 2025 is
 * enacted but not commenced.
 *
 * The default is dropped in 20260823000000_knowledge_freshness_explicit.sql.
 * These tests hold the application half of the same guarantee.
 */

describe('registerSourceSchema — freshness state is mandatory', () => {
  it('accepts a registration that states its freshness', () => {
    expect(registerSourceSchema.safeParse(syntheticRegistration).success).toBe(true);
  });

  it('REJECTS a registration that omits freshness rather than defaulting it', () => {
    const { freshnessState: _omitted, ...withoutFreshness } = syntheticRegistration;
    const result = registerSourceSchema.safeParse(withoutFreshness);

    expect(result.success).toBe(false);
  });

  it('names the missing field so the caller knows what to supply', () => {
    const { freshnessState: _omitted, ...withoutFreshness } = syntheticRegistration;
    const result = registerSourceSchema.safeParse(withoutFreshness);

    if (result.success) throw new Error('expected rejection');
    expect(result.error.issues.some((i) => i.path.includes('freshnessState'))).toBe(true);
  });

  it('rejects a freshness value outside the K6 set', () => {
    expect(
      registerSourceSchema.safeParse({ ...syntheticRegistration, freshnessState: 'probably_fine' })
        .success,
    ).toBe(false);
  });

  it('accepts every K6 §2A.4 state', () => {
    for (const state of [
      'current',
      'review_due',
      'changed_pending_assessment',
      'stale',
      'withdrawn',
    ]) {
      expect(
        registerSourceSchema.safeParse({ ...syntheticRegistration, freshnessState: state }).success,
      ).toBe(true);
    }
  });

  it('does not silently substitute a value when one is absent', () => {
    // Guards against a future `.default('current')` being added for convenience.
    // Convenience here means asserting currency nobody established.
    const { freshnessState: _omitted, ...withoutFreshness } = syntheticRegistration;
    const result = registerSourceSchema.safeParse(withoutFreshness);

    expect(result.success).toBe(false);
    if (result.success) return;
    expect(result.error.issues.length).toBeGreaterThan(0);
  });
});
