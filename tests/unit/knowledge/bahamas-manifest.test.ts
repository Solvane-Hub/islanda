import { describe, expect, it } from 'vitest';
import type { SourceManifest, SourceManifestEntry } from '@/services/knowledge/manifests/types';
import {
  ManifestIntegrityError,
  amendmentsForProvision,
  assertManifestValid,
  findEntry,
  toPersistedLegalStatus,
} from '@/services/knowledge/manifests/types';
import { BAHAMAS_MANIFEST } from '@/services/knowledge/manifests/bahamas';
import { registerSourceSchema } from '@/lib/validation/knowledge';

/**
 * The manifest is the corpus definition. If it is wrong, every downstream
 * guarantee is wrong in a way citations cannot catch — a perfectly cited 2024
 * provision that was repealed in 2025 is still a wrong answer.
 */

const VAT_ACT = 'BS-VAT-ACT-CH370A-REPRINT-2024';
const VAT_45_2025 = 'BS-VAT-AMD-2025-NO45';
const VAT_4_2026 = 'BS-VAT-AMD-2026-NO4';
const DPA_324A = 'BS-DPA-CH324A-2003';
const DPA_2025 = 'BS-DPA-2025-NO74';

function mutate(manifestId: string, patch: Partial<SourceManifestEntry>): SourceManifest {
  return {
    ...BAHAMAS_MANIFEST,
    entries: BAHAMAS_MANIFEST.entries.map((e) =>
      e.manifestId === manifestId ? { ...e, ...patch } : e,
    ),
  };
}

describe('Bahamas manifest — shape', () => {
  it('is valid', () => {
    expect(() => assertManifestValid(BAHAMAS_MANIFEST)).not.toThrow();
  });

  it('holds exactly the seven approved sources', () => {
    // Six instruments plus the 2026-0019 amendment found in the freshness check.
    expect(BAHAMAS_MANIFEST.entries).toHaveLength(7);
  });

  it('includes the 2026-0019 freshness amendment, wired into the VAT chain', () => {
    const amd = findEntry(BAHAMAS_MANIFEST, 'BS-VAT-AMD-2026-NO19');
    expect(amd).not.toBeNull();
    expect(amd!.legalStatus).toBe('in_force');
    expect(amd!.commencementDate).toBe('2026-07-01');
    expect(amd!.amends).toBe('BS-VAT-ACT-CH370A-REPRINT-2024');
    // It raises the VAT registration threshold via the Third Schedule.
    expect(amd!.amendedProvisions).toContain('Third Schedule');
    expect(amd!.amendedProvisions).toContain('section 56');
    // The base Act records it among its amendments.
    const base = findEntry(BAHAMAS_MANIFEST, 'BS-VAT-ACT-CH370A-REPRINT-2024');
    expect(base!.amendedBy).toContain('BS-VAT-AMD-2026-NO19');
  });

  it('targets BS-v0.1', () => {
    expect(BAHAMAS_MANIFEST.knowledgeVersion).toBe('BS-v0.1');
  });

  it('is entirely Authority 5 primary legislation', () => {
    for (const e of BAHAMAS_MANIFEST.entries) {
      expect(e.sourceAuthority).toBe(5);
      expect(e.legalSourceCategory).toBe('primary_legislation');
    }
  });

  it('carries evidence for every status assertion', () => {
    for (const e of BAHAMAS_MANIFEST.entries) {
      expect(e.statusEvidence.length).toBeGreaterThan(0);
    }
  });

  it('produces registrations that satisfy registerSourceSchema', () => {
    for (const e of BAHAMAS_MANIFEST.entries) {
      const result = registerSourceSchema.safeParse({
        knowledgePackId: '11111111-1111-4111-8111-111111111111',
        manifestId: e.manifestId,
        agency: e.agency,
        title: e.title,
        sourceUrl: e.canonicalUrl,
        sourceType: e.sourceType,
        countryCode: e.countryCode,
        sourceAuthority: e.sourceAuthority,
        legalSourceCategory: e.legalSourceCategory,
        freshnessState: e.freshnessState,
        legalStatus: toPersistedLegalStatus(e.legalStatus),
        publicationDate: e.gazettedOn,
      });
      expect(result.success).toBe(true);
    }
  });
});

describe('Bahamas manifest — nothing defaults to current', () => {
  it('marks the amended VAT Act reprint as changed_pending_assessment, not current', () => {
    const base = findEntry(BAHAMAS_MANIFEST, VAT_ACT);
    expect(base?.freshnessState).toBe('changed_pending_assessment');
    expect(base?.legalStatus).toBe('base_text_amended');
  });

  it('marks the uncommenced Data Protection Act 2025 as changed_pending_assessment', () => {
    const dpa = findEntry(BAHAMAS_MANIFEST, DPA_2025);
    expect(dpa?.freshnessState).toBe('changed_pending_assessment');
    expect(dpa?.legalStatus).toBe('enacted_not_in_force');
    expect(dpa?.commencementDate).toBeNull();
  });

  it('rejects a manifest that claims currency for an amended base text', () => {
    expect(() => assertManifestValid(mutate(VAT_ACT, { freshnessState: 'current' }))).toThrow(
      ManifestIntegrityError,
    );
  });

  it('rejects a manifest that claims currency for an uncommenced Act', () => {
    expect(() => assertManifestValid(mutate(DPA_2025, { freshnessState: 'current' }))).toThrow(
      ManifestIntegrityError,
    );
  });
});

describe('Bahamas manifest — bills and drafts can never enter', () => {
  it('rejects any entry that is not law', () => {
    expect(() => assertManifestValid(mutate(VAT_4_2026, { legalStatus: 'not_law' }))).toThrow(
      ManifestIntegrityError,
    );
  });

  it('rejects an entry of unknown status', () => {
    expect(() => assertManifestValid(mutate(VAT_4_2026, { legalStatus: 'unknown' }))).toThrow(
      ManifestIntegrityError,
    );
  });

  it('rejects spent, superseded and repealed instruments', () => {
    for (const status of ['spent', 'superseded', 'repealed'] as const) {
      expect(() => assertManifestValid(mutate(VAT_4_2026, { legalStatus: status }))).toThrow(
        ManifestIntegrityError,
      );
    }
  });

  it('contains no Bill among the six sources', () => {
    for (const e of BAHAMAS_MANIFEST.entries) {
      expect(e.title.toLowerCase()).not.toContain('bill');
    }
  });
});

describe('Bahamas manifest — verified legal chronology', () => {
  it('records assent and commencement for No. 45 of 2025', () => {
    const a = findEntry(BAHAMAS_MANIFEST, VAT_45_2025);
    expect(a?.actNumber).toBe('No. 45 of 2025');
    expect(a?.assentedOn).toBe('2025-06-27');
    expect(a?.commencementDate).toBe('2025-07-01');
  });

  it('records the split commencement of section 22(f)', () => {
    const a = findEntry(BAHAMAS_MANIFEST, VAT_45_2025);
    expect(a?.varyingCommencement).toEqual([
      { provision: 'section 22(f)', commencementDate: '2025-09-01' },
    ]);
  });

  it('records assent and commencement for No. 4 of 2026', () => {
    const a = findEntry(BAHAMAS_MANIFEST, VAT_4_2026);
    expect(a?.actNumber).toBe('No. 4 of 2026');
    expect(a?.assentedOn).toBe('2026-03-23');
    expect(a?.commencementDate).toBe('2026-04-01');
  });

  it('sources No. 4 of 2026 from the legislation register, not the agency page', () => {
    // The DIR page still shows only the Bill. Agency pages are not
    // authoritative for legal status.
    const a = findEntry(BAHAMAS_MANIFEST, VAT_4_2026);
    expect(a?.canonicalUrl).toContain('laws.bahamas.gov.bs');
    expect(a?.canonicalUrl).toContain('AMENDING/2026/2026-0004A');
  });

  it('records the reprint consolidation date', () => {
    expect(findEntry(BAHAMAS_MANIFEST, VAT_ACT)?.consolidatedAsAt).toBe('2024-07-01');
  });

  it('rejects an in-force instrument with no commencement date', () => {
    expect(() => assertManifestValid(mutate(VAT_4_2026, { commencementDate: null }))).toThrow(
      ManifestIntegrityError,
    );
  });

  it('rejects an enacted-not-in-force instrument that also records a commencement date', () => {
    expect(() => assertManifestValid(mutate(DPA_2025, { commencementDate: '2026-01-01' }))).toThrow(
      ManifestIntegrityError,
    );
  });
});

describe('Bahamas manifest — amendment relationships', () => {
  it('links all four amending Acts to Chapter 370A', () => {
    const base = findEntry(BAHAMAS_MANIFEST, VAT_ACT);
    expect(base?.amendedBy).toHaveLength(4);
    for (const id of base?.amendedBy ?? []) {
      expect(findEntry(BAHAMAS_MANIFEST, id)?.amends).toBe(VAT_ACT);
    }
  });

  it('records that section 56 is repealed and replaced by No. 45 of 2025', () => {
    const amendments = amendmentsForProvision(BAHAMAS_MANIFEST, VAT_ACT, 'section 56');
    expect(amendments.map((a) => a.actNumber)).toContain('No. 45 of 2025');
  });

  it('records the three-layer chain on section 6 — rates of tax', () => {
    const amendments = amendmentsForProvision(BAHAMAS_MANIFEST, VAT_ACT, 'section 6');
    expect(amendments.map((a) => a.actNumber).sort()).toEqual(['No. 3 of 2025', 'No. 4 of 2026']);
  });

  it('records the Second Schedule amendments (No. 4 of 2026 and No. 2 Act of 2026)', () => {
    const amendments = amendmentsForProvision(BAHAMAS_MANIFEST, VAT_ACT, 'Second Schedule');
    const actNumbers = amendments.map((a) => a.actNumber);
    expect(actNumbers).toContain('No. 4 of 2026');
    expect(actNumbers).toContain('No. 2 Act of 2026');
  });

  it('returns nothing for an unamended provision', () => {
    expect(amendmentsForProvision(BAHAMAS_MANIFEST, VAT_ACT, 'section 999')).toEqual([]);
  });

  it('records that the 2025 Act repeals Chapter 324A on commencement', () => {
    expect(findEntry(BAHAMAS_MANIFEST, DPA_2025)?.repeals).toBe(DPA_324A);
    expect(findEntry(BAHAMAS_MANIFEST, DPA_324A)?.repealedBy).toBe(DPA_2025);
  });

  it('rejects a dangling relationship reference', () => {
    expect(() => assertManifestValid(mutate(VAT_4_2026, { amends: 'BS-DOES-NOT-EXIST' }))).toThrow(
      ManifestIntegrityError,
    );
  });

  it('rejects an amending instrument that names no amended provisions', () => {
    expect(() => assertManifestValid(mutate(VAT_4_2026, { amendedProvisions: [] }))).toThrow(
      ManifestIntegrityError,
    );
  });

  it('rejects a self-reference', () => {
    expect(() => assertManifestValid(mutate(VAT_4_2026, { amends: VAT_4_2026 }))).toThrow(
      ManifestIntegrityError,
    );
  });
});

describe('Bahamas manifest — acquisition readiness', () => {
  it('has fetched every source with a usable text layer', () => {
    for (const e of BAHAMAS_MANIFEST.entries) {
      expect(e.fetchStatus).toBe('fetched');
      expect(e.textLayerPresent).toBe(true);
    }
  });

  it('rejects a source that would need OCR', () => {
    expect(() =>
      assertManifestValid(
        mutate(VAT_ACT, { fetchStatus: 'ocr_required', textLayerPresent: false }),
      ),
    ).toThrow(ManifestIntegrityError);
  });

  it('strips tracking parameters from the canonical URL while preserving what was supplied', () => {
    const dpa = findEntry(BAHAMAS_MANIFEST, DPA_324A);
    expect(dpa?.suppliedUrl).toContain('utm_source=chatgpt.com');
    expect(dpa?.canonicalUrl).not.toContain('?');
    expect(dpa?.canonicalUrl).toContain('2003-0003.pdf');
  });

  it('flags every source for human review before ingestion', () => {
    for (const e of BAHAMAS_MANIFEST.entries) {
      expect(e.humanReviewRequired).toBe(true);
      expect(e.reviewNotes.length).toBeGreaterThan(0);
    }
  });
});
