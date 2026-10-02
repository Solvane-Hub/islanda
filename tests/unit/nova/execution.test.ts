import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgePack } from '@/types/knowledge';

import { answerNovaQuestion } from '@/services/nova/answer';
import { buildNovaContext } from '@/services/nova/context';
import {
  executionEntryForAnswer,
  executionEntryForFailure,
  hashQueryRepresentation,
} from '@/services/nova/execution';
import {
  SYNTHETIC_MANIFEST,
  ZZ_CHUNKS,
  ZZ_KNOWLEDGE_VERSION,
  ZZ_PACK,
  ZZ_SOURCES,
} from '@/tests/fixtures/knowledge/synthetic-amendment-chain';

/**
 * Reproducibility records.
 *
 * Two properties matter, and they pull against each other:
 *   • a historical answer must be IDENTIFIABLE — which pack, which config;
 *   • no founder question, legal text or generated content may be stored.
 *
 * SYNTHETIC fixtures only (G11).
 */

function mockDb(pack: KnowledgePack | null = ZZ_PACK): SupabaseClient<Database> {
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
        select: () => ({ eq: () => ({ order: async () => ({ data: ZZ_CHUNKS, error: null }) }) }),
      };
    }
    if (table === 'knowledge_sources') {
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: ZZ_SOURCES, error: null }) }) }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

const context = buildNovaContext({ id: 'biz-1', country_code: 'ZZ', industry: 'widgets' }, null);

async function answerFor(question: string, pack: KnowledgePack | null = ZZ_PACK) {
  return answerNovaQuestion(mockDb(pack), {
    context,
    question,
    queryRepresentation: question,
    manifest: SYNTHETIC_MANIFEST,
  });
}

function entryFor(question: string, pack: KnowledgePack | null = ZZ_PACK) {
  return answerFor(question, pack).then((answer) =>
    executionEntryForAnswer({
      answer,
      businessId: 'biz-1',
      actorId: 'user-1',
      correlationId: '11111111-1111-4111-8111-111111111111',
      queryRepresentation: question,
    }),
  );
}

describe('query representation hashing', () => {
  it('is deterministic', () => {
    expect(hashQueryRepresentation('widget licence')).toBe(
      hashQueryRepresentation('widget licence'),
    );
  });

  it('differs for different queries', () => {
    expect(hashQueryRepresentation('widget licence')).not.toBe(
      hashQueryRepresentation('widget return'),
    );
  });

  it('does not contain the query', () => {
    const hash = hashQueryRepresentation('do I need a widget licence in Example City');
    expect(hash).not.toContain('widget');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });
});

describe('execution entry — reproducibility is identifiable', () => {
  it('records the knowledge pack and version used', async () => {
    const entry = await entryFor('widget licence');

    expect(entry.knowledgePackId).toBe(ZZ_PACK.id);
    expect(entry.knowledgeVersion).toBe(ZZ_KNOWLEDGE_VERSION);
  });

  it('records the retrieval and ranking config versions', async () => {
    const entry = await entryFor('widget licence');

    expect(entry.retrievalConfigVersion).toBe('nova-lexical@1.0.0');
    expect(entry.rankingConfigVersion).toBe('nova-lexical-rank@1.0.0');
  });

  it('records the deterministic filters that were applied', async () => {
    const entry = await entryFor('widget licence');

    expect(entry.retrievalFilters).toMatchObject({
      knowledgePackVersion: ZZ_KNOWLEDGE_VERSION,
      minimumSourceAuthority: 2,
    });
  });

  it('records the ORDERED chunk ids — the order is part of the contract', async () => {
    const answer = await answerFor('widget licence');
    const entry = await entryFor('widget licence');

    expect(entry.retrievedChunkIds).toEqual(answer.retrievedChunkIds);
    expect((entry.retrievedChunkIds ?? []).length).toBeGreaterThan(0);
  });

  it('states that no embedding participated rather than leaving it unknown', async () => {
    const entry = await entryFor('widget licence');
    expect(entry.embeddingIdentity).toBeNull();
  });

  it('records the agent, prompt and model identity', async () => {
    const entry = await entryFor('widget licence');

    expect(entry.agent).toBe('nova');
    expect(entry.promptVersion).toBe('nova-extractive@1.0.0');
    expect(entry.modelVersion).toBe('none:deterministic-extractive');
  });

  it('records outcome and counts for a refusal too', async () => {
    const entry = await entryFor('deep sea navigation charts');

    expect(entry.outcome).toBe('no_matching_evidence');
    expect(entry.claimCount).toBe(0);
    expect(entry.unresolvedCount).toBeGreaterThan(0);
  });

  it('records a no-pack run with no reproducibility inputs, not fabricated ones', async () => {
    const entry = await entryFor('widget licence', null);

    expect(entry.outcome).toBe('no_published_knowledge');
    expect(entry.knowledgePackId).toBeNull();
    expect(entry.knowledgeVersion).toBeNull();
    expect(entry.retrievalConfigVersion).toBeNull();
    expect(entry.retrievedChunkIds).toEqual([]);
  });
});

describe('execution entry — carries no content', () => {
  it('does not contain the founder question', async () => {
    const question = 'do I need a widget licence for my stall';
    const answer = await answerFor(question);
    const entry = executionEntryForAnswer({
      answer,
      businessId: 'biz-1',
      actorId: 'user-1',
      correlationId: '11111111-1111-4111-8111-111111111111',
      queryRepresentation: question,
    });

    expect(JSON.stringify(entry)).not.toContain('stall');
    expect(JSON.stringify(entry)).not.toContain(question);
  });

  it('does not contain retrieved legal text', async () => {
    const entry = await entryFor('widget licence');
    const serialised = JSON.stringify(entry);

    for (const chunk of ZZ_CHUNKS) {
      expect(serialised).not.toContain(chunk.body);
    }
  });

  it('does not contain any generated statement', async () => {
    const answer = await answerFor('widget licence');
    const entry = await entryFor('widget licence');
    const serialised = JSON.stringify(entry);

    for (const claim of answer.envelope?.claims ?? []) {
      expect(serialised).not.toContain(claim.content.statement);
    }
  });

  it('records a failure without any content either', () => {
    const entry = executionEntryForFailure({
      businessId: 'biz-1',
      actorId: 'user-1',
      correlationId: '11111111-1111-4111-8111-111111111111',
      queryRepresentation: 'a sensitive question about my business',
    });

    expect(entry.outcome).toBe('error');
    expect(JSON.stringify(entry)).not.toContain('sensitive');
    expect(entry.queryRepresentationHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
