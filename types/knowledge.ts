/**
 * Knowledge domain types — K1–K7.
 *
 * Ownership boundaries these types exist to keep visible:
 *   ADR-0015    the four trust dimensions
 *   Trust Layer the canonical citation object (§8)
 *   K1  Knowledge Pack (system of record) · K2 validation · K3 chunking
 *   K4  metadata/citation · K5 retrieval · K6 monitoring · K7 publishing
 */

/** K2 §8.1 — metadata alongside the five-level scale. Not a second scale. */
export type LegalSourceCategory =
  | 'constitution'
  | 'primary_legislation'
  | 'regulation'
  | 'ministerial_order'
  | 'official_guidance'
  | 'agency_publication';

export type KnowledgeSourceType =
  | 'act'
  | 'regulation'
  | 'statutory_instrument'
  | 'gazette_notice'
  | 'guidance_note'
  | 'agency_page'
  | 'form'
  | 'fee_schedule';

/** ADR-0015 Source Authority. A property of the DOCUMENT, never the publisher. */
export type SourceAuthority = 1 | 2 | 3 | 4 | 5;

/**
 * Whether a chunk states law or edits it.
 *
 * An amending Act does not state law. It states edits — "Section 6 of the
 * principal Act is amended … by the deletion of the words …" — which is a
 * valid, citable, Authority-5 quotation and a useless answer to a founder.
 * Substantive chunks therefore rank ahead of amending instructions.
 *
 * `unknown` exists only for chunks written before this classification existed.
 * It ranks last, may not lead an answer, and cannot be written by the
 * application: `draftChunkSchema` accepts the other two values only.
 */
export type InstrumentRole = 'substantive' | 'amending_instruction' | 'unknown';

export type KnowledgePackStatus =
  'draft' | 'validating' | 'staged' | 'published' | 'superseded' | 'rolled_back';

export type ValidationOutcome = 'validated' | 'partially_validated' | 'unverified' | 'rejected';

/**
 * A source's verified legal standing — represented EXPLICITLY, never inferred
 * from the absence of a commencement date.
 *
 * Retrieval treats only `in_force` and `base_text_amended` as CURRENT applicable
 * law. Everything else is excluded from current-law answers (though it may still
 * be retrieved and cited for historical / future / commencement questions):
 *
 *   • `enacted_not_in_force` — passed and assented, commencement not yet
 *     triggered. The Data Protection Act 2025 is the motivating case: its
 *     commencement is an appointed day the Minister has not fixed, so it must
 *     never be served as current law.
 *   • `repealed` / `spent` / `superseded` — no longer the operative text.
 *   • `unresolved` — standing not established from a primary source. Fail-closed:
 *     an un-asserted status is NOT current law.
 */
export type KnowledgeSourceLegalStatus =
  | 'in_force'
  | 'base_text_amended'
  | 'enacted_not_in_force'
  | 'repealed'
  | 'spent'
  | 'superseded'
  | 'unresolved';

/** The statuses retrieval treats as current applicable law. */
export const CURRENT_LAW_LEGAL_STATUSES: readonly KnowledgeSourceLegalStatus[] = Object.freeze([
  'in_force',
  'base_text_amended',
]);

/**
 * G11 commercial-publication eligibility.
 *
 * A PUBLICATION/REDISTRIBUTION gate, not an ingestion gate. Official Government
 * of The Bahamas legislation may be acquired and worked with for internal
 * engineering, staging and testing, but not published as Islanda-served
 * content until reuse permission is recorded. Fail-closed: packs are
 * `'restricted'` until deliberately `'cleared'`. Successful retrieval never
 * implies eligibility. Enforced atomically in `publish_knowledge_pack`.
 *
 * An Islanda-authored synthetic corpus (e.g. Example Jurisdiction ZZ) carries
 * no third-party copyright and is `'cleared'`.
 */
export type CommercialPublicationEligibility = 'restricted' | 'cleared';

/** K6 §2A.4. Freshness is NOT a fifth trust dimension. */
export type KnowledgeFreshnessState =
  'current' | 'review_due' | 'changed_pending_assessment' | 'stale' | 'withdrawn';

/**
 * K2 §8.1 mapping. Authority is derived from the document's legal category, so
 * it cannot be set independently — that is what stops official guidance (3)
 * reaching 🟢 VERIFIED, which requires ≥ 4 (ADR-0015).
 *
 * `agency_publication` is the one category with a judgement call: 3 when issued
 * by the responsible agency, 2 otherwise.
 */
export const AUTHORITY_BY_CATEGORY: Readonly<
  Record<LegalSourceCategory, readonly SourceAuthority[]>
> = Object.freeze({
  constitution: [5],
  primary_legislation: [5],
  regulation: [4],
  ministerial_order: [4],
  official_guidance: [3],
  agency_publication: [3, 2],
});

/**
 * K2 §8.2 — ordering WITHIN an authority level. Lower index wins.
 * A Constitution outranks an ordinary Act though both are Authority 5.
 */
export const CATEGORY_PRECEDENCE: readonly LegalSourceCategory[] = Object.freeze([
  'constitution',
  'primary_legislation',
  'regulation',
  'ministerial_order',
  'official_guidance',
  'agency_publication',
]);

export interface KnowledgePack {
  id: string;
  country_code: string;
  version: string;
  status: KnowledgePackStatus;
  notes: string | null;
  published_at: string | null;
  published_by: string | null;
  approval_note: string | null;
  superseded_at: string | null;
  superseded_by_id: string | null;
  /** G11. Fail-closed 'restricted'; only a 'cleared' pack may be published. */
  commercial_publication_eligibility: CommercialPublicationEligibility;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeSource {
  id: string;
  knowledge_pack_id: string;
  agency: string;
  title: string;
  source_url: string | null;
  source_type: KnowledgeSourceType;
  country_code: string;
  region: string | null;
  municipality: string | null;
  source_authority: SourceAuthority;
  legal_source_category: LegalSourceCategory;
  publication_date: string | null;
  effective_date: string | null;
  expiry_date: string | null;
  last_reviewed_date: string | null;
  review_due_at: string | null;
  freshness_state: KnowledgeFreshnessState;
  /** Verified legal standing. Drives whether retrieval treats the source as current law. */
  legal_status: KnowledgeSourceLegalStatus;
  accessed_at: string | null;
  content_hash: string | null;
  content_media_type: string | null;
  created_at: string;
  updated_at: string;

  /**
   * Stable key into the Knowledge Pack source manifest.
   *
   * The amendment chain resolves through this, never through `source_url`: a
   * changed government URL must not silently detach a source from its
   * amendments. Null only for rows written before the join existed.
   */
  manifest_id: string | null;
}

/**
 * K3 chunk.
 *
 * ⚠ This interface deliberately has NO `evidence_strength`, `reasoning_confidence`,
 * `trust_level` or `trust_score`. K3 §5.1: a chunk has no claim to be strong
 * evidence *for*. The same chunk may be Evidence Strength 5 for one claim and 2
 * for another. Those dimensions are derived per claim by the Trust Layer.
 */
export interface KnowledgeChunk {
  chunk_id: string;
  knowledge_source_id: string;
  knowledge_pack_id: string;
  chunk_index: number;
  title: string | null;
  body: string;
  content_hash: string;
  country_code: string;
  section_reference: string | null;
  clause: string | null;
  page: number | null;
  source_authority: SourceAuthority;
  legal_source_category: LegalSourceCategory;
  industry: string | null;
  regulatory_domain: string | null;
  keywords: string[];
  effective_date: string | null;
  chunk_version: number;
  created_at: string;

  /** Whether this chunk states law or edits it. Drives retrieval ranking. */
  instrument_role: InstrumentRole;
  /**
   * Canonical id of the provision this chunk IS — `'s.56(1)'`, `'sch.2'`.
   * Null where `section_reference` could not be parsed, which the Assistant
   * Service reports as unresolved rather than treating as "no amendments".
   */
  provision_id: string | null;
  /**
   * For an amending instruction: the canonical id of the provision in the
   * principal instrument that this chunk edits. Null for substantive chunks.
   */
  amends_provision: string | null;
}

/** Field names that must never appear on a chunk. Asserted by tests. */
export const FORBIDDEN_CHUNK_TRUST_FIELDS: readonly string[] = Object.freeze([
  'evidence_strength',
  'reasoning_confidence',
  'coverage_confidence',
  'trust_level',
  'trust_score',
]);

/** K7 §3.1 — a retrieval artifact. Regenerating it does not bump the Pack version. */
export interface EmbeddingManifest {
  id: string;
  knowledge_pack_id: string;
  provider: string;
  model: string;
  model_version: string;
  dimensions: number;
  retrieval_config_version: string;
  chunk_version: number;
  status: 'pending' | 'generating' | 'complete' | 'failed' | 'invalidated';
  generated_at: string;
}
