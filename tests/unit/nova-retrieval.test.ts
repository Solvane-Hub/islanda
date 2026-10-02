import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeChunk, KnowledgePack, KnowledgeSource } from '@/types/knowledge';

import {
  NOVA_MINIMUM_SOURCE_AUTHORITY,
  NOVA_RANKING_CONFIG_VERSION,
  NOVA_RETRIEVAL_CONFIG_VERSION,
  retrieveNovaEvidence,
} from '@/services/nova/retrieval';
import { RetrievalIntegrityError } from '@/lib/ai/retrieval/contract';

/**
 * Fixtures are typed against the canonical domain types, not cast away.
 *
 * The previous version of this file asserted `source_authority: 'primary'` and
 * `legal_source_category: 'statute'` — neither of which exists. It passed only
 * because the client stub was cast `as never`, which erased the fixtures too. So
 * six tests were proving that retrieval works on data the database cannot hold.
 *
 * Authority and category are paired per K2 §8.1 (`AUTHORITY_BY_CATEGORY`):
 * primary_legislation → 5, regulation → 4, official_guidance → 3,
 * agency_publication → 3 or 2. An invalid pair is now a compile error.
 */

const publishedPack: KnowledgePack = {
  id: 'pack-1',
  country_code: 'BS',
  version: 'BS-2026.1',
  status: 'published',
  notes: null,
  published_at: '2026-01-01T00:00:00.000Z',
  published_by: 'reviewer-1',
  approval_note: null,
  superseded_at: null,
  superseded_by_id: null,
  commercial_publication_eligibility: 'cleared',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
};

function source(
  overrides: Partial<KnowledgeSource> & Pick<KnowledgeSource, 'id'>,
): KnowledgeSource {
  return {
    knowledge_pack_id: 'pack-1',
    manifest_id: 'BS-SYNTH-SOURCE',
    agency: 'Registrar General',
    title: 'Business Licence Act',
    source_url: 'https://example.gov.bs/business-licence-act',
    source_type: 'act',
    country_code: 'BS',
    region: null,
    municipality: null,
    source_authority: 5,
    legal_source_category: 'primary_legislation',
    publication_date: '2025-06-01',
    effective_date: '2026-01-01',
    expiry_date: null,
    last_reviewed_date: '2026-01-15',
    review_due_at: null,
    freshness_state: 'current',
    legal_status: 'in_force',
    accessed_at: '2026-01-20T00:00:00.000Z',
    content_hash: 'source-hash',
    content_media_type: 'application/pdf',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function chunk(
  overrides: Partial<KnowledgeChunk> & Pick<KnowledgeChunk, 'chunk_id'>,
): KnowledgeChunk {
  return {
    knowledge_source_id: 'source-1',
    knowledge_pack_id: 'pack-1',
    chunk_index: 0,
    title: 'Business Registration',
    body: 'Businesses must register before operating in The Bahamas.',
    content_hash: 'chunk-hash',
    country_code: 'BS',
    section_reference: 'Section 1',
    clause: null,
    page: 1,
    source_authority: 5,
    legal_source_category: 'primary_legislation',
    industry: null,
    regulatory_domain: 'business_registration',
    keywords: ['business', 'registration', 'register'],
    effective_date: '2026-01-01',
    chunk_version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    instrument_role: 'substantive',
    provision_id: 's.1',
    amends_provision: null,
    ...overrides,
  };
}

const defaultSources: KnowledgeSource[] = [
  source({ id: 'source-1' }),
  source({
    id: 'source-2',
    agency: 'Department of Labour',
    title: 'Employment Regulations',
    source_type: 'regulation',
    source_authority: 4,
    legal_source_category: 'regulation',
  }),
];

const defaultChunks: KnowledgeChunk[] = [
  chunk({ chunk_id: 'chunk-1' }),
  chunk({
    chunk_id: 'chunk-2',
    knowledge_source_id: 'source-2',
    chunk_index: 1,
    title: 'Employment',
    body: 'Employers must comply with employment requirements.',
    section_reference: 'Section 2',
    page: 2,
    source_authority: 4,
    legal_source_category: 'regulation',
    regulatory_domain: 'employment',
    keywords: ['employment', 'employees'],
  }),
];

/**
 * A hand-rolled stub of the query surface these three repositories actually use.
 *
 * The cast is confined to the client itself and is `as unknown as SupabaseClient<Database>`
 * rather than `as never`, so every fixture above stays type-checked. Mocking the
 * full generated client would be a larger fiction than this one.
 */
function mockDb(params: {
  pack?: KnowledgePack | null;
  chunks?: KnowledgeChunk[];
  sources?: KnowledgeSource[];
}): SupabaseClient<Database> {
  const pack = params.pack === undefined ? publishedPack : params.pack;
  const packChunks = params.chunks ?? defaultChunks;
  const packSources = params.sources ?? defaultSources;

  const from = vi.fn((table: string) => {
    if (table === 'knowledge_packs') {
      return {
        select: () => ({
          eq: () => ({
            eq: () => ({ maybeSingle: async () => ({ data: pack, error: null }) }),
          }),
        }),
      };
    }

    if (table === 'knowledge_chunks') {
      return {
        select: () => ({
          eq: () => ({ order: async () => ({ data: packChunks, error: null }) }),
        }),
      };
    }

    if (table === 'knowledge_sources') {
      return {
        select: () => ({
          eq: () => ({ order: async () => ({ data: packSources, error: null }) }),
        }),
      };
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

const bahamas = { countryCode: 'BS' } as const;

describe('Nova retrieval — K5 pipeline', () => {
  it('retrieves evidence from the published Knowledge Pack', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    expect(result.status).toBe('retrieved');
    if (result.status !== 'retrieved') return;

    expect(result.packId).toBe('pack-1');
    expect(result.chunks.length).toBeGreaterThan(0);
    expect(result.chunks[0]?.chunkId).toBe('chunk-1');
  });

  it('ranks keyword matches above body-only matches', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks[0]?.chunkId).toBe('chunk-1');
  });

  it('reports no published knowledge distinctly from an empty result', async () => {
    const result = await retrieveNovaEvidence(mockDb({ pack: null }), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    expect(result.status).toBe('no_published_knowledge');
    expect(result.chunks).toEqual([]);
    expect(result.coverage.exhaustedFilters).toContain('knowledge_pack:published');
  });

  it('returns no chunks when the query matches nothing, and says which filter emptied it', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'marine biology',
    });

    expect(result.status).toBe('retrieved');
    if (result.status !== 'retrieved') return;

    expect(result.chunks).toEqual([]);
    expect(result.coverage.exhaustedFilters).toContain('lexical_match');
  });

  it('respects the retrieval limit', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business employment',
      topK: 1,
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks).toHaveLength(1);
  });
});

describe('Nova retrieval — citation provenance', () => {
  it('builds a citation from the joined knowledge source', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');

    expect(result.chunks[0]?.citation).toMatchObject({
      chunk_id: 'chunk-1',
      agency: 'Registrar General',
      document: 'Business Licence Act',
      section: 'Section 1',
      page: 1,
      knowledge_version: 'BS-2026.1',
      url: 'https://example.gov.bs/business-licence-act',
    });
  });

  it('records the Pack version of the run, not of the chunk row', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    for (const c of result.chunks) {
      expect(c.citation.knowledge_version).toBe(publishedPack.version);
    }
  });

  it('refuses a chunk whose source is not in the pack rather than dropping it', async () => {
    const orphan = chunk({ chunk_id: 'chunk-orphan', knowledge_source_id: 'source-missing' });

    await expect(
      retrieveNovaEvidence(mockDb({ chunks: [orphan], sources: [source({ id: 'source-1' })] }), {
        context: bahamas,
        queryRepresentation: 'business registration',
      }),
    ).rejects.toBeInstanceOf(RetrievalIntegrityError);
  });
});

describe('Nova retrieval — deterministic filters run before ranking', () => {
  it('excludes chunks outside the requested jurisdiction', async () => {
    const foreign = chunk({
      chunk_id: 'chunk-foreign',
      country_code: 'US',
      title: 'Business Registration',
      keywords: ['business', 'registration'],
    });

    const result = await retrieveNovaEvidence(mockDb({ chunks: [...defaultChunks, foreign] }), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.map((c) => c.chunkId)).not.toContain('chunk-foreign');
  });

  it('applies the minimum source authority floor', async () => {
    const guidance = chunk({
      chunk_id: 'chunk-guidance',
      knowledge_source_id: 'source-2',
      source_authority: 3,
      legal_source_category: 'official_guidance',
      keywords: ['business', 'registration'],
    });

    const result = await retrieveNovaEvidence(mockDb({ chunks: [...defaultChunks, guidance] }), {
      context: bahamas,
      queryRepresentation: 'business registration',
      filters: { minimumSourceAuthority: 4 },
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.map((c) => c.chunkId)).not.toContain('chunk-guidance');
    expect(result.chunks.every((c) => c.sourceAuthority >= 4)).toBe(true);
  });

  it('defaults the authority floor to the K5 §10 minimum', async () => {
    expect(NOVA_MINIMUM_SOURCE_AUTHORITY).toBe(2);
  });

  it('excludes requirements not yet in force on the effective date', async () => {
    const future = chunk({
      chunk_id: 'chunk-future',
      effective_date: '2027-01-01',
      keywords: ['business', 'registration'],
    });

    const result = await retrieveNovaEvidence(mockDb({ chunks: [future] }), {
      context: bahamas,
      queryRepresentation: 'business registration',
      filters: { effectiveOn: '2026-06-01' },
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks).toEqual([]);
    expect(result.coverage.exhaustedFilters).toContain('effective_on');
  });

  it('restricts to the requested regulatory domains', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business employment registration',
      filters: { regulatoryDomains: ['employment'] },
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.map((c) => c.chunkId)).toEqual(['chunk-2']);
  });
});

describe('Nova retrieval — coverage reporting', () => {
  it('names requested domains that returned nothing', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business registration',
      filters: { regulatoryDomains: ['business_registration', 'taxation'] },
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.coverage.emptyDomains).toContain('taxation');
    expect(result.coverage.emptyDomains).not.toContain('business_registration');
  });

  it('flags domains whose best available evidence is below Authority 4', async () => {
    const guidance = chunk({
      chunk_id: 'chunk-tax-guidance',
      knowledge_source_id: 'source-2',
      title: 'Taxation guidance',
      body: 'Guidance on business taxation registration.',
      source_authority: 3,
      legal_source_category: 'official_guidance',
      regulatory_domain: 'taxation',
      keywords: ['taxation', 'registration'],
    });

    const result = await retrieveNovaEvidence(mockDb({ chunks: [...defaultChunks, guidance] }), {
      context: bahamas,
      queryRepresentation: 'taxation registration',
      filters: { regulatoryDomains: ['taxation'] },
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.coverage.lowAuthorityDomains).toContain('taxation');
  });
});

describe('Nova retrieval — reproducibility', () => {
  it('persists every input K5 §12 needs to replay the run', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.reproducibility).toMatchObject({
      knowledgePackVersion: 'BS-2026.1',
      retrievalConfigVersion: NOVA_RETRIEVAL_CONFIG_VERSION,
      queryRepresentation: 'business registration',
      rankingConfigVersion: NOVA_RANKING_CONFIG_VERSION,
      embeddingIdentity: null,
    });
    expect(result.reproducibility.filters.minimumSourceAuthority).toBe(
      NOVA_MINIMUM_SOURCE_AUTHORITY,
    );
  });

  it('orders results strictly and breaks score ties by authority', async () => {
    // Identical lexical score; only Source Authority separates them.
    const lower = chunk({
      chunk_id: 'chunk-b-lower',
      knowledge_source_id: 'source-2',
      chunk_index: 5,
      source_authority: 4,
      legal_source_category: 'regulation',
      keywords: ['permit'],
      body: 'A permit is required.',
      title: null,
      regulatory_domain: 'permits',
    });
    const higher = chunk({
      chunk_id: 'chunk-a-higher',
      chunk_index: 6,
      source_authority: 5,
      legal_source_category: 'primary_legislation',
      keywords: ['permit'],
      body: 'A permit is required.',
      title: null,
      regulatory_domain: 'permits',
    });

    const result = await retrieveNovaEvidence(mockDb({ chunks: [lower, higher] }), {
      context: bahamas,
      queryRepresentation: 'permit',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.map((c) => c.chunkId)).toEqual(['chunk-a-higher', 'chunk-b-lower']);
    expect(result.chunks.map((c) => c.rank)).toEqual([1, 2]);
  });

  it('produces an identical ordered result set for identical input', async () => {
    const query = { context: bahamas, queryRepresentation: 'business employment' };
    const a = await retrieveNovaEvidence(mockDb({}), query);
    const b = await retrieveNovaEvidence(mockDb({}), query);

    if (a.status !== 'retrieved' || b.status !== 'retrieved') {
      throw new Error('expected retrieval runs');
    }
    expect(a.chunks.map((c) => [c.chunkId, c.rank, c.score])).toEqual(
      b.chunks.map((c) => [c.chunkId, c.rank, c.score]),
    );
  });
});

describe('Nova retrieval — trust boundaries', () => {
  it('carries Source Authority only, never claim-level trust dimensions', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business registration',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    for (const c of result.chunks) {
      expect(c).not.toHaveProperty('evidence_strength');
      expect(c).not.toHaveProperty('reasoning_confidence');
      expect(c).not.toHaveProperty('trust_level');
      expect(c).not.toHaveProperty('trust_score');
    }
  });

  it('gives every returned chunk a chunk_id', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: bahamas,
      queryRepresentation: 'business employment',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.every((c) => c.chunkId.length > 0)).toBe(true);
  });
});
