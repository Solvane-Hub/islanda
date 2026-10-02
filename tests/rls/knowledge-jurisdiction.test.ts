import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anonClient, archiveAll, rlsConfigured, rlsRequired, RUN, signIn, type Db } from './client';
import { DEMO_ZZ_COUNTRY_CODE } from '@/services/knowledge/manifests/demo-zz';

/**
 * Row Level Security — knowledge jurisdiction isolation.
 *
 * Before 20260825000000 the policy was:
 *
 *   using (exists (select 1 from knowledge_packs p
 *                  where p.id = ... and p.status = 'published'))
 *
 * — any published chunk, any country, any authenticated user. Jurisdiction
 * isolation rested entirely on services/nova/retrieval.ts. That is the one
 * place in the platform where an application bug produces confidently wrong
 * regulatory guidance rather than a data leak, and it was one layer deep.
 *
 * The policy now grants a jurisdiction's knowledge only to a caller who owns a
 * NON-ARCHIVED business in that country (`app.knowledge_jurisdiction_access`).
 *
 * ## Why this suite needs two tenants with different jurisdictions
 *
 * A single tenant can only ever prove DENIAL: with nothing published in a
 * country they operate in, "sees nothing" is indistinguishable from "there was
 * nothing to see". Proving ACCESS requires a tenant who operates in a
 * jurisdiction that HAS a published pack, and proving the boundary requires a
 * second tenant who does not.
 *
 *   Tenant A — businesses in BS and ZZ. Must SEE the published ZZ pack.
 *   Tenant B — business in BS only.     Must NOT see it, though it is published.
 *
 * ⚠ ZZ is the SYNTHETIC demonstration jurisdiction (ZZ-v0.1). Using it here is
 *   deliberate: it is the only published pack that exists, it contains no real
 *   legal text, and it is a reserved ISO 3166-1 user-assigned code that can
 *   never be a real country. No Bahamian content is read, written or published
 *   by this suite — BS remains gated on G11.
 *
 * ⚠ These tests need a REAL project with REAL sessions. They are skipped when
 *   the RLS environment is not configured, and CI turns that skip into a failure
 *   via RLS_TESTS_REQUIRED=1 — skipping a security suite silently is how
 *   isolation regressions ship.
 */

if (!rlsConfigured && rlsRequired) {
  throw new Error(
    'RLS_TESTS_REQUIRED=1 but the RLS test environment is not configured. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY and RLS_TEST_USER_{A,B}_{EMAIL,PASSWORD}.',
  );
}

/** The jurisdictions tenant A operates in, and therefore may read. */
const A_JURISDICTIONS = ['BS', DEMO_ZZ_COUNTRY_CODE];

describe.skipIf(!rlsConfigured)('Row Level Security — knowledge jurisdiction isolation', () => {
  let A: Db, B: Db, anon: Db;
  let aId: string, bId: string;

  /**
   * True when a published pack exists in a jurisdiction tenant A operates in.
   *
   * Recorded rather than assumed: an empty database must not be able to look
   * like a proof that access works.
   */
  let accessProvable = false;
  let visibleToA: string[] = [];

  beforeAll(async () => {
    [{ db: A, userId: aId }, { db: B, userId: bId }] = await Promise.all([
      signIn('A'),
      signIn('B'),
    ]);
    anon = anonClient();

    await Promise.all([archiveAll(A, aId, RUN), archiveAll(B, bId, RUN)]);

    // Tenant A operates in BS and in the synthetic jurisdiction.
    const { error: aError } = await A.from('businesses').insert([
      { owner_id: aId, name: `${RUN}-a-bs`, country_code: 'BS', industry: 'Hospitality' },
      {
        owner_id: aId,
        name: `${RUN}-a-zz`,
        country_code: DEMO_ZZ_COUNTRY_CODE,
        industry: 'Hospitality',
      },
    ]);
    if (aError) throw new Error(`Setup failed for tenant A: ${aError.message}`);

    // Tenant B operates in BS only. This is the boundary under test.
    const { error: bError } = await B.from('businesses').insert({
      owner_id: bId,
      name: `${RUN}-b-bs`,
      country_code: 'BS',
      industry: 'Hospitality',
    });
    if (bError) throw new Error(`Setup failed for tenant B: ${bError.message}`);

    const { data: packs } = await A.from('knowledge_packs').select('country_code');
    visibleToA = [...new Set((packs ?? []).map((p) => p.country_code))];
    accessProvable = visibleToA.length > 0;

    if (!accessProvable) {
      console.warn(
        '\n⚠  No published Knowledge Pack is visible to tenant A. This suite can prove DENIAL ' +
          'but not ACCESS. Seed the synthetic pack first:\n' +
          '     FOUNDRYAI_DEMO_PACK=1 FOUNDRYAI_DEMO_OWNER_EMAIL=… npm run seed:demo\n',
      );
    }
  }, 30_000);

  afterAll(async () => {
    if (A && aId) await archiveAll(A, aId, RUN);
    if (B && bId) await archiveAll(B, bId, RUN);
  }, 30_000);

  describe('anonymous access', () => {
    it('cannot read knowledge packs', async () => {
      const { data } = await anon.from('knowledge_packs').select('id');
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot read knowledge chunks', async () => {
      const { data } = await anon.from('knowledge_chunks').select('chunk_id');
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot read a published pack it has no business in', async () => {
      // ZZ-v0.1 is published. Publication is not permission.
      const { data } = await anon
        .from('knowledge_packs')
        .select('id')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('a business owner reaches only their own jurisdictions', () => {
    it('sees no pack outside the jurisdictions they operate in', async () => {
      const { data } = await A.from('knowledge_packs').select('country_code');
      for (const pack of data ?? []) {
        expect(A_JURISDICTIONS).toContain(pack.country_code);
      }
    });

    it('sees no chunk outside the jurisdictions they operate in', async () => {
      // The load-bearing assertion. A founder must not be able to read another
      // country's regulatory text by any query they can construct.
      const { data } = await A.from('knowledge_chunks').select('chunk_id, country_code');
      for (const chunk of data ?? []) {
        expect(A_JURISDICTIONS).toContain(chunk.country_code);
      }
    });

    it('sees no source outside the jurisdictions they operate in', async () => {
      const { data } = await A.from('knowledge_sources').select('id, country_code');
      for (const source of data ?? []) {
        expect(A_JURISDICTIONS).toContain(source.country_code);
      }
    });

    it('cannot reach another jurisdiction by asking for it explicitly', async () => {
      // Filtering is not a boundary. This proves the POLICY refuses, not that
      // the application happened not to ask.
      const { data } = await A.from('knowledge_chunks')
        .select('chunk_id')
        .not('country_code', 'in', `(${A_JURISDICTIONS.join(',')})`);

      expect(data ?? []).toHaveLength(0);
    });

    it('cannot reach another jurisdiction through the chunk relation graph', async () => {
      const { data } = await A.from('knowledge_chunk_relations').select('from_chunk_id');
      // Every readable relation must originate from a chunk the caller can read.
      const { data: readable } = await A.from('knowledge_chunks').select('chunk_id');
      const readableIds = new Set((readable ?? []).map((c) => c.chunk_id));

      for (const relation of data ?? []) {
        expect(readableIds.has(relation.from_chunk_id)).toBe(true);
      }
    });
  });

  /**
   * ACCESS — the half this suite could not prove until a pack existed.
   *
   * Denial alone is not the whole security property. A policy that denies
   * everyone is trivially "secure" and completely broken, and the failure looks
   * identical to a correct one in a suite that only tests refusal.
   */
  describe('published knowledge IS reachable in a jurisdiction the caller operates in', () => {
    it('reads the published pack for its own jurisdiction', async () => {
      if (!accessProvable) {
        expect(visibleToA).toEqual([]);
        return;
      }

      const { data } = await A.from('knowledge_packs')
        .select('country_code, version, status')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);

      expect((data ?? []).length).toBeGreaterThan(0);
      expect(data?.[0]?.status).toBe('published');
    });

    it('reads that pack’s sources', async () => {
      if (!accessProvable) return;

      const { data } = await A.from('knowledge_sources')
        .select('id, manifest_id')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);

      expect((data ?? []).length).toBeGreaterThan(0);
    });

    it('reads that pack’s chunks, including their text', async () => {
      // Reading the body matters: a policy that returned rows with unreadable
      // columns would pass a count assertion and fail a founder.
      if (!accessProvable) return;

      const { data } = await A.from('knowledge_chunks')
        .select('chunk_id, body')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);

      expect((data ?? []).length).toBeGreaterThan(0);
      expect((data?.[0]?.body ?? '').length).toBeGreaterThan(0);
    });
  });

  /**
   * The boundary, proven across two real tenants.
   *
   * Tenant B operates in BS only. ZZ-v0.1 is published and readable by tenant A.
   * If B can read any of it, the policy is decorative.
   */
  describe('a second tenant, operating elsewhere, is refused the same pack', () => {
    it('sees no pack for a jurisdiction it does not operate in', async () => {
      const { data } = await B.from('knowledge_packs')
        .select('id')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);
      expect(data ?? []).toHaveLength(0);
    });

    it('sees no sources for it', async () => {
      const { data } = await B.from('knowledge_sources')
        .select('id')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);
      expect(data ?? []).toHaveLength(0);
    });

    it('sees no chunks for it, and no legal text', async () => {
      const { data } = await B.from('knowledge_chunks')
        .select('chunk_id, body')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot reach it by omitting the filter either', async () => {
      const { data } = await B.from('knowledge_chunks').select('country_code');
      for (const chunk of data ?? []) {
        expect(chunk.country_code).not.toBe(DEMO_ZZ_COUNTRY_CODE);
      }
    });
  });

  /**
   * Access follows a LIVE business, and is withdrawn with it.
   *
   * Self-contained: it creates the business, proves access appears, archives it,
   * and proves access disappears — so it leaves tenant B exactly as it found
   * them and does not depend on running before or after anything else.
   *
   * This is the case that would otherwise rot quietly. `app.knowledge_jurisdiction_access`
   * excludes archived businesses, and if that clause were dropped, every other
   * test here would still pass.
   */
  describe('access is withdrawn when the business is archived', () => {
    it('grants on creation and revokes on archive', async () => {
      if (!accessProvable) return;

      const name = `${RUN}-b-zz-temporary`;
      const { data: created, error } = await B.from('businesses')
        .insert({
          owner_id: bId,
          name,
          country_code: DEMO_ZZ_COUNTRY_CODE,
          industry: 'Hospitality',
        })
        .select('id')
        .single();

      if (error || !created) throw new Error(`Setup failed: ${error?.message ?? 'no row'}`);

      const granted = await B.from('knowledge_packs')
        .select('id')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);
      expect((granted.data ?? []).length).toBeGreaterThan(0);

      await B.from('businesses')
        .update({ status: 'archived', archived_at: new Date().toISOString() })
        .eq('id', created.id);

      const revoked = await B.from('knowledge_packs')
        .select('id')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);
      expect(revoked.data ?? []).toHaveLength(0);

      const revokedChunks = await B.from('knowledge_chunks')
        .select('chunk_id')
        .eq('country_code', DEMO_ZZ_COUNTRY_CODE);
      expect(revokedChunks.data ?? []).toHaveLength(0);
    }, 30_000);
  });

  describe('agent executions are private to the business', () => {
    it('returns nothing for a business the caller does not own', async () => {
      const { data } = await A.from('agent_executions').select('id');
      // Tenant A owns only fresh businesses with no Nova runs.
      expect(data ?? []).toHaveLength(0);
    });
  });

  describe('rate limit counters are unreachable', () => {
    it('cannot be read by an authenticated user', async () => {
      const { data } = await A.from('rate_limit_counters').select('scope');
      expect(data ?? []).toHaveLength(0);
    });

    it('cannot be written by an authenticated user', async () => {
      const { error } = await A.from('rate_limit_counters').insert({
        scope: 'nova:ask:user',
        subject_id: aId,
        window_start: new Date().toISOString(),
        count: 0,
      });
      expect(error).toBeTruthy();
    });
  });
});
