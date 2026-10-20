import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Release visibility on the server (lib/product/release.ts): unreleased
 * capabilities exist in internal environments and are a 404 in production,
 * whatever link or URL led there.
 */
const h = vi.hoisted(() => ({
  deployment: 'production' as 'production' | 'preview' | 'development',
  env: { SHOW_UNRELEASED_FEATURES: undefined as boolean | undefined },
}));
vi.mock('@/lib/env', () => ({
  serverEnv: h.env,
  deploymentEnvironment: () => h.deployment,
}));
vi.mock('next/navigation', () => ({
  notFound: () => {
    throw new Error('NOT_FOUND');
  },
}));

const { canUse, requireReleased, unreleasedVisible } = await import('@/lib/product/release');

beforeEach(() => {
  h.deployment = 'production';
  h.env.SHOW_UNRELEASED_FEATURES = undefined;
});

describe('release visibility', () => {
  it('hides unreleased capabilities in production', () => {
    expect(unreleasedVisible()).toBe(false);
    for (const id of [
      'cited_answers',
      'financial_answers',
      'requirements_guidance',
      'important_dates',
      'funding',
    ] as const) {
      expect(canUse(id), id).toBe(false);
      expect(() => requireReleased(id), id).toThrow('NOT_FOUND');
    }
  });

  it('never hides a released capability', () => {
    for (const id of ['business_profile', 'documents', 'goals', 'money_records'] as const) {
      expect(canUse(id), id).toBe(true);
      expect(() => requireReleased(id), id).not.toThrow();
    }
  });

  it.each(['preview', 'development'] as const)('shows unreleased work in %s', (deployment) => {
    h.deployment = deployment;
    expect(unreleasedVisible()).toBe(true);
    expect(canUse('funding')).toBe(true);
    expect(() => requireReleased('cited_answers')).not.toThrow();
  });

  it('can be forced either way by SHOW_UNRELEASED_FEATURES', () => {
    h.deployment = 'development';
    h.env.SHOW_UNRELEASED_FEATURES = false;
    expect(canUse('funding')).toBe(false);
    h.deployment = 'production';
    h.env.SHOW_UNRELEASED_FEATURES = true;
    expect(canUse('funding')).toBe(true);
  });
});
