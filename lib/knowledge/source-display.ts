import { CURRENT_LAW_LEGAL_STATUSES, type KnowledgeSourceLegalStatus } from '@/types/knowledge';

/**
 * A source's legal standing, in words a business owner can act on.
 *
 * Mirrors the retrieval filter rather than restating it: anything outside
 * `CURRENT_LAW_LEGAL_STATUSES` is excluded from answers as current law
 * (services/nova/retrieval.ts), and its label says so.
 */
export function sourceStandingLabel(status: KnowledgeSourceLegalStatus): string {
  switch (status) {
    case 'in_force':
      return 'In force';
    case 'base_text_amended':
      return 'In force, with later amendments';
    case 'enacted_not_in_force':
      return 'Passed but not yet in force, so not used as current law';
    case 'repealed':
    case 'spent':
    case 'superseded':
      return 'No longer in force, so not used as current law';
    default:
      return 'Standing not confirmed, so not used as current law';
  }
}

export function isUsedAsCurrentLaw(status: KnowledgeSourceLegalStatus): boolean {
  return CURRENT_LAW_LEGAL_STATUSES.includes(status);
}

/** One source document in a published Knowledge Pack, as a founder can see it. */
export interface PublishedSourceSummary {
  title: string;
  agency: string;
  sourceUrl: string | null;
  effectiveDate: string | null;
  legalStatus: KnowledgeSourceLegalStatus;
}
