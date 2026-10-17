import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { findPublishedPack } from '@/lib/db/knowledge/packs';
import { listSourcesForPack } from '@/lib/db/knowledge/sources';
import type { PublishedSourceSummary } from '@/lib/knowledge/source-display';
import { isUserAssignedCountryCode } from '@/lib/knowledge/jurisdiction';

export type { PublishedSourceSummary } from '@/lib/knowledge/source-display';

/**
 * What Islanda can actually do for a jurisdiction, read from the database.
 *
 * ## Why this exists
 *
 * Four surfaces — Compliance, Timeline, Funding and Documents — each hard-coded
 * this:
 *
 *   { label: 'A published Knowledge Pack',
 *     detail: '… The schema exists; no pack has been published yet.',
 *     met: false }
 *
 * That was true when it was written and stopped being true the moment a pack
 * was published. Four copies of a status literal is four places for the product
 * to make a claim the database contradicts, and this codebase treats an
 * asserted status the same way it treats an asserted legal conclusion: it has
 * to be derived from something, or it is decoration.
 *
 * ⚠ This reads through the REQUEST-SCOPED client, so the jurisdiction Row Level
 *   Security policy applies (migration 20260825000000). A founder is told what
 *   exists *for them*, which is the honest answer and also the only one they
 *   could act on. It is not an admin view of the corpus.
 */

export interface JurisdictionCapability {
  /** ISO 3166-1 alpha-2, from `businesses.country_code`. Never inferred. */
  countryCode: string;
  /** True only when a pack is published AND readable by this caller. */
  knowledgePublished: boolean;
  /** e.g. `'ZZ-v0.1'`. Null when nothing is published for this jurisdiction. */
  knowledgeVersion: string | null;
  /**
   * True when the jurisdiction is an ISO 3166-1 user-assigned code — a reserved
   * range no real country can hold, which this project uses for synthetic
   * demonstration corpora. Carried so no surface can display a pack without
   * being able to say what kind of pack it is.
   */
  syntheticCorpus: boolean;
}

/** No business selected: nothing can be said about a jurisdiction we do not have. */
export const NO_JURISDICTION: JurisdictionCapability = Object.freeze({
  countryCode: '',
  knowledgePublished: false,
  knowledgeVersion: null,
  syntheticCorpus: false,
});

export async function getJurisdictionCapability(
  db: SupabaseClient<Database>,
  countryCode: string | null | undefined,
): Promise<JurisdictionCapability> {
  if (!countryCode) return NO_JURISDICTION;

  const pack = await findPublishedPack(db, countryCode);

  return {
    countryCode,
    knowledgePublished: pack !== null,
    knowledgeVersion: pack?.version ?? null,
    syntheticCorpus: isUserAssignedCountryCode(countryCode),
  };
}

/**
 * The founder-facing description of the Knowledge Pack prerequisite.
 *
 * Returned as plain data rather than as a component so that `services/` states
 * no opinion about presentation — the layer rules run `app/ → services/`, never
 * the other way.
 *
 * ⚠ Every branch below is a statement of fact about the corpus, and none of
 *   them describes any law. Where a pack is synthetic the copy says so
 *   unconditionally: a demonstration corpus that a reader could mistake for
 *   regulatory guidance is the one failure this whole labelling apparatus
 *   exists to prevent.
 */
export function knowledgePackStatus(capability: JurisdictionCapability): {
  label: string;
  detail: string;
  met: boolean;
} {
  const label = 'Official documents for your country';

  if (!capability.knowledgePublished) {
    return {
      label,
      met: false,
      detail:
        'Islanda does not hold checked official documents for your country yet. They are ' +
        'identified; publishing them is waiting on a legal review of how they may be reused.',
    };
  }

  if (capability.syntheticCorpus) {
    return {
      label,
      met: true,
      detail:
        `${capability.knowledgeVersion} is published for this country — a SYNTHETIC ` +
        'demonstration set. Example Jurisdiction (ZZ) is fictional, and nothing in it is ' +
        'real law or may be used for legal or business decisions.',
    };
  }

  return {
    label,
    met: true,
    detail:
      `Islanda holds official documents for your country (${capability.knowledgeVersion}). ` +
      'Anything this page shows will quote the document it came from.',
  };
}

/** The intake prerequisite, worded identically wherever it appears. */
export function businessProfileStatus(intakeComplete: boolean): {
  label: string;
  detail: string;
  met: boolean;
} {
  return {
    label: 'Your business details',
    detail:
      'Your answers to the five questions: what the business does, its stage, team and goals.',
    met: intakeComplete,
  };
}

/**
 * The documents Nova can search for a jurisdiction — read, never inferred.
 *
 * Reads through the caller's RLS-scoped client, so it returns only sources in
 * a published pack for a jurisdiction the caller holds a business in (policy
 * `knowledge_sources_read_published_in_jurisdiction`). Empty when nothing is
 * published, which the caller renders as "nothing to search yet" rather than
 * as a list of zero.
 */
export async function listPublishedSources(
  db: SupabaseClient<Database>,
  countryCode: string | null | undefined,
): Promise<PublishedSourceSummary[]> {
  if (!countryCode) return [];
  const pack = await findPublishedPack(db, countryCode);
  if (!pack) return [];
  const sources = await listSourcesForPack(db, pack.id);
  return sources.map((s) => ({
    title: s.title,
    agency: s.agency,
    sourceUrl: s.source_url,
    effectiveDate: s.effective_date,
    legalStatus: s.legal_status,
  }));
}
