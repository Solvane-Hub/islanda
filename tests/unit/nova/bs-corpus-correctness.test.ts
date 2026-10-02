import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  KnowledgeChunk,
  KnowledgePack,
  KnowledgeSource,
  KnowledgeSourceLegalStatus,
} from '@/types/knowledge';
import { retrieveNovaEvidence, type NovaRetrievalRun } from '@/services/nova/retrieval';
import { segmentLegalText } from '@/services/knowledge/segmentation';

/**
 * BS corpus correctness — legal-status retrieval semantics.
 *
 * Fixtures are SYNTHETIC (reserved country codes, invented bodies). They assert
 * the properties the real Bahamas corpus must have: an enacted-not-in-force
 * instrument (the Data Protection Act 2025) must never be served as current law,
 * an in-force base Act (DPA 2003) must be, amendment instruments modify rather
 * than replace, and staged packs stay invisible to Nova.
 */

function pack(overrides: Partial<KnowledgePack> = {}): KnowledgePack {
  return {
    id: 'pack-bs',
    country_code: 'BS',
    version: 'BS-v9.9',
    status: 'published',
    notes: null,
    published_at: '2026-01-01T00:00:00.000Z',
    published_by: 'reviewer',
    approval_note: null,
    superseded_at: null,
    superseded_by_id: null,
    commercial_publication_eligibility: 'cleared',
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function source(
  id: string,
  legalStatus: KnowledgeSourceLegalStatus,
  overrides: Partial<KnowledgeSource> = {},
): KnowledgeSource {
  return {
    id,
    knowledge_pack_id: 'pack-bs',
    manifest_id: id,
    agency: 'Government of The Bahamas',
    title: id,
    source_url: `https://laws.bahamas.gov.bs/${id}`,
    source_type: 'act',
    country_code: 'BS',
    region: null,
    municipality: null,
    source_authority: 5,
    legal_source_category: 'primary_legislation',
    publication_date: '2025-01-01',
    effective_date: null,
    expiry_date: null,
    last_reviewed_date: '2026-01-15',
    review_due_at: null,
    freshness_state: 'current',
    legal_status: legalStatus,
    accessed_at: '2026-01-20T00:00:00.000Z',
    content_hash: 'hash',
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
    knowledge_source_id: 'src',
    knowledge_pack_id: 'pack-bs',
    chunk_index: 0,
    title: 'Provision',
    body: 'A data controller shall protect personal data of individuals.',
    content_hash: 'chash',
    country_code: 'BS',
    section_reference: 'section 6',
    clause: null,
    page: null,
    source_authority: 5,
    legal_source_category: 'primary_legislation',
    industry: null,
    regulatory_domain: null,
    keywords: ['data', 'personal', 'controller', 'protect'],
    effective_date: null,
    chunk_version: 1,
    created_at: '2026-01-01T00:00:00.000Z',
    instrument_role: 'substantive',
    provision_id: 's.6',
    amends_provision: null,
    ...overrides,
  };
}

function mockDb(pk: KnowledgePack | null, chunks: KnowledgeChunk[], sources: KnowledgeSource[]) {
  const from = vi.fn((table: string) => {
    if (table === 'knowledge_packs') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pk, error: null }) }) }),
        }),
      };
    }
    if (table === 'knowledge_chunks') {
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: chunks, error: null }) }) }),
      };
    }
    if (table === 'knowledge_sources') {
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: sources, error: null }) }) }),
      };
    }
    throw new Error(`unexpected table ${table}`);
  });
  return { from } as unknown as SupabaseClient<Database>;
}

const query = (extra: Record<string, unknown> = {}) => ({
  context: { countryCode: 'BS' as const },
  queryRepresentation: 'data controller protect personal data',
  ...extra,
});

async function run(
  chunks: KnowledgeChunk[],
  sources: KnowledgeSource[],
  extra: Record<string, unknown> = {},
): Promise<NovaRetrievalRun> {
  const result = await retrieveNovaEvidence(mockDb(pack(), chunks, sources), query(extra));
  if (result.status !== 'retrieved') throw new Error('expected retrieved');
  return result;
}

describe('BS legal-status retrieval', () => {
  it('(1) treats an in-force instrument (DPA 2003) as current law — retrievable', async () => {
    const r = await run(
      [chunk({ chunk_id: 'dpa03', knowledge_source_id: 'dpa2003' })],
      [source('dpa2003', 'in_force')],
    );
    expect(r.chunks.map((c) => c.chunkId)).toContain('dpa03');
  });

  it('(4) treats a base_text_amended base Act (VAT Ch.370A) as current law', async () => {
    const r = await run(
      [chunk({ chunk_id: 'vat', knowledge_source_id: 'vatbase' })],
      [source('vatbase', 'base_text_amended')],
    );
    expect(r.chunks.map((c) => c.chunkId)).toContain('vat');
  });

  it('(2,3) never serves an enacted-not-in-force instrument (DPA 2025) as current law', async () => {
    const r = await run(
      [chunk({ chunk_id: 'dpa25', knowledge_source_id: 'dpa2025' })],
      [source('dpa2025', 'enacted_not_in_force', { title: 'Data Protection Act, 2025' })],
    );
    expect(r.chunks).toHaveLength(0);
    expect(r.excludedNotInForce.map((m) => m.legalStatus)).toContain('enacted_not_in_force');
    expect(r.excludedNotInForce.map((m) => m.title)).toContain('Data Protection Act, 2025');
  });

  it('surfaces the enacted-not-in-force instrument only for explicit future/commencement queries', async () => {
    const r = await run(
      [chunk({ chunk_id: 'dpa25', knowledge_source_id: 'dpa2025' })],
      [source('dpa2025', 'enacted_not_in_force')],
      { includeNotYetInForce: true },
    );
    expect(r.chunks.map((c) => c.chunkId)).toContain('dpa25');
    expect(r.excludedNotInForce).toHaveLength(0);
  });

  it('(6,7) a commenced amendment can be retrieved; an uncommenced one cannot', async () => {
    const commenced = await run(
      [
        chunk({
          chunk_id: 'amd-live',
          knowledge_source_id: 'amd-live',
          instrument_role: 'amending_instruction',
          amends_provision: 's.6',
          provision_id: null,
        }),
      ],
      [source('amd-live', 'in_force')],
    );
    expect(commenced.chunks.map((c) => c.chunkId)).toContain('amd-live');

    const uncommenced = await run(
      [
        chunk({
          chunk_id: 'amd-pending',
          knowledge_source_id: 'amd-pending',
          instrument_role: 'amending_instruction',
          amends_provision: 's.6',
          provision_id: null,
        }),
      ],
      [source('amd-pending', 'enacted_not_in_force')],
    );
    expect(uncommenced.chunks).toHaveLength(0);
  });

  it('(5) amendment instruments modify (amends_provision) rather than replace the base', async () => {
    const base = chunk({
      chunk_id: 'base',
      knowledge_source_id: 'vatbase',
      instrument_role: 'substantive',
      provision_id: 's.6',
    });
    const amd = chunk({
      chunk_id: 'amd',
      knowledge_source_id: 'amd',
      instrument_role: 'amending_instruction',
      amends_provision: 's.6',
      provision_id: null,
      section_reference: 'section 2',
    });
    const r = await run(
      [base, amd],
      [source('vatbase', 'base_text_amended'), source('amd', 'in_force')],
    );
    const amdChunk = r.chunks.find((c) => c.chunkId === 'amd');
    expect(amdChunk?.instrumentRole).toBe('amending_instruction');
    expect(amdChunk?.amendsProvision).toBe('s.6');
    // Substantive base ranks ahead of the amending instruction (never replaced by it).
    const baseRank = r.chunks.find((c) => c.chunkId === 'base')?.rank ?? 99;
    const amdRank = amdChunk?.rank ?? 0;
    expect(baseRank).toBeLessThan(amdRank);
  });

  it('(11,12) every retrieved chunk carries grounded provenance (chunk_id + citation)', async () => {
    const r = await run(
      [chunk({ chunk_id: 'p1', knowledge_source_id: 'dpa2003' })],
      [source('dpa2003', 'in_force')],
    );
    for (const c of r.chunks) {
      expect(c.chunkId).toBeTruthy();
      expect(c.citation.chunk_id).toBe(c.chunkId);
      expect(c.citation.url ?? c.sectionReference).toBeTruthy();
    }
  });

  it('(13,14) does not retrieve chunks from another jurisdiction', async () => {
    const r = await run(
      [
        chunk({ chunk_id: 'bs', knowledge_source_id: 'dpa2003', country_code: 'BS' }),
        chunk({ chunk_id: 'zz', knowledge_source_id: 'dpa2003', country_code: 'ZZ' }),
      ],
      [source('dpa2003', 'in_force')],
    );
    const ids = r.chunks.map((c) => c.chunkId);
    expect(ids).toContain('bs');
    expect(ids).not.toContain('zz');
  });

  it('(16) a staged (not published) pack is invisible to Nova', async () => {
    // findPublishedPack filters status='published'; a staged pack returns null here.
    const result = await retrieveNovaEvidence(mockDb(null, [], []), query());
    expect(result.status).toBe('no_published_knowledge');
  });
});

describe('BS segmentation correctness (no fabricated content)', () => {
  it('(15) every emitted chunk body appears verbatim in the source text', () => {
    const src = [
      'Enacted by the Parliament of The Bahamas',
      '1. Short title.',
      'This Act may be cited as the Sample Act, and its body must be verbatim from source.',
      '2. Interpretation.',
      'In this Act, a defined term carries the meaning verbatim assigned to it here in the text.',
    ].join('\n');
    const r = segmentLegalText(src, { kind: 'substantive_act' });
    if (r.outcome !== 'segmented') throw new Error('expected segmented');
    const normalize = (s: string) => s.replace(/\s+/g, ' ').trim();
    const haystack = normalize(src);
    for (const c of r.chunks) {
      expect(haystack).toContain(normalize(c.draft.body));
    }
  });

  it('(8) the Arrangement of Sections is never emitted as a substantive provision', () => {
    const src = [
      'ARRANGEMENT OF SECTIONS',
      '1. Short title...........................................................1',
      '2. Interpretation.......................................................1',
      'Enacted by the Parliament of The Bahamas',
      '1. Short title.',
      'This Act may be cited as the Sample Act, with a body long enough to be substantive.',
    ].join('\n');
    const r = segmentLegalText(src, { kind: 'substantive_act' });
    if (r.outcome !== 'segmented') throw new Error('expected segmented');
    // The only emitted chunk is the real body, not the dot-leader TOC entries.
    expect(r.chunks).toHaveLength(1);
    expect(r.chunks[0]!.draft.body).toContain('cited as the Sample Act');
    expect(r.chunks.every((c) => !/\.{3,}/.test(c.draft.body))).toBe(true);
  });
});
