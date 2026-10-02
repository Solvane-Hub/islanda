import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { KnowledgeChunk, KnowledgePack, KnowledgeSource } from '@/types/knowledge';
import type { NovaRetrievalRun } from '@/services/nova/retrieval';

import { CitationIntegrityError } from '@/lib/knowledge/citation';
import { answerNovaQuestion, assembleAnswer, toEvidenceInput } from '@/services/nova/answer';
import type { NovaBusinessFacts } from '@/services/nova/business-awareness';
import { buildNovaContext } from '@/services/nova/context';
import { retrieveNovaEvidence } from '@/services/nova/retrieval';
import {
  SYNTHETIC_MANIFEST,
  ZZ_AMEND_IN_FORCE,
  ZZ_AMEND_NOT_IN_FORCE,
  ZZ_BASE,
  ZZ_CHUNKS,
  ZZ_KNOWLEDGE_VERSION,
  ZZ_PACK,
  ZZ_SOURCES,
} from '@/tests/fixtures/knowledge/synthetic-amendment-chain';

/**
 * Assistant Service orchestration.
 *
 * SYNTHETIC fixtures only — reserved country code 'ZZ'. No Bahamian legal
 * source material appears in these tests, in keeping with the G11
 * commercial-reuse gate.
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

const business = { id: 'biz-1', country_code: 'ZZ', industry: 'widgets' };
const context = buildNovaContext(business, { location: 'Example City' });

function request(question: string, overrides: Record<string, unknown> = {}) {
  return {
    context,
    question,
    queryRepresentation: question,
    manifest: SYNTHETIC_MANIFEST,
    ...overrides,
  };
}

async function loadRun(query: string): Promise<NovaRetrievalRun> {
  const result = await retrieveNovaEvidence(mockDb({}), {
    context: context.retrieval,
    queryRepresentation: query,
  });
  if (result.status !== 'retrieved') throw new Error('expected a retrieval run');
  return result;
}

describe('Assistant Service — three distinct outcomes', () => {
  it('reports no_published_knowledge with no envelope when no pack exists', async () => {
    const answer = await answerNovaQuestion(mockDb({ pack: null }), request('widget licence'));

    expect(answer.outcome).toBe('no_published_knowledge');
    // No agent ran, so there is genuinely no envelope to report. Manufacturing
    // one would require inventing a knowledge version that does not exist.
    expect(answer.envelope).toBeNull();
    expect(answer.knowledgeVersion).toBeNull();
    expect(answer.citations).toEqual([]);
  });

  it('reports no_matching_evidence when the pack holds nothing on the question', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('deep sea navigation charts'));

    expect(answer.outcome).toBe('no_matching_evidence');
    expect(answer.envelope?.status).toBe('NO_AUTHORITATIVE_INFORMATION_FOUND');
    expect(answer.envelope?.claims).toEqual([]);
    // A pack exists, so the version IS known — this is the distinction from the
    // case above, and it is what lets the two be worded differently.
    expect(answer.knowledgeVersion).toBe(ZZ_KNOWLEDGE_VERSION);
  });

  it('reports needs_clarification when the question is only stopwords', async () => {
    // 'shall' survives retrieval's tokeniser (three characters, present in the
    // chunk bodies) but is removed by the reasoner's stricter scoring
    // stopwords. So chunks come back and none of them can be matched — which is
    // a question problem, not a corpus problem.
    const answer = await answerNovaQuestion(mockDb({}), request('shall'));

    expect(answer.outcome).toBe('needs_clarification');
    expect(answer.envelope?.status).toBe('NEEDS_CLARIFICATION');
  });

  it('reports no_matching_evidence when the question has no tokens at all', async () => {
    // '???' yields no tokens, so retrieval returns zero chunks and the reasoner
    // never reaches its question check — the contract's §7 flow tests evidence
    // emptiness FIRST. Documented rather than worked around: the ordering is
    // the contract's, and a service-side pre-check would duplicate it.
    const answer = await answerNovaQuestion(mockDb({}), request('???'));

    expect(answer.outcome).toBe('no_matching_evidence');
    expect(answer.envelope?.status).toBe('NO_AUTHORITATIVE_INFORMATION_FOUND');
  });

  it('answers when evidence supports the question', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));

    expect(answer.outcome).toBe('answered');
    expect(answer.envelope?.status).toBe('OK');
    expect(answer.envelope?.claims.length).toBeGreaterThan(0);
  });
});

describe('Assistant Service — business-aware layer (P1)', () => {
  const facts: NovaBusinessFacts = {
    legalName: null,
    tradingName: null,
    businessType: null,
    industry: 'widgets',
    activities: null,
    productsServices: null,
    targetCustomers: null,
    location: 'Example City',
    stage: 'operating',
    operatingStatus: null,
    employeeCount: null,
    founderGoals: null,
  };

  it('attaches business context to an answered response when facts are supplied', async () => {
    const answer = await answerNovaQuestion(
      mockDb({}),
      request('widget licence', { business: facts }),
    );
    expect(answer.outcome).toBe('answered');
    expect(answer.businessContext).not.toBeNull();
    expect(answer.businessContext?.category).toBe('regulatory');
    expect(answer.businessContext?.knownFacts.map((f) => f.label)).toContain('Industry');
  });

  it('omits business context entirely when no facts are supplied', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));
    expect(answer.outcome).toBe('answered');
    expect(answer.businessContext).toBeNull();
  });

  it('never attaches business context to a no-pack refusal, even with facts', async () => {
    const answer = await answerNovaQuestion(
      mockDb({ pack: null }),
      request('widget licence', { business: facts }),
    );
    expect(answer.outcome).toBe('no_published_knowledge');
    expect(answer.businessContext).toBeNull();
  });
});

describe('Assistant Service — refusal propagation', () => {
  it('never produces claims on any refusal path', async () => {
    for (const q of ['deep sea navigation charts', '???']) {
      const answer = await answerNovaQuestion(mockDb({}), request(q));
      expect(answer.envelope?.claims ?? []).toEqual([]);
      expect(answer.citations).toEqual([]);
    }
  });

  it('names an unresolved gap on every refusal, including the no-pack case', async () => {
    const cases = [
      await answerNovaQuestion(mockDb({ pack: null }), request('widget licence')),
      await answerNovaQuestion(mockDb({}), request('deep sea navigation charts')),
      await answerNovaQuestion(mockDb({}), request('???')),
    ];

    for (const answer of cases) {
      expect(answer.unresolved.length).toBeGreaterThan(0);
      expect(answer.unresolved[0]?.why.length).toBeGreaterThan(0);
    }
  });

  it('distinguishes absence of knowledge from absence of a matching answer', async () => {
    const noPack = await answerNovaQuestion(mockDb({ pack: null }), request('widget licence'));
    const noMatch = await answerNovaQuestion(mockDb({}), request('deep sea navigation charts'));

    expect(noPack.unresolved[0]?.why).toContain('No Knowledge Pack is published');
    expect(noMatch.unresolved[0]?.why).not.toContain('No Knowledge Pack is published');
  });

  it('does not throw on any refusal — refusal is a designed output', async () => {
    await expect(
      answerNovaQuestion(mockDb({ pack: null }), request('widget licence')),
    ).resolves.toBeDefined();
    await expect(answerNovaQuestion(mockDb({}), request('???'))).resolves.toBeDefined();
  });
});

describe('Assistant Service — citation grounding', () => {
  it('materialises a citation for every claim from this run', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));

    expect(answer.citations.length).toBe(answer.envelope?.claims.length);
    for (const c of answer.citations) {
      expect(c.citations.length).toBeGreaterThan(0);
      for (const citation of c.citations) {
        expect(citation.chunk_id.length).toBeGreaterThan(0);
        expect(citation.knowledge_version).toBe(ZZ_KNOWLEDGE_VERSION);
      }
    }
  });

  it('binds each citation to the chunk the claim actually quoted', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));
    const claim = answer.envelope?.claims[0];
    const cited = answer.citations.find((c) => c.claimId === claim?.claimId);

    expect(cited?.citations[0]?.chunk_id).toBe(claim?.evidence[0]?.chunkId);
  });

  it('rejects a claim citing a chunk this run did not return', async () => {
    const run = await loadRun('widget licence');
    // Simulate a reasoner that cited a chunk retrieval never returned — the
    // exact failure the grounding gate exists to catch.
    const tampered: NovaRetrievalRun = {
      ...run,
      chunks: run.chunks.map((c, i) =>
        i === 0 ? { ...c, citation: { ...c.citation, chunk_id: 'chunk-never-retrieved' } } : c,
      ),
    };

    expect(() => assembleAnswer(tampered, request('widget licence'))).toThrow(
      CitationIntegrityError,
    );
  });

  it('records the knowledge version of the run on every citation', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));
    for (const c of answer.citations.flatMap((x) => x.citations)) {
      expect(c.knowledge_version).toBe(ZZ_KNOWLEDGE_VERSION);
    }
  });
});

describe('Assistant Service — evidence mapping across the layer boundary', () => {
  it('maps retrieved chunks into the agent input shape', async () => {
    const run = await loadRun('widget licence');
    const mapped = toEvidenceInput(run.chunks);

    expect(mapped).toHaveLength(run.chunks.length);
    expect(mapped[0]).toMatchObject({
      chunkId: run.chunks[0]?.chunkId,
      sourceAuthority: 5,
      rank: 1,
    });
  });

  it('does not hand the agent a pre-built citation', async () => {
    // An agent cites by chunk_id and nothing else (A12). Giving it a citation
    // object would let it emit one this run never produced.
    const run = await loadRun('widget licence');
    for (const mapped of toEvidenceInput(run.chunks)) {
      expect(mapped).not.toHaveProperty('citation');
      expect(mapped).not.toHaveProperty('score');
    }
  });

  it('preserves retrieval rank so claim order stays reproducible', async () => {
    const run = await loadRun('widget');
    const ranks = toEvidenceInput(run.chunks).map((m) => m.rank);
    expect(ranks).toEqual([...ranks].sort((a, b) => a - b));
  });
});

describe('Assistant Service — amendment metadata', () => {
  it('attaches no notice for an unamended provision', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('inspector premises'));

    expect(answer.outcome).toBe('answered');
    expect(answer.amendmentNotices).toEqual([]);
  });

  it('attaches a notice when the retrieved provision is amended', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));
    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 4');

    expect(notice).toBeDefined();
    expect(notice?.baseManifestId).toBe(ZZ_BASE);
    expect(notice?.amendments.map((a) => a.manifestId)).toEqual([ZZ_AMEND_IN_FORCE]);
  });

  it('establishes current applicability when every amendment is in force', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));
    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 4');

    expect(notice?.currentApplicabilityEstablished).toBe(true);
    expect(notice?.amendments[0]?.commencementEstablished).toBe(true);
  });

  it('refuses to establish current applicability when an amendment is not in force', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('annual widget return'));
    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 9');

    expect(notice).toBeDefined();
    expect(notice?.amendments.map((a) => a.manifestId).sort()).toEqual(
      [ZZ_AMEND_IN_FORCE, ZZ_AMEND_NOT_IN_FORCE].sort(),
    );
    expect(notice?.currentApplicabilityEstablished).toBe(false);
  });

  it('records an unresolved gap rather than stating an unestablished position', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('annual widget return'));

    // The claim is still returned — we do not refuse merely because an
    // amendment exists — but the current position is explicitly not stated.
    expect(answer.outcome).toBe('answered');
    expect(answer.envelope?.claims.length).toBeGreaterThan(0);
    expect(
      answer.unresolved.some((u) =>
        u.why.includes('current legal position is therefore not stated'),
      ),
    ).toBe(true);
  });

  it('names the specific instrument whose commencement is unestablished', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('annual widget return'));
    const gap = answer.unresolved.find((u) => u.why.includes('not stated'));

    expect(gap?.why).toContain('No. 2 of 2025');
  });

  it('never merges base and amending text into a synthetic consolidated provision', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('annual widget return'));

    // Every claim statement is a verbatim substring of the chunk it cites — its
    // OWN chunk, never a blend of two. This is the anti-fabrication invariant
    // that makes a synthetic consolidated provision impossible by construction.
    expect(answer.envelope?.claims.length).toBeGreaterThan(0);

    for (const claim of answer.envelope?.claims ?? []) {
      const citedChunkId = claim.evidence[0]?.chunkId;
      const cited = ZZ_CHUNKS.find((c) => c.chunk_id === citedChunkId);

      expect(cited, `claim cites unknown chunk ${citedChunkId}`).toBeDefined();
      expect(cited?.body).toContain(claim.content.statement);
    }
  });

  it('keeps base and amending instruments as separate claims, never one blended claim', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('annual widget return'));
    const chunkIds = (answer.envelope?.claims ?? []).map((c) => c.evidence[0]?.chunkId);

    // One claim per chunk, and each maps 1:1 to the source it came from.
    expect(new Set(chunkIds).size).toBe(chunkIds.length);
  });

  /**
   * ⚠ CHANGED DELIBERATELY, and in the safe direction.
   *
   * This previously asserted that a missing manifest "simply omits amendment
   * notices". That is the unsafe default: with no notice, a provision that has
   * been repealed renders identically to one that was never touched, and no
   * other gate in the system can tell the difference — the citation is sound
   * either way. A jurisdiction with no chronology knows LESS than one with an
   * empty amendment list, and must say so.
   */
  it('withholds the current position entirely when no manifest is registered', async () => {
    const answer = await answerNovaQuestion(
      mockDb({}),
      request('widget licence', { manifest: undefined }),
    );

    expect(answer.outcome).toBe('answered');
    expect(answer.amendmentNotices.length).toBeGreaterThan(0);
    expect(answer.amendmentNotices.every((n) => !n.currentApplicabilityEstablished)).toBe(true);
  });

  it('names the absent manifest as the reason, rather than staying silent', async () => {
    const answer = await answerNovaQuestion(
      mockDb({}),
      request('widget licence', { manifest: undefined }),
    );

    expect(answer.unresolved.some((u) => u.why.includes('No source manifest is registered'))).toBe(
      true,
    );
  });

  it('still delivers the grounded quotation without a manifest', async () => {
    // Withholding the legal POSITION is not the same as withholding the
    // evidence. The passage is still quoted, still cited, still verifiable.
    const answer = await answerNovaQuestion(
      mockDb({}),
      request('widget licence', { manifest: undefined }),
    );

    expect(answer.envelope?.claims.length).toBeGreaterThan(0);
    expect(answer.citations[0]?.citations.length).toBeGreaterThan(0);
  });
});

describe('Assistant Service — provenance carried through', () => {
  it('reports the pack and knowledge version of the run', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));

    expect(answer.packId).toBe(ZZ_PACK.id);
    expect(answer.knowledgeVersion).toBe(ZZ_KNOWLEDGE_VERSION);
  });

  it('carries the coverage signal from retrieval', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('deep sea navigation charts'));
    expect(answer.coverage.exhaustedFilters).toContain('lexical_match');
  });

  it('states that no model produced the answer', async () => {
    const answer = await answerNovaQuestion(mockDb({}), request('widget licence'));
    expect(answer.envelope?.modelVersion).toBe('none:deterministic-extractive');
  });
});
