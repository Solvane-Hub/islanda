import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgePack } from '@/types/knowledge';

import {
  NO_JURISDICTION,
  businessProfileStatus,
  getJurisdictionCapability,
  knowledgePackStatus,
} from '@/services/knowledge/capability';
import { ZZ_PACK } from '@/tests/fixtures/knowledge/synthetic-amendment-chain';

/**
 * Computed capability status.
 *
 * The bug this replaces: four surfaces each asserted
 * `met: false, detail: '… no pack has been published yet'` as a literal, and
 * went on asserting it after a pack was published. These tests exist to make
 * the status a function of the database rather than of when someone last read
 * the file.
 *
 * The second concern is labelling. A published pack changes the copy from "not
 * yet" to "ready", and if that transition can happen for a SYNTHETIC corpus
 * without the word "synthetic" appearing, the labelling apparatus has a hole in
 * exactly the place it matters.
 */

function mockDb(pack: KnowledgePack | null): SupabaseClient<Database> {
  const from = vi.fn(() => ({
    select: () => ({
      eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pack, error: null }) }) }),
    }),
  }));

  return { from } as unknown as SupabaseClient<Database>;
}

/** A real jurisdiction with a published pack. Invented for the test only. */
const REAL_PACK: KnowledgePack = { ...ZZ_PACK, country_code: 'JM', version: 'JM-v1.0' };

describe('reading capability from the database', () => {
  it('reports a published pack and its version', async () => {
    const capability = await getJurisdictionCapability(mockDb(ZZ_PACK), 'ZZ');

    expect(capability.knowledgePublished).toBe(true);
    expect(capability.knowledgeVersion).toBe('ZZ-v0.1');
    expect(capability.countryCode).toBe('ZZ');
  });

  it('reports no pack rather than assuming one', async () => {
    const capability = await getJurisdictionCapability(mockDb(null), 'BS');

    expect(capability.knowledgePublished).toBe(false);
    expect(capability.knowledgeVersion).toBeNull();
  });

  it('says nothing at all when there is no business, and so no jurisdiction', async () => {
    expect(await getJurisdictionCapability(mockDb(ZZ_PACK), null)).toEqual(NO_JURISDICTION);
    expect(await getJurisdictionCapability(mockDb(ZZ_PACK), undefined)).toEqual(NO_JURISDICTION);
  });

  it('does not query the database when there is no jurisdiction', async () => {
    // K5 §3.2 — jurisdiction is mandatory and never inferred. A lookup with no
    // country is a lookup that could only return something misleading.
    const db = mockDb(ZZ_PACK);
    await getJurisdictionCapability(db, null);

    expect(db.from).not.toHaveBeenCalled();
  });

  it('marks a user-assigned jurisdiction as a synthetic corpus', async () => {
    expect((await getJurisdictionCapability(mockDb(ZZ_PACK), 'ZZ')).syntheticCorpus).toBe(true);
  });

  it('does not mark a real jurisdiction as synthetic', async () => {
    for (const code of ['BS', 'JM', 'BB', 'TT']) {
      const capability = await getJurisdictionCapability(mockDb(REAL_PACK), code);
      expect(capability.syntheticCorpus, code).toBe(false);
    }
  });
});

describe('the Knowledge Pack prerequisite, worded from the facts', () => {
  it('is unmet, and cites the legal review, when nothing is published', async () => {
    const status = knowledgePackStatus(await getJurisdictionCapability(mockDb(null), 'BS'));

    expect(status.met).toBe(false);
    expect(status.detail).toMatch(/pending a legal review/i);
    // The old copy claimed a fact about the whole platform. It must not return.
    expect(status.detail).not.toMatch(/no pack has been published/i);
  });

  it('never claims a Bahamian pack exists while none does', async () => {
    const status = knowledgePackStatus(await getJurisdictionCapability(mockDb(null), 'BS'));
    expect(status.met).toBe(false);
  });

  it('is met, and names the version, when a pack is published', async () => {
    const status = knowledgePackStatus(await getJurisdictionCapability(mockDb(REAL_PACK), 'JM'));

    expect(status.met).toBe(true);
    expect(status.detail).toContain('JM-v1.0');
  });

  it('says "SYNTHETIC" whenever the published pack is a demonstration corpus', async () => {
    // The load-bearing assertion. A met prerequisite reads as reassurance, and
    // reassurance about invented law is the failure mode.
    const status = knowledgePackStatus(await getJurisdictionCapability(mockDb(ZZ_PACK), 'ZZ'));

    expect(status.met).toBe(true);
    expect(status.detail).toContain('SYNTHETIC');
    expect(status.detail).toMatch(/fictional/i);
    expect(status.detail).toMatch(/not.*real law/i);
  });

  it('does not label a real jurisdiction as synthetic', async () => {
    const status = knowledgePackStatus(await getJurisdictionCapability(mockDb(REAL_PACK), 'JM'));

    expect(status.detail).not.toContain('SYNTHETIC');
    expect(status.detail).not.toMatch(/fictional/i);
  });

  it('describes no law in any branch', async () => {
    // Copy about the corpus, never about its contents.
    for (const capability of [
      await getJurisdictionCapability(mockDb(null), 'BS'),
      await getJurisdictionCapability(mockDb(REAL_PACK), 'JM'),
      await getJurisdictionCapability(mockDb(ZZ_PACK), 'ZZ'),
    ]) {
      const { detail } = knowledgePackStatus(capability);
      for (const forbidden of ['must register', 'you are required', 'VAT', 'per cent', '%']) {
        expect(detail, `copy asserts "${forbidden}"`).not.toContain(forbidden);
      }
    }
  });

  it('uses one label for the prerequisite everywhere', async () => {
    const a = knowledgePackStatus(await getJurisdictionCapability(mockDb(null), 'BS'));
    const b = knowledgePackStatus(await getJurisdictionCapability(mockDb(ZZ_PACK), 'ZZ'));

    expect(a.label).toBe(b.label);
  });
});

describe('the business profile prerequisite', () => {
  it('follows the real intake state', () => {
    expect(businessProfileStatus(true).met).toBe(true);
    expect(businessProfileStatus(false).met).toBe(false);
  });

  it('is worded identically regardless of state', () => {
    expect(businessProfileStatus(true).detail).toBe(businessProfileStatus(false).detail);
  });
});
