import { describe, expect, it } from 'vitest';
import type { KnowledgePack } from '@/types/knowledge';

import {
  DEMO_SEED_COUNTRY_CODE,
  DEMO_SEED_KNOWLEDGE_VERSION,
  DemoSeedRefused,
  assertDemoJurisdiction,
  assertDemoPackVersion,
  assertDemoSeedAllowed,
  assertPackIsSeedable,
  type DemoSeedEnvironment,
} from '@/scripts/demo-seed/guards';

/**
 * The demo seed guards.
 *
 * These are the tests that make it safe to point a seeding script at the hosted
 * project. Every one of them describes something the script must REFUSE to do,
 * and each refusal defends against a different mistake — an accidental
 * invocation, a deliberate invocation in the wrong place, a correct invocation
 * that writes to the wrong jurisdiction, and a re-run over published data.
 *
 * The guards module is imported directly rather than through the script, which
 * executes on import by design.
 */

function env(overrides: DemoSeedEnvironment = {}): DemoSeedEnvironment {
  return {
    FOUNDRYAI_DEMO_PACK: '1',
    NODE_ENV: 'development',
    SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
    FOUNDRYAI_DEMO_OWNER_EMAIL: 'founder@example.invalid',
    ...overrides,
  };
}

function pack(overrides: Partial<KnowledgePack> = {}): KnowledgePack {
  return {
    id: '33333333-3333-4333-8333-333333333333',
    country_code: 'ZZ',
    version: DEMO_SEED_KNOWLEDGE_VERSION,
    status: 'draft',
    notes: null,
    published_at: null,
    published_by: null,
    approval_note: null,
    superseded_at: null,
    superseded_by_id: null,
    commercial_publication_eligibility: 'cleared',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('the seed requires an explicit opt-in', () => {
  it('refuses when FOUNDRYAI_DEMO_PACK is absent', () => {
    expect(() => assertDemoSeedAllowed(env({ FOUNDRYAI_DEMO_PACK: undefined }))).toThrow(
      DemoSeedRefused,
    );
  });

  it('refuses when FOUNDRYAI_DEMO_PACK is anything other than "1"', () => {
    for (const value of ['0', 'true', 'yes', '', ' 1']) {
      expect(() => assertDemoSeedAllowed(env({ FOUNDRYAI_DEMO_PACK: value }))).toThrow(
        DemoSeedRefused,
      );
    }
  });

  it('allows the seed when everything is set', () => {
    expect(assertDemoSeedAllowed(env())).toEqual({ ownerEmail: 'founder@example.invalid' });
  });
});

describe('the seed refuses to run in production', () => {
  it('refuses when NODE_ENV is production', () => {
    expect(() => assertDemoSeedAllowed(env({ NODE_ENV: 'production' }))).toThrow(DemoSeedRefused);
  });

  it('says why, rather than failing opaquely', () => {
    expect(() => assertDemoSeedAllowed(env({ NODE_ENV: 'production' }))).toThrow(/production/i);
  });

  it('still runs in development and test', () => {
    expect(() => assertDemoSeedAllowed(env({ NODE_ENV: 'development' }))).not.toThrow();
    expect(() => assertDemoSeedAllowed(env({ NODE_ENV: 'test' }))).not.toThrow();
  });
});

describe('the seed requires the credentials it will actually need', () => {
  it('refuses without a service role key', () => {
    expect(() => assertDemoSeedAllowed(env({ SUPABASE_SERVICE_ROLE_KEY: undefined }))).toThrow(
      /SUPABASE_SERVICE_ROLE_KEY/,
    );
  });

  it('refuses without a named owner account', () => {
    // No account is invented. The demo business belongs to a real signed-up
    // user so that it is reached through the same auth and RLS path a founder
    // uses.
    expect(() => assertDemoSeedAllowed(env({ FOUNDRYAI_DEMO_OWNER_EMAIL: undefined }))).toThrow(
      /FOUNDRYAI_DEMO_OWNER_EMAIL/,
    );
    expect(() => assertDemoSeedAllowed(env({ FOUNDRYAI_DEMO_OWNER_EMAIL: '   ' }))).toThrow(
      DemoSeedRefused,
    );
  });
});

describe('the seed can only ever write to the synthetic jurisdiction', () => {
  it('accepts ZZ', () => {
    expect(() => assertDemoJurisdiction('ZZ', 'the pack')).not.toThrow();
  });

  it('refuses BS — the jurisdiction gated on G11', () => {
    expect(() => assertDemoJurisdiction('BS', 'the pack')).toThrow(DemoSeedRefused);
    expect(() => assertDemoJurisdiction('BS', 'the pack')).toThrow(/BS/);
  });

  it('refuses every other real jurisdiction', () => {
    for (const code of ['JM', 'BB', 'TT', 'GY', 'BZ', 'US', 'GB']) {
      expect(() => assertDemoJurisdiction(code, 'the pack'), code).toThrow(DemoSeedRefused);
    }
  });

  it('refuses a lowercase or padded ZZ rather than normalising it', () => {
    // Normalising input is how a check becomes a suggestion. If the value is
    // not exactly the constant, something upstream is wrong.
    expect(() => assertDemoJurisdiction('zz', 'the pack')).toThrow(DemoSeedRefused);
    expect(() => assertDemoJurisdiction(' ZZ', 'the pack')).toThrow(DemoSeedRefused);
  });

  it('names the context so a failure says WHICH value was wrong', () => {
    expect(() => assertDemoJurisdiction('BS', 'manifest entry "X"')).toThrow(/manifest entry "X"/);
  });

  it('pins the country to a compile-time constant, not an input', () => {
    expect(DEMO_SEED_COUNTRY_CODE).toBe('ZZ');
  });

  it('only ever creates the one demo pack version', () => {
    expect(() => assertDemoPackVersion(DEMO_SEED_KNOWLEDGE_VERSION)).not.toThrow();
    expect(() => assertDemoPackVersion('BS-v0.1')).toThrow(DemoSeedRefused);
    expect(() => assertDemoPackVersion('ZZ-v9.9')).toThrow(DemoSeedRefused);
  });
});

describe('the seed cannot overwrite a published pack', () => {
  it('refuses when the pack is already published', () => {
    expect(() => assertPackIsSeedable(pack({ status: 'published' }))).toThrow(DemoSeedRefused);
    expect(() => assertPackIsSeedable(pack({ status: 'published' }))).toThrow(/immutable/i);
  });

  it('refuses on terminal states', () => {
    expect(() => assertPackIsSeedable(pack({ status: 'superseded' }))).toThrow(DemoSeedRefused);
    expect(() => assertPackIsSeedable(pack({ status: 'rolled_back' }))).toThrow(DemoSeedRefused);
  });

  it('resumes an unfinished pack rather than refusing', () => {
    // A partial seed should be completable. Only published and terminal states
    // are off limits.
    for (const status of ['draft', 'validating', 'staged'] as const) {
      expect(() => assertPackIsSeedable(pack({ status }))).not.toThrow();
    }
  });

  it('allows a first run, when no pack exists', () => {
    expect(() => assertPackIsSeedable(null)).not.toThrow();
  });
});
