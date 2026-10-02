import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeChunk, KnowledgePack, KnowledgeSource } from '@/types/knowledge';

import { answerNovaQuestion } from '@/services/nova/answer';
import { buildNovaContext } from '@/services/nova/context';
import { toNovaAnswerView } from '@/services/nova/view';
import {
  SYNTHETIC_MANIFEST,
  ZZ_CHUNKS,
  ZZ_KNOWLEDGE_VERSION,
  ZZ_PACK,
  ZZ_SOURCES,
} from '@/tests/fixtures/knowledge/synthetic-amendment-chain';

/**
 * The presentation projection.
 *
 * The tests that matter here are the ones about what the view CANNOT carry.
 * SYNTHETIC fixtures only — no Bahamian legal source material (G11).
 */

function mockDb(pack: KnowledgePack | null = ZZ_PACK): SupabaseClient<Database> {
  const chunks: KnowledgeChunk[] = ZZ_CHUNKS;
  const sources: KnowledgeSource[] = ZZ_SOURCES;

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
        select: () => ({ eq: () => ({ order: async () => ({ data: chunks, error: null }) }) }),
      };
    }
    if (table === 'knowledge_sources') {
      return {
        select: () => ({ eq: () => ({ order: async () => ({ data: sources, error: null }) }) }),
      };
    }
    throw new Error(`Unexpected table: ${table}`);
  });

  return { from } as unknown as SupabaseClient<Database>;
}

const context = buildNovaContext({ id: 'biz-1', country_code: 'ZZ', industry: 'widgets' }, null);

async function view(question: string, pack: KnowledgePack | null = ZZ_PACK) {
  const answer = await answerNovaQuestion(mockDb(pack), {
    context,
    question,
    queryRepresentation: question,
    manifest: SYNTHETIC_MANIFEST,
  });
  return toNovaAnswerView(answer, question);
}

describe('toNovaAnswerView — what it refuses to carry', () => {
  it('does not expose the envelope', async () => {
    const v = await view('widget licence');
    expect(v).not.toHaveProperty('envelope');
  });

  it('does not expose the machine-facing reasoning string', async () => {
    // ADR-0017 §5: "never rendered to a founder". A view model that cannot
    // carry it is a stronger guarantee than a component that chooses not to.
    const v = await view('widget licence');
    expect(JSON.stringify(v)).not.toContain('Extractive selection');
  });

  it('does not expose model or prompt versions', async () => {
    const serialised = JSON.stringify(await view('widget licence'));
    expect(serialised).not.toContain('none:deterministic-extractive');
    expect(serialised).not.toContain('nova-extractive@');
  });

  it('carries no claim-level trust dimensions', async () => {
    const serialised = JSON.stringify(await view('widget licence'));
    for (const forbidden of ['trustLevel', 'trustScore', 'evidenceStrength', 'reasoningHops']) {
      expect(serialised).not.toContain(forbidden);
    }
  });
});

describe('toNovaAnswerView — what it must carry', () => {
  it('carries the question that was asked', async () => {
    expect((await view('widget licence')).question).toBe('widget licence');
  });

  it('carries each claim as a verbatim statement with its citations', async () => {
    const v = await view('widget licence');

    expect(v.outcome).toBe('answered');
    expect(v.claims.length).toBeGreaterThan(0);

    for (const claim of v.claims) {
      expect(claim.statement.length).toBeGreaterThan(0);
      expect(claim.citations.length).toBeGreaterThan(0);
      expect(claim.citations[0]?.chunkId.length).toBeGreaterThan(0);
      expect(claim.citations[0]?.knowledgeVersion).toBe(ZZ_KNOWLEDGE_VERSION);
    }
  });

  it('keeps every statement a verbatim substring of its cited chunk', async () => {
    const v = await view('widget licence');

    for (const claim of v.claims) {
      const cited = ZZ_CHUNKS.find((c) => c.chunk_id === claim.citations[0]?.chunkId);
      expect(cited?.body).toContain(claim.statement);
    }
  });

  it('carries unresolved items through to the view', async () => {
    const v = await view('annual widget return');
    expect(v.unresolved.length).toBeGreaterThan(0);
  });

  it('carries the knowledge version so the answer can be dated', async () => {
    expect((await view('widget licence')).knowledgeVersion).toBe(ZZ_KNOWLEDGE_VERSION);
  });
});

describe('toNovaAnswerView — amendment applicability', () => {
  it('marks an unamended provision as established', async () => {
    const v = await view('inspector premises');
    const claim = v.claims[0];

    expect(claim?.amendments).toEqual([]);
    // No amendment touches it, so there is nothing to withhold.
    expect(claim?.currentApplicabilityEstablished).toBe(true);
  });

  it('withholds the current position when an amendment is not in force', async () => {
    const v = await view('annual widget return');
    const claim = v.claims.find((c) => c.amendments.length > 1);

    expect(claim).toBeDefined();
    expect(claim?.currentApplicabilityEstablished).toBe(false);
    expect(claim?.amendments.some((a) => !a.commencementEstablished)).toBe(true);
  });

  it('names each amending instrument without asserting an outcome', async () => {
    const v = await view('annual widget return');
    const claim = v.claims.find((c) => c.amendments.length > 1);

    for (const a of claim?.amendments ?? []) {
      expect(a.title.length).toBeGreaterThan(0);
      // The view records status; it never composes a sentence about it.
      expect(a).not.toHaveProperty('summary');
      expect(a).not.toHaveProperty('effect');
    }
  });
});

describe('toNovaAnswerView — refusal outcomes', () => {
  it('projects no_published_knowledge with no claims and a stated gap', async () => {
    const v = await view('widget licence', null);

    expect(v.outcome).toBe('no_published_knowledge');
    expect(v.claims).toEqual([]);
    expect(v.knowledgeVersion).toBeNull();
    expect(v.unresolved.length).toBeGreaterThan(0);
  });

  it('projects no_matching_evidence distinctly from no_published_knowledge', async () => {
    const v = await view('deep sea navigation charts');

    expect(v.outcome).toBe('no_matching_evidence');
    expect(v.claims).toEqual([]);
    // A pack exists, so the version is known — that is the difference.
    expect(v.knowledgeVersion).toBe(ZZ_KNOWLEDGE_VERSION);
  });
});
