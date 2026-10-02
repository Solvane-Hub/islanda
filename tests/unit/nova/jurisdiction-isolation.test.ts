import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeChunk, KnowledgePack, KnowledgeSource } from '@/types/knowledge';

import { answerNovaQuestion } from '@/services/nova/answer';
import { buildNovaContext } from '@/services/nova/context';
import { retrieveNovaEvidence } from '@/services/nova/retrieval';
import {
  ZZ_CHUNKS,
  ZZ_PACK,
  ZZ_SOURCES,
} from '@/tests/fixtures/knowledge/synthetic-amendment-chain';

/**
 * Jurisdiction isolation through the normal Nova path.
 *
 * The database half now lives in RLS (migration 20260825000000) and is proven by
 * `tests/rls/knowledge-jurisdiction.test.ts`, which needs a real project. These
 * tests cover the application half: even handed a database that leaks — exactly
 * what the old policy did — the Nova path must not surface another
 * jurisdiction's law.
 *
 * Two layers, tested separately, because the whole point of adding the RLS layer
 * was that one layer is not enough.
 *
 * SYNTHETIC fixtures only (G11). 'ZZ' and 'XX' are reserved codes.
 */

const XX_SOURCE: KnowledgeSource = {
  ...ZZ_SOURCES[0]!,
  id: 'xx-source',
  knowledge_pack_id: 'xx-pack',
  country_code: 'XX',
  manifest_id: 'XX-FOREIGN-ACT',
  title: 'Example Foreign Widget Act (SYNTHETIC)',
  source_url: 'https://example.invalid/foreign-widget-act',
};

const XX_CHUNK: KnowledgeChunk = {
  ...ZZ_CHUNKS[0]!,
  chunk_id: 'xx-chunk-s4',
  knowledge_source_id: 'xx-source',
  knowledge_pack_id: 'xx-pack',
  country_code: 'XX',
  body: 'A person shall hold a foreign widget licence before operating a widget abroad.',
  keywords: ['widget', 'licence', 'foreign'],
};

/**
 * A deliberately LEAKY stub: it returns rows from both jurisdictions for any
 * pack id, simulating the RLS hole this migration closed. If the application
 * filter regressed, these tests fail.
 */
function leakyDb(pack: KnowledgePack): SupabaseClient<Database> {
  const from = vi.fn((table: string) => {
    if (table === 'knowledge_packs') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: pack, error: null }) }) }),
        }),
      };
    }
    if (table === 'knowledge_chunks') {
      return {
        select: () => ({
          eq: () => ({
            order: async () => ({ data: [...ZZ_CHUNKS, XX_CHUNK], error: null }),
          }),
        }),
      };
    }
    if (table === 'knowledge_sources') {
      return {
        select: () => ({
          eq: () => ({ order: async () => ({ data: [...ZZ_SOURCES, XX_SOURCE], error: null }) }),
        }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

const zzContext = buildNovaContext({ id: 'biz-zz', country_code: 'ZZ', industry: 'widgets' }, null);

describe('jurisdiction isolation — the Nova path never surfaces foreign law', () => {
  it('excludes foreign chunks even when the database returns them', async () => {
    const result = await retrieveNovaEvidence(leakyDb(ZZ_PACK), {
      context: zzContext.retrieval,
      queryRepresentation: 'widget licence foreign',
      topK: 20,
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.map((c) => c.chunkId)).not.toContain('xx-chunk-s4');
  });

  it('surfaces no foreign text in any claim', async () => {
    const answer = await answerNovaQuestion(leakyDb(ZZ_PACK), {
      context: zzContext,
      question: 'widget licence foreign',
      queryRepresentation: 'widget licence foreign',
    });

    const serialised = JSON.stringify(answer);
    expect(serialised).not.toContain('foreign widget licence');
    expect(serialised).not.toContain('xx-chunk-s4');
  });

  it('cites no foreign source', async () => {
    const answer = await answerNovaQuestion(leakyDb(ZZ_PACK), {
      context: zzContext,
      question: 'widget licence foreign',
      queryRepresentation: 'widget licence foreign',
    });

    for (const claim of answer.citations) {
      for (const citation of claim.citations) {
        expect(citation.document).not.toContain('Foreign');
        expect(citation.url).not.toContain('foreign');
      }
    }
  });

  it('records the exhausted jurisdiction filter when everything is foreign', async () => {
    const foreignOnly = vi.fn((table: string) => {
      if (table === 'knowledge_packs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: ZZ_PACK, error: null }) }),
            }),
          }),
        };
      }
      if (table === 'knowledge_chunks') {
        return {
          select: () => ({
            eq: () => ({ order: async () => ({ data: [XX_CHUNK], error: null }) }),
          }),
        };
      }
      if (table === 'knowledge_sources') {
        return {
          select: () => ({
            eq: () => ({ order: async () => ({ data: [XX_SOURCE], error: null }) }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    });

    const result = await retrieveNovaEvidence(
      { from: foreignOnly } as unknown as SupabaseClient<Database>,
      { context: zzContext.retrieval, queryRepresentation: 'widget licence foreign' },
    );

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks).toEqual([]);
    expect(result.coverage.exhaustedFilters).toContain('jurisdiction:country_code');
  });

  it('refuses rather than answering from another jurisdiction', async () => {
    const foreignOnly = vi.fn((table: string) => {
      if (table === 'knowledge_packs') {
        return {
          select: () => ({
            eq: () => ({
              eq: () => ({ maybeSingle: async () => ({ data: ZZ_PACK, error: null }) }),
            }),
          }),
        };
      }
      if (table === 'knowledge_chunks') {
        return {
          select: () => ({
            eq: () => ({ order: async () => ({ data: [XX_CHUNK], error: null }) }),
          }),
        };
      }
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: [XX_SOURCE], error: null }) }) }),
      };
    });

    const answer = await answerNovaQuestion(
      { from: foreignOnly } as unknown as SupabaseClient<Database>,
      {
        context: zzContext,
        question: 'widget licence foreign',
        queryRepresentation: 'widget licence foreign',
      },
    );

    expect(answer.outcome).toBe('no_matching_evidence');
    expect(answer.envelope?.claims).toEqual([]);
  });
});
