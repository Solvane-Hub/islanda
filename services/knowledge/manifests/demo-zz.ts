import type { DraftChunkInput } from '@/lib/validation/knowledge';
import type { SourceManifest, SourceManifestEntry } from '@/services/knowledge/manifests/types';
import { isUserAssignedCountryCode } from '@/lib/knowledge/jurisdiction';

/**
 * Example Jurisdiction (ZZ) — the synthetic demonstration corpus.
 *
 * ⚠ **NONE OF THIS IS LAW.** Every instrument, section, agency and date below is
 *   invented. `ZZ` is an ISO 3166-1 *user-assigned* code: it is reserved, it can
 *   never be allocated to a real country, and no real jurisdiction can collide
 *   with it. Every URL is `example.invalid`, a reserved TLD (RFC 2606) that
 *   cannot resolve, so nothing here can be mistaken for a citation to a real
 *   government document even by a reader who ignores every label.
 *
 * ⚠ **No real Bahamian — or any other real — legal text appears here, and none
 *   may ever be added.** The G11 commercial-reuse gate is a restriction on real
 *   legal source material; this file exists precisely so that Nova can be
 *   demonstrated end to end without going anywhere near it.
 *
 * ## Why this lives in `services/` rather than `tests/`
 *
 * It is loaded by the seed script and by the runtime manifest registry, so it
 * must not sit in a directory the production build excludes. The test fixture
 * `tests/fixtures/knowledge/synthetic-amendment-chain.ts` now *derives* its
 * database-shaped rows from this module rather than restating the corpus, so the
 * corpus a test exercises and the corpus a demo publishes cannot drift apart.
 *
 * ## Containment
 *
 * Containment is a property of the *jurisdiction*, not of a flag. The Day 6
 * policy `app.knowledge_jurisdiction_access` scopes every knowledge read to
 * countries where the caller owns a non-archived business, so a founder
 * operating in BS cannot read a ZZ chunk by any query they can construct. A
 * boolean `demo_mode` would be one forgotten branch away from leaking; a Row
 * Level Security policy is not.
 *
 * ## Shape of the corpus
 *
 *   Example Widget Licensing Act (base, consolidated as at 2024-07-01)
 *     ├─ Amendment Act A  — IN FORCE,            amends s.4 and s.9
 *     └─ Amendment Act B  — ENACTED, NOT IN FORCE, amends s.9
 *   Example Prepared Food Trading Act (in force, never amended)
 *
 * So section 4 has one established amendment; section 9 has one established and
 * one unestablished — which is the case where the current legal position must
 * NOT be stated — and the Prepared Food Act is the clean, unamended path.
 */

// ── Identity ────────────────────────────────────────────────────────────────

/**
 * ISO 3166-1 alpha-2 user-assigned code. Reserved; never a real country.
 *
 * Exported as a constant because several independent guards compare against it
 * — the seed script, the manifest registry and the synthetic banner. A literal
 * repeated in three places is a literal that eventually disagrees with itself.
 */
export const DEMO_ZZ_COUNTRY_CODE = 'ZZ';

/**
 * Guard against this file ever naming a real jurisdiction.
 *
 * Evaluated at module load, so an edit that changed `DEMO_ZZ_COUNTRY_CODE` to a
 * real country code would fail the build and every test rather than quietly
 * turning the seed script into something that writes real regulatory data.
 */
if (!isUserAssignedCountryCode(DEMO_ZZ_COUNTRY_CODE)) {
  throw new Error(
    `demo-zz.ts: "${DEMO_ZZ_COUNTRY_CODE}" is not an ISO 3166-1 user-assigned code. The ` +
      'demonstration corpus may only ever describe a reserved, non-existent jurisdiction.',
  );
}

/**
 * `knowledge_packs.kp_version_format` is `^[A-Z]{2}-v[0-9]+\.[0-9]+$`, so the
 * version string CANNOT carry the word "demo". The country code carries the
 * signal instead, which is why the banner keys off the `ZZ-` prefix.
 */
export const DEMO_ZZ_KNOWLEDGE_VERSION = 'ZZ-v0.1';

/** Country row the pack and the demo business both reference. Never `is_active`. */
export const DEMO_ZZ_COUNTRY_NAME = 'Example Jurisdiction (SYNTHETIC)';
export const DEMO_ZZ_CURRENCY_CODE = 'ZZD';

/** Deterministic, and self-describing on any screen it appears on. */
export const DEMO_ZZ_BUSINESS_NAME = 'Example Demo Trading Co. (SYNTHETIC)';
export const DEMO_ZZ_BUSINESS_INDUSTRY = 'Hospitality';

export const DEMO_ZZ_AGENCY = 'Example Regulatory Authority';

export const ZZ_BASE = 'ZZ-WIDGET-ACT-BASE';
export const ZZ_AMEND_IN_FORCE = 'ZZ-WIDGET-AMD-A-IN-FORCE';
export const ZZ_AMEND_NOT_IN_FORCE = 'ZZ-WIDGET-AMD-B-NOT-IN-FORCE';
export const ZZ_FOOD_ACT = 'ZZ-PREPARED-FOOD-ACT';

const BASE_URL = 'https://example.invalid/widget-licensing-act';
const AMEND_A_URL = 'https://example.invalid/widget-licensing-amendment-a';
const AMEND_B_URL = 'https://example.invalid/widget-licensing-amendment-b';
const FOOD_URL = 'https://example.invalid/prepared-food-trading-act';

/**
 * The marker every synthetic instrument title carries.
 *
 * Asserted by test, so an instrument cannot be added to this corpus without
 * saying on its face that it is not real.
 */
export const SYNTHETIC_TITLE_MARKER = 'SYNTHETIC';

// ── Manifest ────────────────────────────────────────────────────────────────

function entry(
  overrides: Partial<SourceManifestEntry> & Pick<SourceManifestEntry, 'manifestId'>,
): SourceManifestEntry {
  return {
    suppliedUrl: BASE_URL,
    canonicalUrl: BASE_URL,
    fetchStatus: 'fetched',
    textLayerPresent: true,
    countryCode: DEMO_ZZ_COUNTRY_CODE,
    agency: DEMO_ZZ_AGENCY,
    title: 'Example Widget Licensing Act (SYNTHETIC — not real legislation)',
    sourceType: 'act',
    legalSourceCategory: 'primary_legislation',
    sourceAuthority: 5,
    freshnessState: 'current',
    actNumber: null,
    chapter: null,
    gazettedOn: '2024-01-15',
    assentedOn: null,
    commencementDate: '2024-03-01',
    varyingCommencement: [],
    consolidatedAsAt: null,
    legalStatus: 'in_force',
    amends: null,
    amendedProvisions: [],
    repeals: null,
    amendedBy: [],
    repealedBy: null,
    statusEvidence: [
      { quote: 'SYNTHETIC fixture — no real instrument is described.', locator: 'demo-zz.ts' },
    ],
    humanReviewRequired: false,
    reviewNotes: ['SYNTHETIC — not real legislation. Example Jurisdiction (ZZ) is fictional.'],
    ...overrides,
  };
}

export const DEMO_ZZ_MANIFEST: SourceManifest = {
  knowledgeVersion: DEMO_ZZ_KNOWLEDGE_VERSION,
  countryCode: DEMO_ZZ_COUNTRY_CODE,
  scope:
    'SYNTHETIC demonstration corpus for Example Jurisdiction (ZZ). Invented licensing, ' +
    'registration, reporting and record-keeping obligations, plus a two-step amendment chain. ' +
    'Contains no real legislation from any jurisdiction.',
  entries: [
    entry({
      manifestId: ZZ_BASE,
      // Amended, therefore not current in isolation and may not claim currency.
      freshnessState: 'changed_pending_assessment',
      legalStatus: 'base_text_amended',
      commencementDate: null,
      consolidatedAsAt: '2024-07-01',
      amendedBy: [ZZ_AMEND_IN_FORCE, ZZ_AMEND_NOT_IN_FORCE],
    }),
    entry({
      manifestId: ZZ_AMEND_IN_FORCE,
      suppliedUrl: AMEND_A_URL,
      canonicalUrl: AMEND_A_URL,
      title: 'Example Widget Licensing (Amendment) Act A (SYNTHETIC)',
      actNumber: 'No. 1 of 2025',
      assentedOn: '2025-02-01',
      commencementDate: '2025-03-01',
      legalStatus: 'in_force',
      freshnessState: 'current',
      amends: ZZ_BASE,
      amendedProvisions: ['section 4', 'section 9'],
    }),
    entry({
      manifestId: ZZ_AMEND_NOT_IN_FORCE,
      suppliedUrl: AMEND_B_URL,
      canonicalUrl: AMEND_B_URL,
      title: 'Example Widget Licensing (Amendment) Act B (SYNTHETIC)',
      actNumber: 'No. 2 of 2025',
      assentedOn: '2025-11-01',
      // Appointed-day commencement, day not appointed. This is the case that
      // makes the current legal position unstatable.
      commencementDate: null,
      legalStatus: 'enacted_not_in_force',
      freshnessState: 'changed_pending_assessment',
      amends: ZZ_BASE,
      amendedProvisions: ['section 9'],
    }),
    entry({
      manifestId: ZZ_FOOD_ACT,
      suppliedUrl: FOOD_URL,
      canonicalUrl: FOOD_URL,
      title: 'Example Prepared Food Trading Act (SYNTHETIC — not real legislation)',
      actNumber: 'No. 7 of 2024',
      gazettedOn: '2024-04-02',
      assentedOn: '2024-04-01',
      commencementDate: '2024-05-01',
      legalStatus: 'in_force',
      freshnessState: 'current',
    }),
  ],
};

// ── Chunks ──────────────────────────────────────────────────────────────────

/**
 * One synthetic chunk.
 *
 * `key` is a stable, readable identifier used by the TEST fixtures. It is NOT a
 * `chunk_id` — real ingestion derives that from the knowledge version, source id
 * and body via `deriveChunkId`, and nothing here may pre-empt it. Keeping the
 * two distinct is what stops a fixture id from being mistaken for a citation
 * identity.
 */
export interface DemoChunkSpec {
  key: string;
  draft: DraftChunkInput;
}

export interface DemoSourceSpec {
  manifestId: string;
  chunks: readonly DemoChunkSpec[];
}

/**
 * The corpus, grouped by instrument.
 *
 * Deliberately small and deterministic: eleven chunks, no generated content, no
 * randomness. A demonstration corpus that cannot be read in full by the person
 * demonstrating it is a corpus they cannot vouch for.
 */
export const DEMO_ZZ_SOURCES: readonly DemoSourceSpec[] = [
  {
    manifestId: ZZ_BASE,
    chunks: [
      {
        key: 'zz-chunk-s4',
        draft: {
          chunkIndex: 0,
          sectionReference: 'section 4',
          instrumentRole: 'substantive',
          body: 'A person shall hold a current widget licence before operating a widget.',
          keywords: ['widget', 'licence'],
          regulatoryDomain: 'widget_licensing',
          page: 1,
          effectiveDate: '2024-03-01',
        },
      },
      {
        key: 'zz-chunk-s9',
        draft: {
          chunkIndex: 1,
          sectionReference: 'section 9',
          instrumentRole: 'substantive',
          body: 'A widget registrant shall submit an annual widget return.',
          keywords: ['widget', 'return', 'annual'],
          regulatoryDomain: 'widget_reporting',
          page: 1,
          effectiveDate: '2024-03-01',
        },
      },
      {
        key: 'zz-chunk-s12',
        draft: {
          chunkIndex: 2,
          sectionReference: 'section 12',
          instrumentRole: 'substantive',
          body: 'A widget inspector may enter premises during business hours.',
          keywords: ['inspector', 'premises'],
          regulatoryDomain: 'widget_inspection',
          page: 1,
          effectiveDate: '2024-03-01',
        },
      },
      {
        /**
         * A SUBSECTION of an amended section.
         *
         * The manifest amends `section 9`; this chunk is labelled `section 9(1)`.
         * Display-string matching would find no amendments and present amended
         * text as settled. Canonical matching walks the lineage.
         */
        key: 'zz-chunk-s9-sub',
        draft: {
          chunkIndex: 3,
          sectionReference: 'section 9(1)',
          instrumentRole: 'substantive',
          body: 'The prescribed widget return form shall be filed within thirty days.',
          keywords: ['widget', 'return', 'prescribed', 'form'],
          regulatoryDomain: 'widget_reporting',
          page: 1,
          effectiveDate: '2024-03-01',
        },
      },
      {
        /**
         * A substantive chunk with NO parseable provision reference.
         *
         * Interpretation sections and Schedules routinely lack a clean section
         * number, and they are exactly where consequential amendments land.
         * Skipping them silently would present them as unamended.
         */
        key: 'zz-chunk-no-ref',
        draft: {
          chunkIndex: 4,
          sectionReference: null,
          instrumentRole: 'substantive',
          body: 'In this Act, "widget" means any mechanical contrivance of a widget-like character.',
          keywords: ['widget', 'means', 'interpretation'],
          regulatoryDomain: 'widget_definitions',
          page: 1,
          effectiveDate: '2024-03-01',
        },
      },
    ],
  },
  {
    manifestId: ZZ_AMEND_IN_FORCE,
    chunks: [
      {
        /**
         * An AMENDING INSTRUCTION, not a provision.
         *
         * Deliberately keyword-rich so it OUT-SCORES the substantive section 4
         * chunk on a licence query. Ranking must still place it second, because
         * quoting an edit instruction to a founder is grounded, cited and
         * useless.
         */
        key: 'zz-chunk-amend-a-s4',
        draft: {
          chunkIndex: 0,
          sectionReference: 'section 2',
          instrumentRole: 'amending_instruction',
          amendsProvision: 'section 4',
          body: 'Section 4 of the principal Act is amended by the deletion of the word "current" and the substitution of the word "valid", in relation to a widget licence.',
          keywords: ['widget', 'licence', 'current', 'valid', 'amended'],
          regulatoryDomain: 'widget_licensing',
          page: 1,
          effectiveDate: '2025-03-01',
        },
      },
      {
        key: 'zz-chunk-amend-a-s9',
        draft: {
          chunkIndex: 1,
          sectionReference: 'section 3',
          instrumentRole: 'amending_instruction',
          amendsProvision: 'section 9',
          body: 'Section 9 of the principal Act is amended by the insertion, immediately after the word "annual", of the words "or such other periodic".',
          keywords: ['widget', 'periodic', 'amended'],
          regulatoryDomain: 'widget_reporting',
          page: 1,
          effectiveDate: '2025-03-01',
        },
      },
    ],
  },
  {
    manifestId: ZZ_AMEND_NOT_IN_FORCE,
    chunks: [
      {
        /**
         * The edit whose commencement is not established.
         *
         * `effectiveDate` is null on purpose: an instrument that has not
         * commenced has no date on which its chunks took effect, and inventing
         * one to satisfy a column would be the exact fiction this corpus exists
         * to demonstrate the absence of.
         */
        key: 'zz-chunk-amend-b-s9',
        draft: {
          chunkIndex: 0,
          sectionReference: 'section 2',
          instrumentRole: 'amending_instruction',
          amendsProvision: 'section 9',
          body: 'Section 9 of the principal Act is amended by the deletion of the words "a widget registrant" and the substitution of the words "a registered widget operator".',
          keywords: ['widget', 'registrant', 'operator', 'amended'],
          regulatoryDomain: 'widget_reporting',
          page: 1,
          effectiveDate: null,
        },
      },
    ],
  },
  {
    manifestId: ZZ_FOOD_ACT,
    chunks: [
      {
        /** The clean golden path: unamended, high-scoring, unambiguous. */
        key: 'zz-chunk-food-s3',
        draft: {
          chunkIndex: 0,
          sectionReference: 'section 3',
          instrumentRole: 'substantive',
          body: 'No person shall sell prepared food to the public except under a prepared food licence issued by the Example Regulatory Authority.',
          keywords: ['prepared', 'food', 'licence', 'sell'],
          regulatoryDomain: 'food_licensing',
          page: 1,
          effectiveDate: '2024-05-01',
        },
      },
      {
        key: 'zz-chunk-food-s5',
        draft: {
          chunkIndex: 1,
          sectionReference: 'section 5',
          instrumentRole: 'substantive',
          body: 'A person who sells prepared food shall register the place of business with the Example Registrar within twenty-one days of commencing to trade.',
          keywords: ['register', 'registration', 'food', 'business'],
          regulatoryDomain: 'food_registration',
          page: 1,
          effectiveDate: '2024-05-01',
        },
      },
      {
        key: 'zz-chunk-food-s8',
        draft: {
          chunkIndex: 2,
          sectionReference: 'section 8',
          instrumentRole: 'substantive',
          body: 'A licence holder shall keep records of every consignment of prepared food received, and shall retain those records for six years.',
          keywords: ['records', 'keep', 'retain', 'food'],
          regulatoryDomain: 'food_recordkeeping',
          page: 1,
          effectiveDate: '2024-05-01',
        },
      },
    ],
  },
];

/** Every chunk in the corpus, flattened. Order is the ingestion order. */
export const DEMO_ZZ_ALL_CHUNKS: readonly DemoChunkSpec[] = DEMO_ZZ_SOURCES.flatMap(
  (s) => s.chunks,
);

/** Drafts for one instrument, in the shape `ingestSource` expects. */
export function demoZzDraftsFor(manifestId: string): readonly DraftChunkInput[] {
  return (DEMO_ZZ_SOURCES.find((s) => s.manifestId === manifestId)?.chunks ?? []).map(
    (c) => c.draft,
  );
}
