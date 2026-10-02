/**
 * SYNTHETIC fixture — not real regulatory content. See README.md.
 * Reserved agency "Example Regulatory Authority", reserved country code 'ZZ'.
 */

export const SYNTHETIC_PACK_ID = '11111111-1111-4111-8111-111111111111';
export const SYNTHETIC_SOURCE_ID = '22222222-2222-4222-8222-222222222222';
export const SYNTHETIC_KNOWLEDGE_VERSION = 'ZZ-v1.0';

export const syntheticRegistration = {
  knowledgePackId: SYNTHETIC_PACK_ID,
  // Stable manifest key — the amendment chain resolves through this, not the URL.
  manifestId: 'ZZ-WIDGET-ACT-SYNTHETIC',
  agency: 'Example Regulatory Authority',
  title: 'Example Widget Licensing Act (SYNTHETIC — not real legislation)',
  sourceUrl: 'https://example.invalid/widget-licensing-act',
  sourceType: 'act' as const,
  countryCode: 'ZZ',
  region: null,
  municipality: null,
  // primary_legislation ⇒ Authority 5 (K2 §8.1)
  sourceAuthority: 5,
  legalSourceCategory: 'primary_legislation' as const,
  // Mandatory since 20260823000000. Stated, never defaulted.
  freshnessState: 'current' as const,
  // Mandatory since 20260905201714. Explicit legal standing.
  legalStatus: 'in_force' as const,
  publicationDate: '2024-01-15',
  effectiveDate: '2024-03-01',
  expiryDate: null,
  lastReviewedDate: '2026-07-01',
  accessedAt: '2026-08-08T00:00:00.000Z',
  contentMediaType: 'text/html',
};

export const syntheticSourceRow = {
  id: SYNTHETIC_SOURCE_ID,
  knowledge_pack_id: SYNTHETIC_PACK_ID,
  country_code: 'ZZ',
  source_authority: 5 as const,
  legal_source_category: 'primary_legislation' as const,
  agency: 'Example Regulatory Authority',
  title: 'Example Widget Licensing Act (SYNTHETIC — not real legislation)',
  source_url: 'https://example.invalid/widget-licensing-act',
  publication_date: '2024-01-15',
  last_reviewed_date: '2026-07-01',
  accessed_at: '2026-08-08T00:00:00.000Z',
};

export const syntheticDraftChunks = [
  {
    chunkIndex: 0,
    title: 'Example licence requirement',
    body: 'A person carrying on the business of widget assembly in the Example Territory shall hold a current widget licence. (SYNTHETIC PLACEHOLDER TEXT)',
    sectionReference: 'Section 4',
    clause: '4(1)',
    page: 3,
    industry: 'manufacturing',
    regulatoryDomain: 'licensing',
    keywords: ['widget', 'licence'],
    effectiveDate: '2024-03-01',
    instrumentRole: 'substantive' as const,
  },
  {
    chunkIndex: 1,
    title: 'Example renewal period',
    body: 'A widget licence expires twelve months after issue and may be renewed on application. (SYNTHETIC PLACEHOLDER TEXT)',
    sectionReference: 'Section 5',
    clause: '5(2)',
    page: 4,
    industry: 'manufacturing',
    regulatoryDomain: 'licensing',
    keywords: ['renewal'],
    effectiveDate: '2024-03-01',
    instrumentRole: 'substantive' as const,
  },
];
