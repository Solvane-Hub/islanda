import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeChunk, KnowledgePack, KnowledgeSource } from '@/types/knowledge';

import { answerNovaQuestion } from '@/services/nova/answer';
import { buildNovaContext } from '@/services/nova/context';
import { retrieveNovaEvidence } from '@/services/nova/retrieval';
import {
  SYNTHETIC_MANIFEST,
  ZZ_AMEND_IN_FORCE,
  ZZ_AMEND_NOT_IN_FORCE,
  ZZ_CHUNKS,
  ZZ_ORPHAN_CHUNK,
  ZZ_ORPHAN_SOURCE,
  ZZ_PACK,
  ZZ_SOURCES,
} from '@/tests/fixtures/knowledge/synthetic-amendment-chain';

/**
 * Corpus integrity — the three silent, unsafe-direction failures from the
 * Nova v0.1 review (§6.1–§6.4).
 *
 * Each of these fails by making a caveat DISAPPEAR, which is why none of them
 * is caught by grounding, citation binding, or the envelope gate. They have to
 * be caught here.
 *
 * SYNTHETIC fixtures only — reserved country code 'ZZ' (G11).
 */

function mockDb(params: {
  pack?: KnowledgePack | null;
  chunks?: KnowledgeChunk[];
  sources?: KnowledgeSource[];
}): SupabaseClient<Database> {
  const pack = params.pack === undefined ? ZZ_PACK : params.pack;
  const chunks = params.chunks ?? ZZ_CHUNKS;
  const sources = params.sources ?? ZZ_SOURCES;

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

function ask(question: string, db = mockDb({})) {
  return answerNovaQuestion(db, {
    context,
    question,
    queryRepresentation: question,
    manifest: SYNTHETIC_MANIFEST,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// §6.1 — amending instructions must never lead an answer
// ─────────────────────────────────────────────────────────────────────────────

describe('instrument role — substantive text outranks edit instructions', () => {
  it('the amending chunk genuinely out-scores the substantive one', async () => {
    // Establishes that this test is testing something: on pure relevance the
    // edit instruction wins, because it repeats the section number and the
    // operative words.
    const substantiveOnly = ZZ_CHUNKS.filter((c) => c.instrument_role === 'substantive').map(
      (c) => ({ ...c, instrument_role: 'substantive' as const }),
    );
    const amendingAsSubstantive = ZZ_CHUNKS.filter((c) => c.chunk_id === 'zz-chunk-amend-a-s4').map(
      (c) => ({ ...c, instrument_role: 'substantive' as const }),
    );

    const result = await retrieveNovaEvidence(
      mockDb({ chunks: [...substantiveOnly, ...amendingAsSubstantive] }),
      { context: context.retrieval, queryRepresentation: 'widget licence current valid' },
    );

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks[0]?.chunkId).toBe('zz-chunk-amend-a-s4');
  });

  it('ranks it BELOW the substantive provision once the role is honest', async () => {
    // topK raised so the ordering is what is under test, not the cut-off.
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: context.retrieval,
      queryRepresentation: 'widget licence current valid',
      topK: 10,
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    const ids = result.chunks.map((c) => c.chunkId);

    expect(ids[0]).toBe('zz-chunk-s4');
    expect(ids.indexOf('zz-chunk-amend-a-s4')).toBeGreaterThan(ids.indexOf('zz-chunk-s4'));
  });

  it('does not quote an edit instruction as the leading claim', async () => {
    const answer = await ask('widget licence current valid');
    const leading = answer.envelope?.claims[0]?.content.statement ?? '';

    expect(leading).not.toContain('is amended by the deletion');
  });

  it('still retrieves amending instructions — they are evidence, not noise', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: context.retrieval,
      queryRepresentation: 'widget licence current valid',
      topK: 10,
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.map((c) => c.chunkId)).toContain('zz-chunk-amend-a-s4');
  });

  it('lets substantive matches push an amending instruction out of a small topK', async () => {
    // Accepted consequence of role-first ranking, recorded rather than left to
    // surprise someone. It costs nothing: the amendment NOTICE is built from
    // manifest metadata, not from retrieving the amending chunk.
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: context.retrieval,
      queryRepresentation: 'widget licence current valid',
      topK: 5,
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    expect(result.chunks.map((c) => c.chunkId)).not.toContain('zz-chunk-amend-a-s4');
    expect(result.chunks.every((c) => c.instrumentRole === 'substantive')).toBe(true);
  });

  it('carries the role and the amended target through retrieval', async () => {
    const result = await retrieveNovaEvidence(mockDb({}), {
      context: context.retrieval,
      queryRepresentation: 'widget licence current valid',
      topK: 10,
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    const amending = result.chunks.find((c) => c.chunkId === 'zz-chunk-amend-a-s4');

    expect(amending?.instrumentRole).toBe('amending_instruction');
    expect(amending?.amendsProvision).toBe('s.4');
  });

  it('ranks an unclassified chunk last — it may not lead an answer', async () => {
    const unknown: KnowledgeChunk = {
      ...ZZ_CHUNKS[0]!,
      chunk_id: 'zz-chunk-legacy',
      instrument_role: 'unknown',
      keywords: ['widget', 'licence', 'current', 'valid', 'unclassified'],
    };

    const result = await retrieveNovaEvidence(mockDb({ chunks: [...ZZ_CHUNKS, unknown] }), {
      context: context.retrieval,
      queryRepresentation: 'widget licence current valid unclassified',
    });

    if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
    const ids = result.chunks.map((c) => c.chunkId);
    expect(ids[0]).not.toBe('zz-chunk-legacy');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6.3 — subsection to parent-section amendment matching
// ─────────────────────────────────────────────────────────────────────────────

describe('canonical provision matching — a subsection inherits its section', () => {
  it('attaches a section-level amendment to a retrieved subsection', async () => {
    // The manifest amends `section 9`. The chunk is labelled `section 9(1)`.
    // Display-string matching found nothing here and presented amended text
    // as settled.
    const answer = await ask('prescribed widget return form thirty days');
    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 9(1)');

    expect(notice).toBeDefined();
    expect(notice?.amendments.map((a) => a.manifestId).sort()).toEqual(
      [ZZ_AMEND_IN_FORCE, ZZ_AMEND_NOT_IN_FORCE].sort(),
    );
  });

  it('withholds the current position on the subsection too', async () => {
    const answer = await ask('prescribed widget return form thirty days');
    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 9(1)');

    expect(notice?.currentApplicabilityEstablished).toBe(false);
    expect(answer.unresolved.some((u) => u.why.includes('not stated'))).toBe(true);
  });

  it('still attaches nothing to a genuinely unamended provision', async () => {
    const answer = await ask('inspector premises business hours');
    expect(answer.amendmentNotices).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6.4 — a chunk with no provision reference must not read as unamended
// ─────────────────────────────────────────────────────────────────────────────

describe('missing provision reference — explicit, never silent', () => {
  it('emits a notice that establishes nothing', async () => {
    const answer = await ask('widget means mechanical contrivance interpretation');
    const notice = answer.amendmentNotices.find((n) => n.claimId);

    expect(answer.outcome).toBe('answered');
    expect(notice).toBeDefined();
    expect(notice?.currentApplicabilityEstablished).toBe(false);
  });

  it('names the gap rather than dropping it', async () => {
    const answer = await ask('widget means mechanical contrivance interpretation');

    expect(answer.unresolved.some((u) => u.why.includes('no provision reference'))).toBe(true);
  });

  it('still delivers the quoted passage — the citation is sound', async () => {
    const answer = await ask('widget means mechanical contrivance interpretation');
    const claim = answer.envelope?.claims[0];

    expect(claim?.content.statement.length).toBeGreaterThan(0);
    expect(answer.citations[0]?.citations[0]?.chunk_id).toBe(claim?.evidence[0]?.chunkId);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// §6.2 — the manifest join is stable, and fails closed
// ─────────────────────────────────────────────────────────────────────────────

describe('manifest join — by stable key, failing closed', () => {
  it('resolves a source through manifest_id, not through its URL', async () => {
    // A changed government URL must not detach a source from its amendments.
    const movedUrl = ZZ_SOURCES.map((s) =>
      s.manifest_id === 'ZZ-WIDGET-ACT-BASE'
        ? { ...s, source_url: 'https://example.invalid/moved-to-a-new-address' }
        : s,
    );

    const answer = await ask('annual widget return', mockDb({ sources: movedUrl }));

    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 9');
    expect(notice).toBeDefined();
    expect(notice?.amendments.length).toBeGreaterThan(0);
  });

  it('withholds the position when the source is not in the manifest', async () => {
    const answer = await ask(
      'orphaned widget provision',
      mockDb({ chunks: [ZZ_ORPHAN_CHUNK], sources: [ZZ_ORPHAN_SOURCE] }),
    );

    expect(answer.outcome).toBe('answered');
    expect(answer.amendmentNotices[0]?.currentApplicabilityEstablished).toBe(false);
  });

  it('names the integrity problem rather than implying no amendments', async () => {
    const answer = await ask(
      'orphaned widget provision',
      mockDb({ chunks: [ZZ_ORPHAN_CHUNK], sources: [ZZ_ORPHAN_SOURCE] }),
    );

    expect(
      answer.unresolved.some((u) => u.why.includes('could not be matched to the Knowledge Pack')),
    ).toBe(true);
  });

  it('does not refuse the answer — the quotation is still grounded', async () => {
    const answer = await ask(
      'orphaned widget provision',
      mockDb({ chunks: [ZZ_ORPHAN_CHUNK], sources: [ZZ_ORPHAN_SOURCE] }),
    );

    expect(answer.envelope?.claims.length).toBeGreaterThan(0);
    expect(answer.citations[0]?.citations.length).toBeGreaterThan(0);
  });
});
