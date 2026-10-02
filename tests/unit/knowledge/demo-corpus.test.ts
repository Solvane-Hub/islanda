import { describe, expect, it } from 'vitest';

import { draftChunkSchema } from '@/lib/validation/knowledge';
import { registerSourceSchema } from '@/lib/validation/knowledge';
import { isUserAssignedCountryCode } from '@/lib/knowledge/jurisdiction';
import { parseProvision } from '@/lib/knowledge/provision';
import { prepareChunks } from '@/services/knowledge/chunking';
import { validateSource, mayPublish } from '@/services/knowledge/validation';
import { assertManifestValid, toRegistrationInput } from '@/services/knowledge/manifests/types';
import {
  jurisdictionsWithManifest,
  manifestForJurisdiction,
} from '@/services/knowledge/manifests/registry';
import {
  DEMO_ZZ_ALL_CHUNKS,
  DEMO_ZZ_BUSINESS_NAME,
  DEMO_ZZ_COUNTRY_CODE,
  DEMO_ZZ_COUNTRY_NAME,
  DEMO_ZZ_KNOWLEDGE_VERSION,
  DEMO_ZZ_MANIFEST,
  DEMO_ZZ_SOURCES,
  SYNTHETIC_TITLE_MARKER,
  demoZzDraftsFor,
} from '@/services/knowledge/manifests/demo-zz';

/**
 * The synthetic demonstration corpus.
 *
 * Two questions are being asked here, and the second matters more than the
 * first:
 *
 *   1. Is this corpus VALID — does it pass every gate a real corpus passes?
 *   2. Is this corpus UNMISTAKABLE — could any part of it be read, by a person
 *      or by a machine, as real law from a real place?
 *
 * A demonstration corpus that fails (1) proves nothing about the pipeline. One
 * that fails (2) is a liability.
 */

const PACK_ID = '33333333-3333-4333-8333-333333333333';

describe('demo corpus — valid by the same gates a real corpus passes', () => {
  it('passes manifest integrity validation', () => {
    expect(() => assertManifestValid(DEMO_ZZ_MANIFEST)).not.toThrow();
  });

  it('registers every instrument through the real registration schema', () => {
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      const parsed = registerSourceSchema.safeParse(
        toRegistrationInput(entry, { knowledgePackId: PACK_ID }),
      );

      expect(parsed.success, `${entry.manifestId}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('validates every instrument to a publishable outcome', () => {
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      const drafts = demoZzDraftsFor(entry.manifestId);
      const result = validateSource({
        agency: entry.agency,
        title: entry.title,
        sourceUrl: entry.canonicalUrl,
        sourceAuthority: entry.sourceAuthority,
        legalSourceCategory: entry.legalSourceCategory,
        publicationDate: entry.gazettedOn,
        lastReviewedDate: null,
        sectionReferencePresent: drafts.some((d) => typeof d.sectionReference === 'string'),
        bodyLength: drafts.reduce((n, d) => n + d.body.trim().length, 0),
      });

      expect(mayPublish(result.outcome), `${entry.manifestId}: ${result.failureReasons}`).toBe(
        true,
      );
    }
  });

  it('produces chunks through the real chunking pipeline', () => {
    for (const spec of DEMO_ZZ_SOURCES) {
      const entry = DEMO_ZZ_MANIFEST.entries.find((e) => e.manifestId === spec.manifestId);
      expect(entry, `no manifest entry for ${spec.manifestId}`).toBeDefined();

      const prepared = prepareChunks({
        source: {
          id: `src-${spec.manifestId}`,
          knowledge_pack_id: PACK_ID,
          country_code: entry!.countryCode,
          source_authority: entry!.sourceAuthority,
          legal_source_category: entry!.legalSourceCategory,
        },
        knowledgeVersion: DEMO_ZZ_KNOWLEDGE_VERSION,
        drafts: spec.chunks.map((c) => c.draft),
      });

      expect(prepared).toHaveLength(spec.chunks.length);
      // K5 §3.10 — every chunk carries an identity, derived not asserted.
      expect(prepared.every((c) => c.chunk_id.length > 0)).toBe(true);
    }
  });

  it('gives every source at least one chunk, so the K7 §6 gate can pass', () => {
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      expect(demoZzDraftsFor(entry.manifestId).length).toBeGreaterThan(0);
    }
  });

  it('has enough substantive material to answer a founder', () => {
    const substantive = DEMO_ZZ_ALL_CHUNKS.filter((c) => c.draft.instrumentRole === 'substantive');
    expect(substantive.length).toBeGreaterThanOrEqual(8);
  });

  it('covers licensing, registration and record-keeping', () => {
    const domains = new Set(DEMO_ZZ_ALL_CHUNKS.map((c) => c.draft.regulatoryDomain));

    expect(domains).toContain('food_licensing');
    expect(domains).toContain('food_registration');
    expect(domains).toContain('food_recordkeeping');
  });

  it('contains one provision amended by an in-force instrument', () => {
    const inForce = DEMO_ZZ_MANIFEST.entries.find(
      (e) => e.amends !== null && e.legalStatus === 'in_force',
    );

    expect(inForce).toBeDefined();
    expect(inForce?.commencementDate).not.toBeNull();
    expect(inForce?.amendedProvisions.length).toBeGreaterThan(0);
  });

  it('contains one amendment whose commencement is not established', () => {
    const pending = DEMO_ZZ_MANIFEST.entries.find((e) => e.legalStatus === 'enacted_not_in_force');

    expect(pending).toBeDefined();
    // Enacted but not commenced means exactly that: assented, no commencement.
    expect(pending?.assentedOn).not.toBeNull();
    expect(pending?.commencementDate).toBeNull();
  });

  it('parses every amended provision into a canonical identifier', () => {
    // An unparseable reference would match nothing at query time and would be
    // indistinguishable from an instrument that amends nothing.
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      for (const provision of entry.amendedProvisions) {
        expect(parseProvision(provision), `${entry.manifestId}: "${provision}"`).not.toBeNull();
      }
    }
  });

  it('accepts every draft against the real chunk schema', () => {
    for (const { key, draft } of DEMO_ZZ_ALL_CHUNKS) {
      const parsed = draftChunkSchema.safeParse(draft);
      expect(parsed.success, `${key}: ${parsed.error?.message}`).toBe(true);
    }
  });

  it('uses unique fixture keys', () => {
    const keys = DEMO_ZZ_ALL_CHUNKS.map((c) => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('demo corpus — cannot be mistaken for a real jurisdiction', () => {
  it('uses an ISO 3166-1 user-assigned country code', () => {
    // Permanently reserved by the standard. No real country can ever hold it,
    // so no real jurisdiction can collide with this corpus.
    expect(isUserAssignedCountryCode(DEMO_ZZ_COUNTRY_CODE)).toBe(true);
  });

  it('is not a real jurisdiction code', () => {
    for (const real of ['BS', 'JM', 'BB', 'TT', 'GY', 'BZ', 'US', 'GB', 'CA']) {
      expect(DEMO_ZZ_COUNTRY_CODE).not.toBe(real);
      expect(isUserAssignedCountryCode(real)).toBe(false);
    }
  });

  it('scopes every manifest entry to ZZ', () => {
    expect(DEMO_ZZ_MANIFEST.countryCode).toBe(DEMO_ZZ_COUNTRY_CODE);
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      expect(entry.countryCode).toBe(DEMO_ZZ_COUNTRY_CODE);
    }
  });

  it('marks every instrument title as synthetic', () => {
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      expect(entry.title, entry.manifestId).toContain(SYNTHETIC_TITLE_MARKER);
    }
  });

  it('names a fictional agency and jurisdiction', () => {
    expect(DEMO_ZZ_COUNTRY_NAME).toContain('SYNTHETIC');
    expect(DEMO_ZZ_BUSINESS_NAME).toContain('SYNTHETIC');
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      expect(entry.agency).toBe('Example Regulatory Authority');
    }
  });

  it('points every URL at the reserved example.invalid domain', () => {
    // RFC 2606 reserves `.invalid`; it can never resolve. A reader who ignores
    // every label still cannot follow one of these to a government site.
    for (const entry of DEMO_ZZ_MANIFEST.entries) {
      expect(entry.canonicalUrl, entry.manifestId).toMatch(/^https:\/\/example\.invalid\//);
      expect(entry.suppliedUrl, entry.manifestId).toMatch(/^https:\/\/example\.invalid\//);
    }
  });

  it('names no real jurisdiction, agency or statute anywhere in the corpus', () => {
    const haystack = [
      JSON.stringify(DEMO_ZZ_MANIFEST),
      ...DEMO_ZZ_ALL_CHUNKS.map((c) => JSON.stringify(c.draft)),
    ]
      .join(' ')
      .toLowerCase();

    for (const forbidden of [
      'bahamas',
      'bahamian',
      'value added tax',
      'inland revenue',
      'gov.bs',
      'jamaica',
      'barbados',
      'trinidad',
      'guyana',
      'belize',
    ]) {
      expect(haystack, `corpus mentions "${forbidden}"`).not.toContain(forbidden);
    }
  });

  it('carries a version whose prefix is the synthetic jurisdiction', () => {
    // `kp_version_format` forbids the word "demo" in a version, so the country
    // code is what carries the signal — and the banner keys off exactly this.
    expect(DEMO_ZZ_KNOWLEDGE_VERSION.startsWith(`${DEMO_ZZ_COUNTRY_CODE}-`)).toBe(true);
    expect(DEMO_ZZ_KNOWLEDGE_VERSION).toMatch(/^[A-Z]{2}-v[0-9]+\.[0-9]+$/);
  });
});

describe('manifest registry', () => {
  it('resolves the demo manifest for ZZ', () => {
    expect(manifestForJurisdiction(DEMO_ZZ_COUNTRY_CODE)).toBe(DEMO_ZZ_MANIFEST);
  });

  it('registers BS now that BS-v0.1 is published', () => {
    // Registering a manifest belongs with the decision to publish. BS-v0.1 is
    // published (G11 eligibility cleared), so its manifest is wired in to resolve
    // the VAT amendment chain.
    const bs = manifestForJurisdiction('BS');
    expect(bs).not.toBeNull();
    expect(bs!.countryCode).toBe('BS');
    expect(jurisdictionsWithManifest()).toContain('BS');
  });

  it('registers only ZZ and BS — no other real jurisdiction', () => {
    for (const code of jurisdictionsWithManifest()) {
      const allowed = code === 'BS' || isUserAssignedCountryCode(code);
      expect(allowed, `${code} is an unexpected registered jurisdiction`).toBe(true);
    }
  });

  it('returns null for an unregistered jurisdiction', () => {
    expect(manifestForJurisdiction('JM')).toBeNull();
  });
});
