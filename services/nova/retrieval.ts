import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeChunk, KnowledgeSource, SourceAuthority } from '@/types/knowledge';
import { CURRENT_LAW_LEGAL_STATUSES } from '@/types/knowledge';
import type {
  CoverageSignal,
  DeterministicFilters,
  RetrievalContext,
  RetrievalReproducibilityInputs,
  RetrievedChunk,
} from '@/lib/ai/retrieval/contract';
import type { Citation } from '@/lib/knowledge/citation';

import { RetrievalIntegrityError, assertRetrievalResultValid } from '@/lib/ai/retrieval/contract';
import { buildCitation } from '@/lib/knowledge/citation';
import { normaliseTerms } from '@/lib/knowledge/text';
import { findPublishedPack } from '@/lib/db/knowledge/packs';
import { listChunksForPack } from '@/lib/db/knowledge/chunks';
import { listSourcesForPack } from '@/lib/db/knowledge/sources';

type Db = SupabaseClient<Database>;

/**
 * Nova retrieval — the K5 pipeline, lexically ranked.
 *
 * This is the evidence half of Extractive Nova. It is deliberately NOT a new
 * retrieval architecture: it implements the contract in `lib/ai/retrieval/contract.ts`
 * (K5) with deterministic lexical ranking standing in for semantic search, which
 * is unavailable until KI1/MP-1 is decided.
 *
 * K5 §4 order is respected — deterministic filters run BEFORE ranking (§3.7), so
 * a chunk excluded by jurisdiction or authority is never a ranking candidate.
 *
 * ⚠ Retrieval REPORTS; the Coordinator DECIDES (K5 §10, audit A8). Nothing here
 *   raises a founder-facing question. Coverage limitations are reported in
 *   `coverage` and it is the Assistant Service's job to decide what to do
 *   with them.
 */

/** Bumped whenever filtering or assembly changes. Recorded per run for replay (K5 §12). */
export const NOVA_RETRIEVAL_CONFIG_VERSION = 'nova-lexical@1.0.0';

/** Bumped whenever the scoring function or tie-break order changes. */
export const NOVA_RANKING_CONFIG_VERSION = 'nova-lexical-rank@1.0.0';

/**
 * K5 §10 — Authority 1 sources are excluded from compliance retrieval.
 * Nova answers regulatory questions, so it inherits that floor.
 */
export const NOVA_MINIMUM_SOURCE_AUTHORITY: SourceAuthority = 2;

export const NOVA_DEFAULT_TOP_K = 5;

/** Filters a caller may set. `knowledgePackVersion` is not among them — see below. */
export type NovaRequestedFilters = Omit<DeterministicFilters, 'knowledgePackVersion'>;

export interface NovaRetrievalQuery {
  context: RetrievalContext;
  /** Structured, from the Business Profile. Never raw conversation (ADR-0017). */
  queryRepresentation: string;
  topK?: number;
  filters?: NovaRequestedFilters;
  /**
   * Include instruments that are not current law (enacted-not-in-force, repealed,
   * spent, superseded, unresolved) among the ranked results.
   *
   * Default false: current applicable law only. Set true ONLY when Nova is
   * explicitly answering a historical, future or commencement question — never
   * for "what must my business do now", which must never surface a provision
   * that is not in force as though it were.
   */
  includeNotYetInForce?: boolean;
}

/** An in-pack instrument excluded from a current-law answer because it is not in force. */
export interface NotInForceMatch {
  manifestId: string | null;
  title: string;
  legalStatus: KnowledgeSource['legal_status'];
}

/**
 * A retrieved chunk plus the provenance an agent needs to cite it.
 *
 * Extends the K5 `RetrievedChunk` rather than altering it. Specialist Agent
 * Contract §5.0: retrieval supplies Source Authority *and the provenance fields
 * of the canonical citation object*. Carrying the built `Citation` here is how
 * that obligation is met without a second citation builder existing anywhere
 * (Trust Layer §8 — `lib/knowledge/citation.ts` remains the only one).
 *
 * ⚠ Still no claim-level trust dimensions. Evidence Strength, Reasoning
 *   Confidence, Trust Level and Trust Score do not exist until a claim is
 *   evaluated against a passage (K3 §5.1, ADR-0015).
 */
export interface NovaRetrievedChunk extends RetrievedChunk {
  title: string | null;
  regulatoryDomain: string | null;
  effectiveDate: string | null;
  /** Built from the chunk and its source. `chunk_id` is mandatory and present. */
  citation: Citation;
  /** Whether this chunk states law or edits it. Determines rank order. */
  instrumentRole: KnowledgeChunk['instrument_role'];
  /** Canonical id of the provision this chunk is. Null when unparseable. */
  provisionId: string | null;
  /** Canonical id of the provision this chunk edits. Amending instructions only. */
  amendsProvision: string | null;
  /**
   * Stable manifest key from the chunk's source.
   *
   * Null means the source predates the manifest join. The Assistant Service
   * treats that as an integrity gap and withholds the current legal position
   * rather than assuming there are no amendments.
   */
  manifestId: string | null;
}

/**
 * No Knowledge Pack is published for this jurisdiction.
 *
 * Modelled separately because it is not a thin retrieval — it is the absence of
 * any knowledge to retrieve from, and it has no `knowledgePackVersion`, so it
 * cannot honestly claim reproducibility. Inventing a version sentinel to satisfy
 * the type would be exactly the quiet fiction this codebase refuses.
 *
 * The distinction matters downstream: "we hold no sources for your country" and
 * "we hold sources but none address your question" are different truths and
 * deserve different words, even though both refuse to answer.
 */
export interface NovaNoPublishedKnowledge {
  status: 'no_published_knowledge';
  countryCode: string;
  chunks: readonly [];
  coverage: CoverageSignal;
  retrievedAt: string;
}

/** A retrieval run that actually happened against a published pack. */
export interface NovaRetrievalRun {
  status: 'retrieved';
  packId: string;
  chunks: readonly NovaRetrievedChunk[];
  coverage: CoverageSignal;
  reproducibility: RetrievalReproducibilityInputs;
  retrievedAt: string;
  /**
   * Instruments that lexically matched the query but were EXCLUDED from the
   * ranked results because they are not current law (default current-law scope).
   * Surfaced so the Assistant Service can say "an enacted-but-not-commenced
   * instrument bears on this, but I am not treating it as current law" rather
   * than silently omitting it. Empty when `includeNotYetInForce` is set.
   */
  excludedNotInForce: readonly NotInForceMatch[];
}

export type NovaRetrievalResult = NovaNoPublishedKnowledge | NovaRetrievalRun;

/**
 * Whether any Knowledge Pack is published for a jurisdiction.
 *
 * Exists so a page can decide whether to offer the Nova composer at all. Asking
 * a founder to type a question we already know cannot be answered is a worse
 * experience than saying plainly that the sources are not there yet — and it is
 * the difference between an honest surface and one that implies a capability.
 */
export async function hasPublishedKnowledge(db: Db, countryCode: string): Promise<boolean> {
  return (await findPublishedPack(db, countryCode)) !== null;
}

/**
 * Tokenisation is shared with the extractive reasoner via `lib/knowledge/text`.
 * Behaviour is unchanged from the first implementation; the function moved so
 * that retrieval and extraction cannot drift apart, which would make Nova refuse
 * questions it had the evidence to answer.
 */
const normalise = normaliseTerms;

/**
 * Lexical relevance. Unchanged from the first implementation: keywords outrank
 * domain, which outranks title, which outranks body.
 */
function scoreChunk(chunk: KnowledgeChunk, queryTerms: readonly string[]): number {
  const title = normalise(chunk.title ?? '');
  const body = normalise(chunk.body);
  const keywords = chunk.keywords.flatMap(normalise);
  const domain = normalise(chunk.regulatory_domain ?? '');

  let score = 0;

  for (const term of queryTerms) {
    if (keywords.includes(term)) score += 5;
    if (domain.includes(term)) score += 4;
    if (title.includes(term)) score += 3;
    if (body.includes(term)) score += 1;
  }

  return score;
}

/**
 * Rank order for instrument role. Lower sorts first.
 *
 * `unknown` last, deliberately: a chunk written before classification existed
 * may not lead an answer.
 */
const ROLE_RANK: Readonly<Record<KnowledgeChunk['instrument_role'], number>> = Object.freeze({
  substantive: 0,
  amending_instruction: 1,
  unknown: 2,
});

/**
 * A total order, not just a score order.
 *
 * ⚠ **Instrument role outranks relevance score, and that is deliberate.**
 *
 * An amending Act contains the same query terms as the provision it edits, and
 * often scores higher — it repeats the section number and the operative words.
 * But it does not state law. It states an edit:
 *
 *   "Section 6 of the principal Act is amended, in paragraph (b), by the
 *    deletion of the words 'if sold unprepared in a food store and' …"
 *
 * That is a valid, citable, Authority-5 verbatim quotation and a useless answer
 * to a founder asking whether they pay VAT on food. Grounding checks
 * provenance, not comprehensibility, so no other gate in the system catches it.
 *
 * Amending chunks are still retrieved — they are evidence, and the amendment
 * NOTICE comes from manifest metadata rather than from retrieving them — they
 * simply never outrank a substantive provision.
 *
 * K5 §3.8 then requires the same ordered set for fixed inputs, so authority,
 * chunk index and chunk_id break every remaining tie deterministically.
 */
function compareForRank(
  a: { chunk: KnowledgeChunk; score: number },
  b: { chunk: KnowledgeChunk; score: number },
): number {
  const roleDelta = ROLE_RANK[a.chunk.instrument_role] - ROLE_RANK[b.chunk.instrument_role];
  if (roleDelta !== 0) return roleDelta;

  if (b.score !== a.score) return b.score - a.score;
  if (b.chunk.source_authority !== a.chunk.source_authority) {
    return b.chunk.source_authority - a.chunk.source_authority;
  }
  if (a.chunk.chunk_index !== b.chunk.chunk_index) {
    return a.chunk.chunk_index - b.chunk.chunk_index;
  }
  return a.chunk.chunk_id.localeCompare(b.chunk.chunk_id);
}

/** Requirements in force on the given date. A null effective date is treated as in force. */
function isEffectiveOn(chunk: KnowledgeChunk, effectiveOn: string | undefined): boolean {
  if (!effectiveOn) return true;
  if (!chunk.effective_date) return true;
  return chunk.effective_date <= effectiveOn;
}

function matchesDomain(chunk: KnowledgeChunk, domains: readonly string[] | undefined): boolean {
  if (!domains || domains.length === 0) return true;
  if (!chunk.regulatory_domain) return false;
  return domains.includes(chunk.regulatory_domain);
}

/**
 * K5 §10 coverage reporting.
 *
 * `emptyDomains` and `lowAuthorityDomains` are computed against the domains the
 * caller asked for, because a domain that was never requested cannot be said to
 * have returned nothing.
 */
function buildCoverage(params: {
  requestedDomains: readonly string[];
  ranked: readonly { chunk: KnowledgeChunk }[];
  exhaustedFilters: readonly string[];
}): CoverageSignal {
  const { requestedDomains, ranked, exhaustedFilters } = params;

  const emptyDomains = requestedDomains.filter(
    (domain) => !ranked.some(({ chunk }) => chunk.regulatory_domain === domain),
  );

  const lowAuthorityDomains = requestedDomains.filter((domain) => {
    const inDomain = ranked.filter(({ chunk }) => chunk.regulatory_domain === domain);
    if (inDomain.length === 0) return false;
    return inDomain.every(({ chunk }) => chunk.source_authority < 4);
  });

  return {
    emptyDomains,
    lowAuthorityDomains,
    exhaustedFilters,
  };
}

/**
 * Retrieve evidence for a Nova question.
 *
 * Fails closed in two places: a chunk whose source cannot be resolved cannot be
 * cited, so it is an integrity error rather than a silently dropped row; and the
 * assembled result is put through `assertRetrievalResultValid` before it is
 * returned, so a malformed set never reaches a reasoner.
 *
 * Scaling note: the whole pack is read and filtered in memory. That is correct
 * for a single-jurisdiction pack and is the same behaviour as before this
 * refactor. Pushing the deterministic filters into SQL is a later change to
 * `lib/db/knowledge/chunks.ts`, not to this pipeline's shape.
 */
export async function retrieveNovaEvidence(
  db: Db,
  query: NovaRetrievalQuery,
): Promise<NovaRetrievalResult> {
  const retrievedAt = new Date().toISOString();
  const { context, queryRepresentation } = query;
  const topK = query.topK ?? NOVA_DEFAULT_TOP_K;
  const requestedDomains = query.filters?.regulatoryDomains ?? context.regulatoryDomains ?? [];
  const minimumSourceAuthority =
    query.filters?.minimumSourceAuthority ?? NOVA_MINIMUM_SOURCE_AUTHORITY;
  const effectiveOn = query.filters?.effectiveOn;

  const pack = await findPublishedPack(db, context.countryCode);

  if (!pack) {
    return {
      status: 'no_published_knowledge',
      countryCode: context.countryCode,
      chunks: [],
      coverage: {
        emptyDomains: requestedDomains,
        lowAuthorityDomains: [],
        exhaustedFilters: ['knowledge_pack:published'],
      },
      retrievedAt,
    };
  }

  const [chunks, sources] = await Promise.all([
    listChunksForPack(db, pack.id),
    listSourcesForPack(db, pack.id),
  ]);

  const sourcesById = new Map<string, KnowledgeSource>(sources.map((s) => [s.id, s]));

  // ── Deterministic filters, before ranking (K5 §3.7) ──────────────────────
  const exhaustedFilters: string[] = [];

  const inJurisdiction = chunks.filter((c) => c.country_code === context.countryCode);
  if (chunks.length > 0 && inJurisdiction.length === 0) {
    exhaustedFilters.push('jurisdiction:country_code');
  }

  const meetsAuthority = inJurisdiction.filter((c) => c.source_authority >= minimumSourceAuthority);
  if (inJurisdiction.length > 0 && meetsAuthority.length === 0) {
    exhaustedFilters.push(`minimum_source_authority:${minimumSourceAuthority}`);
  }

  // Legal status (before effective-date and ranking). A source that is not
  // current law — enacted-not-in-force, repealed, spent, superseded, or of
  // unresolved standing — is never served as current applicable law. Null
  // effective_date is NO LONGER read as "in force"; standing is explicit.
  const isCurrentLaw = (chunk: KnowledgeChunk): boolean => {
    const source = sourcesById.get(chunk.knowledge_source_id);
    return source ? CURRENT_LAW_LEGAL_STATUSES.includes(source.legal_status) : false;
  };
  const includeNotYetInForce = query.includeNotYetInForce ?? false;
  const currentLaw = includeNotYetInForce
    ? meetsAuthority
    : meetsAuthority.filter((c) => {
        // A chunk whose source is missing is corruption, not "not current" — let
        // it flow to the assembly integrity check, which reports it explicitly
        // rather than silently dropping it here.
        const source = sourcesById.get(c.knowledge_source_id);
        return !source || CURRENT_LAW_LEGAL_STATUSES.includes(source.legal_status);
      });
  if (meetsAuthority.length > 0 && currentLaw.length === 0 && !includeNotYetInForce) {
    exhaustedFilters.push('legal_status:current');
  }

  const inForce = currentLaw.filter((c) => isEffectiveOn(c, effectiveOn));
  if (meetsAuthority.length > 0 && inForce.length === 0) {
    exhaustedFilters.push('effective_on');
  }

  const inDomain = inForce.filter((c) => matchesDomain(c, requestedDomains));
  if (inForce.length > 0 && inDomain.length === 0) {
    exhaustedFilters.push('regulatory_domains');
  }

  // ── Ranking ──────────────────────────────────────────────────────────────
  const queryTerms = normalise(queryRepresentation);

  const ranked = inDomain
    .map((chunk) => ({ chunk, score: scoreChunk(chunk, queryTerms) }))
    .filter(({ score }) => score > 0)
    .sort(compareForRank)
    .slice(0, topK);

  if (inDomain.length > 0 && ranked.length === 0) {
    exhaustedFilters.push('lexical_match');
  }

  // Surface not-current instruments that DID lexically match, so the Assistant
  // Service can caveat them ("enacted, not commenced — not treated as current
  // law") instead of silently omitting them. Only when scoping to current law.
  const excludedNotInForce: NotInForceMatch[] = [];
  if (!includeNotYetInForce) {
    const seen = new Set<string>();
    for (const chunk of meetsAuthority) {
      if (isCurrentLaw(chunk)) continue;
      if (!matchesDomain(chunk, requestedDomains)) continue;
      if (scoreChunk(chunk, queryTerms) <= 0) continue;
      const source = sourcesById.get(chunk.knowledge_source_id);
      if (!source || seen.has(source.id)) continue;
      seen.add(source.id);
      excludedNotInForce.push({
        manifestId: source.manifest_id,
        title: source.title,
        legalStatus: source.legal_status,
      });
    }
  }

  // ── Assembly (K5 §11) ────────────────────────────────────────────────────
  const assembled: NovaRetrievedChunk[] = ranked.map(({ chunk, score }, index) => {
    const source = sourcesById.get(chunk.knowledge_source_id);

    if (!source) {
      // An uncitable chunk must never reach an agent: a claim built on it could
      // never be grounded. The FK guarantees this cannot happen for a
      // well-formed pack, so reaching here means the pack is corrupt.
      throw new RetrievalIntegrityError(
        `Trust Layer §8: chunk ${chunk.chunk_id} references knowledge source ` +
          `${chunk.knowledge_source_id}, which is not part of published pack ${pack.id}. ` +
          'A chunk that cannot be cited cannot be retrieved.',
      );
    }

    return {
      chunkId: chunk.chunk_id,
      knowledgeSourceId: chunk.knowledge_source_id,
      body: chunk.body,
      sectionReference: chunk.section_reference,
      sourceAuthority: chunk.source_authority,
      legalSourceCategory: chunk.legal_source_category,
      rank: index + 1,
      score,
      title: chunk.title,
      regulatoryDomain: chunk.regulatory_domain,
      effectiveDate: chunk.effective_date,
      instrumentRole: chunk.instrument_role,
      provisionId: chunk.provision_id,
      amendsProvision: chunk.amends_provision,
      manifestId: source.manifest_id,
      citation: buildCitation({
        chunk,
        source,
        knowledgeVersion: pack.version,
      }),
    };
  });

  const result: NovaRetrievalRun = {
    status: 'retrieved',
    packId: pack.id,
    chunks: assembled,
    coverage: buildCoverage({ requestedDomains, ranked, exhaustedFilters }),
    reproducibility: {
      knowledgePackVersion: pack.version,
      retrievalConfigVersion: NOVA_RETRIEVAL_CONFIG_VERSION,
      queryRepresentation,
      filters: {
        knowledgePackVersion: pack.version,
        regulatoryDomains: requestedDomains,
        ...(effectiveOn !== undefined ? { effectiveOn } : {}),
        minimumSourceAuthority,
      },
      rankingConfigVersion: NOVA_RANKING_CONFIG_VERSION,
      // Null until KI1 is decided. Extractive Nova uses no vectors, so this is
      // not a gap — it is an accurate statement that none participated.
      embeddingIdentity: null,
    },
    retrievedAt,
    excludedNotInForce,
  };

  // Fails closed. A malformed set is rejected here rather than by whatever
  // consumes it (K5 §3.10).
  assertRetrievalResultValid(result);

  return result;
}
