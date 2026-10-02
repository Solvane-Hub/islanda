import type { KnowledgeChunk, KnowledgePack, KnowledgeSource } from '@/types/knowledge';
import type { SourceManifest } from '@/services/knowledge/manifests/types';
import { toPersistedLegalStatus } from '@/services/knowledge/manifests/types';
import { toCanonicalProvisionId } from '@/lib/knowledge/provision';
import {
  DEMO_ZZ_AGENCY,
  DEMO_ZZ_COUNTRY_CODE,
  DEMO_ZZ_KNOWLEDGE_VERSION,
  DEMO_ZZ_MANIFEST,
  DEMO_ZZ_SOURCES,
  ZZ_AMEND_IN_FORCE,
  ZZ_AMEND_NOT_IN_FORCE,
  ZZ_BASE,
  ZZ_FOOD_ACT,
} from '@/services/knowledge/manifests/demo-zz';

/**
 * Database-shaped fixtures for the SYNTHETIC ZZ corpus.
 *
 * ⚠ **This file defines no corpus of its own.** Every instrument, body, keyword
 *   and provision reference is derived from
 *   `services/knowledge/manifests/demo-zz.ts`, which is the single definition
 *   the seed script also publishes. Two copies would drift, and the drift would
 *   be invisible: tests would keep passing against a corpus the demo no longer
 *   contains.
 *
 * What this file DOES own is the mapping into `knowledge_*` row shapes, so that
 * retrieval can be exercised against a stub without a database.
 *
 * ⚠ The `chunk_id` values here are the readable fixture keys (`zz-chunk-s4`).
 *   Real ingestion derives `chunk_id` from the knowledge version, source id and
 *   body via `deriveChunkId`. Keeping the two distinct is deliberate: a fixture
 *   identifier must never be mistakable for a citation identity.
 *
 * No Bahamian — or any other real — legal source material appears here. G11
 * constrains real legal text; the shape of an amendment chain is what needs
 * exercising, not its content.
 */

export { ZZ_AMEND_IN_FORCE, ZZ_AMEND_NOT_IN_FORCE, ZZ_BASE, ZZ_FOOD_ACT };

export const ZZ_PACK_ID = '33333333-3333-4333-8333-333333333333';
export const ZZ_KNOWLEDGE_VERSION = DEMO_ZZ_KNOWLEDGE_VERSION;

/** The runtime manifest, unchanged. Re-exported under its historical name. */
export const SYNTHETIC_MANIFEST: SourceManifest = DEMO_ZZ_MANIFEST;

// ── Sources ─────────────────────────────────────────────────────────────────

/** Stable row id per instrument. Readable, and independent of the manifest key. */
const SOURCE_ID_BY_MANIFEST_ID: Readonly<Record<string, string>> = {
  [ZZ_BASE]: 'zz-source-base',
  [ZZ_AMEND_IN_FORCE]: 'zz-source-amend-a',
  [ZZ_AMEND_NOT_IN_FORCE]: 'zz-source-amend-b',
  [ZZ_FOOD_ACT]: 'zz-source-food',
};

export const ZZ_PACK: KnowledgePack = {
  id: ZZ_PACK_ID,
  country_code: DEMO_ZZ_COUNTRY_CODE,
  version: ZZ_KNOWLEDGE_VERSION,
  status: 'published',
  notes: null,
  published_at: '2026-01-01T00:00:00.000Z',
  published_by: 'synthetic-reviewer',
  approval_note: null,
  superseded_at: null,
  superseded_by_id: null,
  // Synthetic Islanda-authored corpus: no third-party copyright, publishable.
  commercial_publication_eligibility: 'cleared',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

export const ZZ_SOURCES: KnowledgeSource[] = DEMO_ZZ_MANIFEST.entries.map((entry) => ({
  id: SOURCE_ID_BY_MANIFEST_ID[entry.manifestId] ?? `zz-source-${entry.manifestId.toLowerCase()}`,
  knowledge_pack_id: ZZ_PACK_ID,
  manifest_id: entry.manifestId,
  agency: entry.agency,
  title: entry.title,
  source_url: entry.canonicalUrl,
  source_type: entry.sourceType,
  country_code: entry.countryCode,
  region: null,
  municipality: null,
  source_authority: entry.sourceAuthority,
  legal_source_category: entry.legalSourceCategory,
  publication_date: entry.gazettedOn,
  effective_date: entry.commencementDate,
  expiry_date: null,
  last_reviewed_date: '2026-07-01',
  review_due_at: null,
  freshness_state: entry.freshnessState,
  legal_status: toPersistedLegalStatus(entry.legalStatus),
  accessed_at: '2026-08-08T00:00:00.000Z',
  content_hash: 'synthetic-hash',
  content_media_type: 'text/html',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}));

const SOURCE_BY_MANIFEST_ID = new Map(ZZ_SOURCES.map((s) => [s.manifest_id, s]));

// ── Chunks ──────────────────────────────────────────────────────────────────

export const ZZ_CHUNKS: KnowledgeChunk[] = DEMO_ZZ_SOURCES.flatMap((spec) => {
  const source = SOURCE_BY_MANIFEST_ID.get(spec.manifestId);
  if (!source) {
    // Unreachable while both derive from the same manifest, and checked anyway:
    // a silently missing source would produce chunks that cannot be cited, which
    // is the one corpus defect retrieval is entitled to throw over.
    throw new Error(`Fixture defect: no source row for manifest entry "${spec.manifestId}".`);
  }

  return spec.chunks.map(({ key, draft }) => ({
    chunk_id: key,
    knowledge_source_id: source.id,
    knowledge_pack_id: ZZ_PACK_ID,
    chunk_index: draft.chunkIndex,
    title: draft.title ?? null,
    body: draft.body,
    content_hash: `synthetic-chunk-hash-${key}`,
    country_code: source.country_code,
    section_reference: draft.sectionReference ?? null,
    clause: draft.clause ?? null,
    page: draft.page ?? null,
    source_authority: source.source_authority,
    legal_source_category: source.legal_source_category,
    industry: draft.industry ?? null,
    regulatory_domain: draft.regulatoryDomain ?? null,
    keywords: [...(draft.keywords ?? [])],
    effective_date: draft.effectiveDate ?? null,
    chunk_version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    instrument_role: draft.instrumentRole,
    // Derived exactly as `prepareChunks` derives it, so the fixture cannot
    // encode a provision identity that ingestion would not produce.
    provision_id: toCanonicalProvisionId(draft.sectionReference ?? null),
    amends_provision: toCanonicalProvisionId(draft.amendsProvision ?? null),
  }));
});

// ── Integrity-gap fixtures ──────────────────────────────────────────────────

/**
 * A source the manifest does not describe.
 *
 * Used to prove the fail-closed path: the corpus definition and the database
 * disagree, so nothing can be said about the provision's amendment history.
 */
export const ZZ_ORPHAN_SOURCE: KnowledgeSource = {
  ...ZZ_SOURCES[0]!,
  id: 'zz-source-orphan',
  manifest_id: 'ZZ-NOT-IN-MANIFEST',
  title: 'Example Orphaned Instrument (SYNTHETIC)',
  source_url: 'https://example.invalid/orphan',
  agency: DEMO_ZZ_AGENCY,
};

/** A chunk whose source is not in the manifest. Proves the fail-closed join. */
export const ZZ_ORPHAN_CHUNK: KnowledgeChunk = {
  ...ZZ_CHUNKS[0]!,
  chunk_id: 'zz-chunk-orphan',
  knowledge_source_id: 'zz-source-orphan',
  chunk_index: 0,
  section_reference: 'section 1',
  provision_id: 's.1',
  amends_provision: null,
  instrument_role: 'substantive',
  body: 'An orphaned widget provision of unknown amendment history.',
  keywords: ['orphaned', 'widget'],
};
