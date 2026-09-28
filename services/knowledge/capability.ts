import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import { findPublishedPack } from '@/lib/db/knowledge/packs';
import { isUserAssignedCountryCode } from '@/lib/knowledge/jurisdiction';

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
  const label = 'A published Knowledge Pack';

  if (!capability.knowledgePublished) {
    return {
      label,
      met: false,
      detail:
        'Validated regulatory sources for your jurisdiction, each one citable. The sources are ' +
        'identified and verified; publication is pending a legal review of reuse terms.',
    };
  }

  if (capability.syntheticCorpus) {
    return {
      label,
      met: true,
      detail:
        `${capability.knowledgeVersion} is published for this jurisdiction — a SYNTHETIC ` +
        'demonstration corpus. Example Jurisdiction (ZZ) is fictional, and nothing in it is ' +
        'real law or may be used for legal or business decisions.',
    };
  }

  return {
    label,
    met: true,
    detail:
      `${capability.knowledgeVersion} is published for this jurisdiction. Every requirement ` +
      'this surface produces will quote the source it came from.',
  };
}

/** The intake prerequisite, worded identically wherever it appears. */
export function businessProfileStatus(intakeComplete: boolean): {
  label: string;
  detail: string;
  met: boolean;
} {
  return {
    label: 'Your business profile',
    detail: 'The answers from your intake — jurisdiction, industry, stage and size.',
    met: intakeComplete,
  };
}
