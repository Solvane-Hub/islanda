import type { SourceManifest } from '@/services/knowledge/manifests/types';

/**
 * Bahamas Knowledge Pack BS-v0.1 — source manifest.
 *
 * Six instruments, all Authority 5, all gazetted, all verified against primary
 * sources on 2026-08-23. The full discovery record, including the sources that
 * were examined and EXCLUDED, is in
 * `docs/knowledge/bahamas-vat-source-manifest.md` v3.0.
 *
 * ⚠ **NOT PUBLISHED, AND NOT PUBLISHABLE YET.** Open question G11: the official
 *   legislation site states "Legislation can be downloaded and printed for
 *   private use. Any commercial entity is required to obtain permission to reuse
 *   the data". That is an unresolved commercial-reuse restriction on the primary
 *   legal source. It is a hard gate on publication and on founder exposure.
 *
 * ⚠ **No synthetic consolidation.** Each instrument is independent. The
 *   amendment relationships below are metadata; no text is merged anywhere.
 *
 * Excluded from this manifest and never to be added:
 *   • Value Added Tax (Amendment) Bill, 2026 — became No. 4 of 2026
 *   • Value Added Tax (Amendment) (No. 2) Bill, 2026 — still a Bill
 *   • VAT (Amendment) Bill 2025, VAT Amendment Bill 2024, VAT-FREE-SHOPPING draft
 *   • the 2015–2018 Comptroller's Rules (legal classification unresolved, G7)
 *   • spent transitional rules quoting the retiring 7.5% rate
 */

const DIR = 'https://inlandrevenue.finance.gov.bs/wp-content/uploads';
const LAWS = 'https://laws.bahamas.gov.bs/cms/images/LEGISLATION';

/** Ch. 370A base text. */
const VAT_ACT = 'BS-VAT-ACT-CH370A-REPRINT-2024';
/** No. 3 of 2025. */
const VAT_AMD_2025_1 = 'BS-VAT-AMD-2025-NO3';
/** No. 45 of 2025. */
const VAT_AMD_2025_2 = 'BS-VAT-AMD-2025-NO45';
/** No. 4 of 2026. */
const VAT_AMD_2026_1 = 'BS-VAT-AMD-2026-NO4';
/** No. 2 Act of 2026 (record 2026-0019). */
const VAT_AMD_2026_2 = 'BS-VAT-AMD-2026-NO19';
/** Ch. 324A, No. 3 of 2003. */
const DPA_CH324A = 'BS-DPA-CH324A-2003';
/** No. 74 of 2025. */
const DPA_2025 = 'BS-DPA-2025-NO74';

export const BAHAMAS_MANIFEST: SourceManifest = {
  knowledgeVersion: 'BS-v0.1',
  countryCode: 'BS',
  scope:
    'Value Added Tax (Chapter 370A) and its enacted amendments through 2026, plus the ' +
    'operative data-protection statute and its enacted-but-uncommenced successor.',

  entries: [
    // ── Chapter 370A — base text ─────────────────────────────────────────
    {
      manifestId: VAT_ACT,
      suppliedUrl: `${DIR}/2024/11/Value-Added-Tax-Act.pdf`,
      canonicalUrl: `${DIR}/2024/11/Value-Added-Tax-Act.pdf`,
      fetchStatus: 'fetched',
      textLayerPresent: true,

      countryCode: 'BS',
      agency: 'Government of The Bahamas',
      title: 'Value Added Tax Act (Reprint), Chapter 370A',
      sourceType: 'act',
      legalSourceCategory: 'primary_legislation',
      sourceAuthority: 5,
      // Consolidated as at 2024-07-01 and amended three times since. Its text is
      // NOT the current law, so it must not assert currency.
      freshnessState: 'changed_pending_assessment',

      actNumber: null,
      chapter: 'Ch. 370A',
      gazettedOn: '2024-11-04',
      assentedOn: null,
      commencementDate: null,
      varyingCommencement: [],
      consolidatedAsAt: '2024-07-01',
      legalStatus: 'base_text_amended',

      amends: null,
      amendedProvisions: [],
      repeals: null,
      amendedBy: [VAT_AMD_2025_1, VAT_AMD_2025_2, VAT_AMD_2026_1, VAT_AMD_2026_2],
      repealedBy: null,

      statusEvidence: [
        {
          quote: 'Value Added Tax Act (Reprint)',
          locator: 'Gazette front matter',
        },
        { quote: 'CHAPTER 370A', locator: 'Title page' },
        { quote: 'Reprinted as at 1st July, 2024', locator: 'Page footer, every page' },
        {
          quote:
            'EXTRAORDINARY OFFICIAL GAZETTE THE BAHAMAS PUBLISHED BY AUTHORITY 4th NASSAU November, 2024',
          locator: 'Gazette masthead',
        },
      ],
      humanReviewRequired: true,
      reviewNotes: [
        'G2: the amendment chain is verified for three Acts but not proven exhaustive.',
        'G3: Value Added Tax (Amendment) Act 2024 — determine whether it falls inside or ' +
          'outside the 2024-07-01 consolidation.',
        'G5: confirm no VAT reprint later than 2024-11-04 exists.',
      ],
    },

    // ── No. 3 of 2025 ────────────────────────────────────────────────────
    {
      manifestId: VAT_AMD_2025_1,
      suppliedUrl: `${DIR}/2025/07/VALUE-ADDED-TAX-AMENDMENT-ACT-2025.pdf`,
      canonicalUrl: `${DIR}/2025/07/VALUE-ADDED-TAX-AMENDMENT-ACT-2025.pdf`,
      fetchStatus: 'fetched',
      textLayerPresent: true,

      countryCode: 'BS',
      agency: 'Government of The Bahamas',
      title: 'Value Added Tax (Amendment) Act, 2025',
      sourceType: 'act',
      legalSourceCategory: 'primary_legislation',
      sourceAuthority: 5,
      freshnessState: 'current',

      actNumber: 'No. 3 of 2025',
      chapter: null,
      gazettedOn: '2025-03-31',
      assentedOn: '2025-03-31',
      commencementDate: '2025-04-01',
      varyingCommencement: [],
      consolidatedAsAt: null,
      legalStatus: 'in_force',

      amends: VAT_ACT,
      amendedProvisions: [
        'section 2',
        'section 6',
        'section 13',
        'section 52',
        'section 71',
        'section 96A',
        'Fourth Schedule',
      ],
      repeals: null,
      amendedBy: [],
      repealedBy: null,

      statusEvidence: [
        { quote: 'No. 3 of 2025', locator: 'Act number block' },
        { quote: '[Date of Assent 31st March 2025]', locator: 'Assent block' },
        {
          quote: '(2) This Act shall come into operation on the 1st day of April, 2025.',
          locator: 'section 1(2)',
        },
        {
          quote:
            'This Act, which amends the Value Added Tax Act, 2014 (Ch. 370A), shall be cited as the Value Added Tax (Amendment) Act, 2025.',
          locator: 'section 1(1)',
        },
      ],
      humanReviewRequired: true,
      reviewNotes: [
        'G1: confirm no later commencement order varies this Act.',
        'Section 6 is "Rates of tax" — also amended by No. 4 of 2026, so this provision has a ' +
          'three-layer chain.',
        'Inserts the Fourth Schedule, which does not exist in the 2024-07-01 reprint at all.',
      ],
    },

    // ── No. 45 of 2025 ───────────────────────────────────────────────────
    {
      manifestId: VAT_AMD_2025_2,
      suppliedUrl: `${DIR}/2025/07/VALUE-ADDED-TAX-AMENDMENT-NO.2-ACT-2025-.pdf`,
      canonicalUrl: `${DIR}/2025/07/VALUE-ADDED-TAX-AMENDMENT-NO.2-ACT-2025-.pdf`,
      fetchStatus: 'fetched',
      textLayerPresent: true,

      countryCode: 'BS',
      agency: 'Government of The Bahamas',
      title: 'Value Added Tax (Amendment) (No. 2) Act, 2025',
      sourceType: 'act',
      legalSourceCategory: 'primary_legislation',
      sourceAuthority: 5,
      freshnessState: 'current',

      actNumber: 'No. 45 of 2025',
      chapter: null,
      gazettedOn: '2025-07-01',
      assentedOn: '2025-06-27',
      commencementDate: '2025-07-01',
      varyingCommencement: [{ provision: 'section 22(f)', commencementDate: '2025-09-01' }],
      consolidatedAsAt: null,
      legalStatus: 'in_force',

      amends: VAT_ACT,
      amendedProvisions: [
        'section 2',
        'section 18',
        'section 19',
        'section 22A',
        'section 27',
        'section 38C',
        'section 38K',
        'section 47A',
        'section 47B',
        'section 47C',
        'section 50',
        'section 56',
        'section 56A',
        'section 57',
        'section 58',
        'section 61B',
        'section 81',
        'section 81A',
        'First Schedule',
        'Third Schedule',
        'Fourth Schedule',
      ],
      repeals: null,
      amendedBy: [],
      repealedBy: null,

      statusEvidence: [
        { quote: 'No. 45 of 2025', locator: 'Act number block' },
        { quote: '[Date of Assent 27th June, 2025]', locator: 'Assent block' },
        {
          quote:
            '(2) Subject to subsection (3), this Act shall come into operation on the 1st day of July, 2025.',
          locator: 'section 1(2)',
        },
        {
          quote:
            '(3) Section 22(f) of this Act shall come into operation on the 1st day of September, 2025.',
          locator: 'section 1(3)',
        },
      ],
      humanReviewRequired: true,
      reviewNotes: [
        'G1: confirm no later commencement order varies this Act.',
        'REPEALS AND REPLACES sections 56, 61B and 81A. The reprint text of those sections is ' +
          'repealed law and must never be presented as operative.',
        'Sections 38K, 47C and 56A are INSERTED — they do not exist in the reprint.',
        'Split commencement: section 22(f) from 2025-09-01.',
      ],
    },

    // ── No. 4 of 2026 ────────────────────────────────────────────────────
    {
      manifestId: VAT_AMD_2026_1,
      suppliedUrl: `${LAWS}/AMENDING/2026/2026-0004A/2026-0004A.pdf`,
      canonicalUrl: `${LAWS}/AMENDING/2026/2026-0004A/2026-0004A.pdf`,
      fetchStatus: 'fetched',
      textLayerPresent: true,

      countryCode: 'BS',
      agency: 'Government of The Bahamas',
      title: 'Value Added Tax (Amendment) Act, 2026',
      sourceType: 'act',
      legalSourceCategory: 'primary_legislation',
      sourceAuthority: 5,
      freshnessState: 'current',

      actNumber: 'No. 4 of 2026',
      chapter: null,
      gazettedOn: '2026-03-23',
      assentedOn: '2026-03-23',
      commencementDate: '2026-04-01',
      varyingCommencement: [],
      consolidatedAsAt: null,
      legalStatus: 'in_force',

      amends: VAT_ACT,
      amendedProvisions: ['section 6', 'Second Schedule', 'Fourth Schedule'],
      repeals: null,
      amendedBy: [],
      repealedBy: null,

      statusEvidence: [
        { quote: 'No.4 of 2026', locator: 'Act number block' },
        { quote: '[Date of Assent - 23rd March, 2026]', locator: 'Assent block' },
        {
          quote: '(2) This Act shall come into operation on the 1st day of April, 2026.',
          locator: 'section 1(2)',
        },
        {
          quote:
            'AN ACT TO AMEND THE VALUE ADDED TAX ACT TO EXEMPT QUALIFYING UNPREPARED FOOD ITEMS AND CERTAIN IMPORTED GOODS FROM VALUE ADDED TAX, AND FOR CONNECTED PURPOSES',
          locator: 'Long title',
        },
        {
          quote:
            'EXTRAORDINARY OFFICIAL GAZETTE THE BAHAMAS PUBLISHED BY AUTHORITY NASSAU 23rd March, 2026',
          locator: 'Gazette masthead',
        },
      ],
      humanReviewRequired: true,
      reviewNotes: [
        'Sourced from laws.bahamas.gov.bs, NOT from the Department of Inland Revenue page, ' +
          'which still shows only the Bill. Agency pages are not authoritative for legal status.',
        'The record key is the full namespaced path AMENDING/2026/2026-0004A. A bare "2026-0004" ' +
          'resolves in the BILLS namespace to the National Youth Commission Bill, 2026.',
        'Exempts qualifying unprepared food items — directly material to food businesses.',
        'G1: confirm no later commencement order varies this Act.',
      ],
    },

    // ── No. 2 Act of 2026 (record 2026-0019) — freshness ingest ──────────
    {
      manifestId: VAT_AMD_2026_2,
      suppliedUrl: `${LAWS}/AMENDING/2026/2026-0019A/2026-0019A.pdf`,
      canonicalUrl: `${LAWS}/AMENDING/2026/2026-0019A/2026-0019A.pdf`,
      fetchStatus: 'fetched',
      textLayerPresent: true,

      countryCode: 'BS',
      agency: 'Government of The Bahamas',
      title: 'Value Added Tax (Amendment) (No. 2) Act, 2026',
      sourceType: 'act',
      legalSourceCategory: 'primary_legislation',
      sourceAuthority: 5,
      freshnessState: 'current',

      actNumber: 'No. 2 Act of 2026',
      chapter: null,
      gazettedOn: '2026-06-30',
      assentedOn: '2026-06-30',
      // General commencement 1 July 2026 (in force). Clause 4 (Second Schedule)
      // has a SEPARATE appointed-day commencement not yet fixed — see reviewNotes;
      // it is not recorded here because no date has been appointed and none may be
      // fabricated.
      commencementDate: '2026-07-01',
      varyingCommencement: [],
      consolidatedAsAt: null,
      legalStatus: 'in_force',

      amends: VAT_ACT,
      amendedProvisions: ['section 23A', 'section 56', 'Second Schedule', 'Third Schedule'],
      repeals: null,
      amendedBy: [],
      repealedBy: null,

      statusEvidence: [
        { quote: 'VALUE ADDED TAX (AMENDMENT) (NO. 2) ACT, 2026', locator: 'Long title' },
        { quote: '[Date of Assent - 30th June, 2026]', locator: 'Assent block' },
        {
          quote:
            '(2) Subject to subsection (3), this Act shall come into force on the 1st day of July, 2026.',
          locator: 'section 1(2)',
        },
        {
          quote:
            '(3) Clause 4 of this Act shall come into force on such date as the Minister may appoint by notice published in the Gazette.',
          locator: 'section 1(3)',
        },
        {
          quote:
            'The Third Schedule to the principal Act is amended in item (3), by the deletion of the figure “$500,000” and the substitution of the figure “$600,000”.',
          locator: 'section 5',
        },
      ],
      humanReviewRequired: true,
      reviewNotes: [
        'FRESHNESS: found during a currentness check against laws.bahamas.gov.bs; it was absent ' +
          'from the first corpus. Raises the VAT registration threshold from $500,000 to $600,000 ' +
          '(Third Schedule item 3), in force 1 July 2026 — the reprint still shows $500,000, so the ' +
          'corpus was materially stale without this Act.',
        'Split commencement: the Act is in force from 2026-07-01 EXCEPT clause 4 (Second Schedule, ' +
          'Part I Exempt Supplies), which commences on an appointed day the Minister has not yet ' +
          'fixed. The section-4 amendment must NOT be presented as current law until that day; ' +
          'it is held for human review rather than recorded with a fabricated date.',
        'Amends sections 23A and 56 (both present in the reprint) and the Second and Third Schedules.',
      ],
    },

    // ── Data Protection — Ch. 324A ───────────────────────────────────────
    {
      manifestId: DPA_CH324A,
      suppliedUrl: `${LAWS}/PRINCIPAL/2003/2003-0003/2003-0003.pdf?zoom_highlight=WA+0812+2782+5310+Jasa+Pembangunan+Neon+Box+Akrilik+1+Sisi+Terpercaya+Kismantoro+Wonogiri&utm_source=chatgpt.com`,
      // Query string stripped: it is injected tracking and spam, not provenance.
      canonicalUrl: `${LAWS}/PRINCIPAL/2003/2003-0003/2003-0003.pdf`,
      fetchStatus: 'fetched',
      textLayerPresent: true,

      countryCode: 'BS',
      agency: 'Government of The Bahamas',
      title: 'Data Protection (Privacy of Personal Information) Act, Chapter 324A',
      sourceType: 'act',
      legalSourceCategory: 'primary_legislation',
      sourceAuthority: 5,
      // Operative, but its repeal is enacted and awaiting an appointed day.
      freshnessState: 'review_due',

      actNumber: 'No. 3 of 2003',
      chapter: 'Ch. 324A',
      gazettedOn: null,
      assentedOn: null,
      // In force; the LRO consolidation does not restate the original date.
      commencementDate: '2003-01-01',
      varyingCommencement: [],
      consolidatedAsAt: '2008-01-01',
      legalStatus: 'in_force',

      amends: null,
      amendedProvisions: [],
      repeals: null,
      amendedBy: [],
      repealedBy: DPA_2025,

      statusEvidence: [
        { quote: 'CHAPTER 324A', locator: 'Title page' },
        { quote: 'LRO 1/2008 STATUTE LAW OF THE BAHAMAS', locator: 'Page header' },
        {
          quote:
            '"repealed Act" means the Data Protection (Privacy of Personal Information) Act (Ch. 324A);',
          locator: 'Data Protection Act 2025, section 2 (Interpretation)',
        },
        {
          quote: 'Data Protection Act, 2025',
          locator: 'laws.bahamas.gov.bs — Acts > Not in Force (Principal)',
        },
      ],
      humanReviewRequired: true,
      reviewNotes: [
        'G4/G6 🔴: commencementDate and consolidatedAsAt are ENGINEERING PLACEHOLDERS derived ' +
          'from the LRO year, not stated in the document. They must be corrected from the ' +
          'original 2003 enactment before ingestion.',
        'Operative only because No. 74 of 2025 has not been commenced. If an Appointed Day ' +
          'Notice has been gazetted since the register page was built, this entry becomes ' +
          'repealed and must be withdrawn from the pack.',
      ],
    },

    // ── Data Protection Act, 2025 ────────────────────────────────────────
    {
      manifestId: DPA_2025,
      suppliedUrl: `${LAWS}/PRINCIPAL/2025/2025-0074/2025-0074_1.pdf`,
      canonicalUrl: `${LAWS}/PRINCIPAL/2025/2025-0074/2025-0074_1.pdf`,
      fetchStatus: 'fetched',
      textLayerPresent: true,

      countryCode: 'BS',
      agency: 'Government of The Bahamas',
      title: 'Data Protection Act, 2025',
      sourceType: 'act',
      legalSourceCategory: 'primary_legislation',
      sourceAuthority: 5,
      // Enacted, not commenced. Must never assert currency.
      freshnessState: 'changed_pending_assessment',

      actNumber: 'No. 74 of 2025',
      chapter: null,
      gazettedOn: '2025-12-11',
      assentedOn: '2025-12-09',
      commencementDate: null,
      varyingCommencement: [],
      consolidatedAsAt: null,
      legalStatus: 'enacted_not_in_force',

      amends: null,
      amendedProvisions: [],
      repeals: DPA_CH324A,
      amendedBy: [],
      repealedBy: null,

      statusEvidence: [
        { quote: 'No. 74 of 2025', locator: 'Act number block' },
        { quote: '[Date of Assent - 9th December, 2025]', locator: 'Assent block' },
        {
          quote: '(2) This Act shall come into operation on the date as the Minister may appoint',
          locator: 'section 1(2)',
        },
        {
          quote:
            'SUPPLEMENT PART I OFFICIAL GAZETTE THE BAHAMAS PUBLISHED BY AUTHORITY NASSAU 11th December, 2025 No. 50',
          locator: 'Gazette masthead',
        },
        {
          quote: 'Data Protection Act, 2025',
          locator: 'laws.bahamas.gov.bs — Acts > Not in Force (Principal)',
        },
      ],
      humanReviewRequired: true,
      reviewNotes: [
        'INCLUDED DELIBERATELY, though not current law: it is the reason Ch. 324A is still ' +
          'operative, and a founder asking about data protection deserves to know a successor ' +
          'exists and has not commenced.',
        'G4 🔴: search Gazette commencement notices from 2025-12-11 to date for an Appointed ' +
          'Day Notice. If one exists, this becomes in_force and Ch. 324A becomes repealed.',
        'Repeals Ch. 324A on commencement — see section 101, "Repeal of No. 3 of 2003".',
      ],
    },
  ],
};
