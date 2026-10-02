import type {
  KnowledgeFreshnessState,
  KnowledgeSourceLegalStatus,
  KnowledgeSourceType,
  LegalSourceCategory,
  SourceAuthority,
} from '@/types/knowledge';
import { AUTHORITY_BY_CATEGORY } from '@/types/knowledge';
import { parseProvision, provisionMatches } from '@/lib/knowledge/provision';

/**
 * Knowledge Pack source manifests — the ingestion input, and the system of
 * record for legal chronology in v0.1.
 *
 * ⚠ A manifest is NOT a second knowledge system. It carries no legal text and
 *   no chunks. It is the typed, in-Git description of which instruments make up
 *   a pack, what their verified legal standing is, and how they relate — the
 *   information `registerSourceSchema` needs plus the amendment relationships
 *   the database does not yet model (see `docs/knowledge/bahamas-vat-source-manifest.md`
 *   gap 4).
 *
 * Why in Git rather than in the database: this is reference data whose accuracy
 * is a reviewed, versioned engineering artifact, exactly as prompts are
 * (Prompt Engineering Standard P1). A legal-status assertion that could be
 * edited in a database console without review is not one we could stand behind.
 *
 * ⚠ **No synthetic consolidation.** Each instrument stays independent. The
 *   manifest records that instrument B amends provision X of instrument A; it
 *   never merges their texts. A merged statute would be legal text no gazette
 *   ever published, and every chunk of it would be uncitable.
 */

/**
 * Verified standing of an instrument. Deliberately narrower than "is it good".
 *
 * `unknown` is a first-class value and the correct answer whenever status has
 * not been established from a primary source. It is not a placeholder to be
 * tidied away.
 */
export type LegalStatus =
  /** In force, and its own text or the register establishes the date. */
  | 'in_force'
  /** Passed and assented, commencement not yet triggered. Not law yet. */
  | 'enacted_not_in_force'
  /** In force, but later instruments amend it — cannot be quoted alone as current. */
  | 'base_text_amended'
  /** Expired by its own terms. */
  | 'spent'
  /** Replaced by a later instrument. */
  | 'superseded'
  /** Repealed and no longer operative. */
  | 'repealed'
  /** A Bill, a draft, or anything else that is not law. MUST NOT be ingested. */
  | 'not_law'
  /** Not established from a primary source. */
  | 'unknown';

/** Where the document text stands, for planning the acquisition step. */
export type ManifestFetchStatus = 'fetched' | 'fetch_required' | 'ocr_required' | 'fetch_failed';

/**
 * A quotation that evidences a metadata assertion.
 *
 * The manifest asserts things like "assented 27 June 2025". Those assertions
 * carry the same obligation as any other claim the platform makes: they must be
 * traceable to the document. This is how the metadata itself is auditable.
 */
export interface StatusEvidence {
  /** Verbatim, from the instrument or an official register page. */
  quote: string;
  /** Where in the document or which index page. */
  locator: string;
}

/** A provision-level commencement that differs from the instrument's general date. */
export interface VaryingCommencement {
  /** e.g. 'section 22(f)' */
  provision: string;
  /** ISO date. */
  commencementDate: string;
}

export interface SourceManifestEntry {
  /** Stable local key. Referenced by `amends` / `repeals`. Never a bare year-number. */
  manifestId: string;

  // ── Acquisition ────────────────────────────────────────────────────────
  /** Exactly as supplied, tracking parameters and all. Provenance of the request. */
  suppliedUrl: string;
  /** What the fetcher uses. Query strings stripped. Joins to `knowledge_sources.source_url`. */
  canonicalUrl: string;
  fetchStatus: ManifestFetchStatus;
  /** False means OCR is required before this source can produce chunks. */
  textLayerPresent: boolean;

  // ── registerSourceSchema inputs ────────────────────────────────────────
  /**
   * ISO 3166-1 alpha-2.
   *
   * Not narrowed to a literal: CLAUDE.md forbids hard-coding country-specific
   * assumptions outside the Knowledge Pack, and a manifest type that only
   * admits one country is exactly that.
   */
  countryCode: string;
  agency: string;
  title: string;
  sourceType: KnowledgeSourceType;
  legalSourceCategory: LegalSourceCategory;
  sourceAuthority: SourceAuthority;
  /** MANDATORY. Never defaulted. See the 20260823000000 migration. */
  freshnessState: KnowledgeFreshnessState;

  // ── Legal identity and chronology ──────────────────────────────────────
  /** e.g. 'No. 45 of 2025'. Null where the instrument has no Act number. */
  actNumber: string | null;
  /** e.g. 'Ch. 370A'. */
  chapter: string | null;
  /** Gazette publication date, ISO. */
  gazettedOn: string | null;
  assentedOn: string | null;
  commencementDate: string | null;
  /** Provisions commencing on a different date from the instrument's general date. */
  varyingCommencement: readonly VaryingCommencement[];
  /** For a consolidated reprint: the date the consolidation is stated to be current to. */
  consolidatedAsAt: string | null;
  legalStatus: LegalStatus;

  // ── Relationships. Metadata only — texts are never merged. ─────────────
  /** manifestId of the instrument this one amends. */
  amends: string | null;
  /**
   * Provisions of the amended instrument that this one touches.
   *
   * Written as display references — `'section 56'`, `'Second Schedule'` — and
   * canonicalised by `lib/knowledge/provision.ts` before any comparison.
   * `assertManifestValid` rejects any entry whose reference cannot be parsed,
   * so an unparseable provision is a build-time failure rather than a silent
   * non-match at query time.
   */
  amendedProvisions: readonly string[];
  /** manifestId of an instrument this one repeals. */
  repeals: string | null;
  /** manifestIds of instruments that amend this one. */
  amendedBy: readonly string[];
  /** manifestId of an instrument that repeals this one, whether commenced or not. */
  repealedBy: string | null;

  // ── Review ─────────────────────────────────────────────────────────────
  statusEvidence: readonly StatusEvidence[];
  humanReviewRequired: boolean;
  reviewNotes: readonly string[];
}

export interface SourceManifest {
  /** Target pack version, e.g. 'BS-v0.1'. */
  knowledgeVersion: string;
  /** ISO 3166-1 alpha-2. See the note on `SourceManifestEntry.countryCode`. */
  countryCode: string;
  /** Free text describing what this pack is scoped to cover. */
  scope: string;
  entries: readonly SourceManifestEntry[];
}

export class ManifestIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ManifestIntegrityError';
  }
}

/** Statuses under which an instrument may be ingested at all. */
const INGESTIBLE: readonly LegalStatus[] = [
  'in_force',
  'base_text_amended',
  'enacted_not_in_force',
];

/**
 * Statuses that permit `freshness_state = 'current'`.
 *
 * The rule this encodes: **a source whose standing is not established, or which
 * is known to be amended or not yet commenced, may never assert currency.**
 */
const MAY_CLAIM_CURRENT: readonly LegalStatus[] = ['in_force'];

/**
 * Validate a manifest before it is used to register anything.
 *
 * Fails closed, mirroring `assertRetrievalResultValid` and `assertEnvelopeValid`.
 * Every rule here is a corpus-integrity rule, not a style preference.
 */
export function assertManifestValid(manifest: SourceManifest): void {
  const ids = new Set<string>();

  for (const e of manifest.entries) {
    const where = `manifest entry "${e.manifestId}"`;

    if (!e.manifestId) {
      throw new ManifestIntegrityError('A manifest entry has no manifestId.');
    }
    if (ids.has(e.manifestId)) {
      throw new ManifestIntegrityError(`Duplicate manifestId "${e.manifestId}".`);
    }
    ids.add(e.manifestId);

    // A Bill or draft must never reach registration. This is the single most
    // important rule in the file: bills are never binding law.
    if (!INGESTIBLE.includes(e.legalStatus)) {
      throw new ManifestIntegrityError(
        `${where} has legalStatus "${e.legalStatus}" and must not appear in an ingestion manifest. ` +
          'Bills, drafts, spent, superseded and repealed instruments are excluded, and an ' +
          'instrument of unknown status cannot be represented as law.',
      );
    }

    // The rule the whole freshness fix exists to enforce.
    if (e.freshnessState === 'current' && !MAY_CLAIM_CURRENT.includes(e.legalStatus)) {
      throw new ManifestIntegrityError(
        `${where} claims freshness "current" with legalStatus "${e.legalStatus}". ` +
          'Only an instrument established as in force may assert currency.',
      );
    }

    // K2 §8.1 — authority is derived from the document's legal category.
    if (
      !(AUTHORITY_BY_CATEGORY[e.legalSourceCategory] as readonly number[]).includes(
        e.sourceAuthority,
      )
    ) {
      throw new ManifestIntegrityError(
        `${where}: Source Authority ${e.sourceAuthority} is not derivable from category ` +
          `"${e.legalSourceCategory}" (K2 §8.1). Authority is a property of the document, ` +
          'not the publisher.',
      );
    }

    // An instrument in force must say when. Otherwise "in force" is an assertion
    // with nothing behind it.
    if (e.legalStatus === 'in_force' && !e.commencementDate) {
      throw new ManifestIntegrityError(
        `${where} is marked in force but records no commencement date.`,
      );
    }

    // Enacted-but-not-commenced means exactly that: assented, no commencement.
    if (e.legalStatus === 'enacted_not_in_force') {
      if (!e.assentedOn) {
        throw new ManifestIntegrityError(
          `${where} is marked enacted but records no date of assent.`,
        );
      }
      if (e.commencementDate) {
        throw new ManifestIntegrityError(
          `${where} is marked not in force yet records a commencement date of ` +
            `${e.commencementDate}. If it has commenced, its status is in_force.`,
        );
      }
    }

    // A consolidation that is known to be amended cannot be marked in force,
    // because its text is not the current law.
    if (e.amendedBy.length > 0 && e.legalStatus === 'in_force') {
      throw new ManifestIntegrityError(
        `${where} is amended by ${e.amendedBy.length} instrument(s) but is marked in_force. ` +
          'Use base_text_amended — its text alone is not the current law.',
      );
    }

    // Every status assertion must be traceable to a document (K2 §4.4).
    if (e.statusEvidence.length === 0) {
      throw new ManifestIntegrityError(
        `${where} asserts a legal status with no supporting quotation. ` +
          'A status nobody can re-check is not established.',
      );
    }

    // A source that cannot yield text cannot yield chunks, and a source with no
    // chunks fails the K7 §6 quality gate anyway. Catch it here, earlier.
    if (!e.textLayerPresent || e.fetchStatus === 'ocr_required') {
      throw new ManifestIntegrityError(
        `${where} has no text layer and requires OCR, which does not exist in this codebase. ` +
          'It cannot produce chunks and must be removed from the manifest until OCR is available.',
      );
    }
  }

  // Relationship integrity — dangling references would silently break the
  // amendment chain the Assistant Service depends on.
  for (const e of manifest.entries) {
    const refs: readonly (readonly [string, string | null])[] = [
      ['amends', e.amends],
      ['repeals', e.repeals],
      ['repealedBy', e.repealedBy],
    ];
    for (const [field, target] of refs) {
      if (target && !ids.has(target)) {
        throw new ManifestIntegrityError(
          `manifest entry "${e.manifestId}" field ${field} references unknown entry "${target}".`,
        );
      }
      if (target === e.manifestId) {
        throw new ManifestIntegrityError(
          `manifest entry "${e.manifestId}" field ${field} references itself.`,
        );
      }
    }
    for (const target of e.amendedBy) {
      if (!ids.has(target)) {
        throw new ManifestIntegrityError(
          `manifest entry "${e.manifestId}" is amendedBy unknown entry "${target}".`,
        );
      }
    }
    // An amending instrument must say what it amends.
    if (e.amends && e.amendedProvisions.length === 0) {
      throw new ManifestIntegrityError(
        `manifest entry "${e.manifestId}" amends "${e.amends}" but names no amended provisions.`,
      );
    }

    // Every amended provision must canonicalise. An unparseable reference would
    // match nothing at query time and would be indistinguishable from an
    // instrument that amends nothing — a silent, unsafe failure. Catch it here,
    // where it is a build error.
    for (const p of e.amendedProvisions) {
      if (parseProvision(p) === null) {
        throw new ManifestIntegrityError(
          `manifest entry "${e.manifestId}" names amended provision "${p}", which cannot be ` +
            'parsed into a canonical identifier. It would silently match nothing.',
        );
      }
    }
  }
}

/**
 * Instruments amending a given provision of `baseManifestId`.
 *
 * Matching is on CANONICAL provision identity, not display strings. That is
 * what makes `'Section 56'`, `'section 56'` and `'s. 56'` the same provision,
 * `'s.56(1)'` part of `'s.56'`, and `'s.56A'` a different provision entirely.
 *
 * An unparseable `provision` argument matches nothing — callers must treat that
 * as "unknown provision", never as "no amendments". `assertManifestValid` has
 * already guaranteed the manifest side parses.
 */
export function amendmentsForProvision(
  manifest: SourceManifest,
  baseManifestId: string,
  provision: string | null | undefined,
): readonly SourceManifestEntry[] {
  const target = parseProvision(provision);
  if (!target) return [];

  return manifest.entries
    .filter((e) => e.amends === baseManifestId)
    .filter((e) =>
      e.amendedProvisions.some((p) => {
        const amended = parseProvision(p);
        return amended !== null && provisionMatches(amended, target);
      }),
    );
}

/**
 * Map a manifest entry into the shape `registerSourceSchema` validates.
 *
 * Deliberately generic — it makes no assumption about which jurisdiction it is
 * describing, because CLAUDE.md forbids country-specific assumptions outside the
 * Knowledge Pack and a mapper that only worked for one country would be exactly
 * that.
 *
 * Two mappings are worth stating, because they are judgements rather than
 * renames:
 *
 *   • `publicationDate` ← `gazettedOn`. Publication of a legal instrument is
 *     gazettal; a fetch date or a file timestamp is not.
 *   • `effectiveDate`   ← `commencementDate`, which is null for an instrument
 *     that has been enacted but not commenced. That null is meaningful and is
 *     never backfilled: an instrument with no commencement date has no date on
 *     which it took effect.
 *
 * The result is returned as `unknown`-safe plain data and is still validated by
 * `registerSourceSchema` inside `ingestSource`. This function is a convenience,
 * never a substitute for that gate.
 */
/**
 * Map a manifest `LegalStatus` onto the persisted `KnowledgeSourceLegalStatus`.
 *
 * The two overlap but are not identical: the manifest carries `not_law` and
 * `unknown`, which are not persisted standings. `assertManifestValid` already
 * refuses to ingest `not_law`, and an `unknown` standing must be recorded as the
 * fail-closed `unresolved` rather than silently becoming current law.
 */
export function toPersistedLegalStatus(status: LegalStatus): KnowledgeSourceLegalStatus {
  switch (status) {
    case 'in_force':
    case 'base_text_amended':
    case 'enacted_not_in_force':
    case 'repealed':
    case 'spent':
    case 'superseded':
      return status;
    case 'not_law':
    case 'unknown':
      return 'unresolved';
  }
}

export function toRegistrationInput(
  entry: SourceManifestEntry,
  params: { knowledgePackId: string; accessedAt?: string },
): Record<string, unknown> {
  return {
    knowledgePackId: params.knowledgePackId,
    manifestId: entry.manifestId,
    agency: entry.agency,
    title: entry.title,
    sourceUrl: entry.canonicalUrl,
    sourceType: entry.sourceType,
    countryCode: entry.countryCode,
    sourceAuthority: entry.sourceAuthority,
    legalSourceCategory: entry.legalSourceCategory,
    // Explicit, never defaulted (migration 20260823000000).
    freshnessState: entry.freshnessState,
    // Explicit legal standing (migration 20260905201714). enacted_not_in_force
    // and unresolved are excluded from current-law retrieval.
    legalStatus: toPersistedLegalStatus(entry.legalStatus),
    publicationDate: entry.gazettedOn,
    effectiveDate: entry.commencementDate,
    expiryDate: null,
    lastReviewedDate: null,
    accessedAt: params.accessedAt ?? null,
    contentMediaType: null,
  };
}

/** Convenience lookup. Returns null rather than throwing — callers decide. */
export function findEntry(
  manifest: SourceManifest,
  manifestId: string,
): SourceManifestEntry | null {
  return manifest.entries.find((e) => e.manifestId === manifestId) ?? null;
}
