import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

import { answerNovaQuestion } from '@/services/nova/answer';
import { buildNovaContext, buildQueryRepresentation } from '@/services/nova/context';
import { toNovaAnswerView } from '@/services/nova/view';
import { manifestForJurisdiction } from '@/services/knowledge/manifests/registry';
import { isSyntheticCorpus } from '@/lib/knowledge/jurisdiction';
import {
  DEMO_ZZ_BUSINESS_INDUSTRY,
  DEMO_ZZ_COUNTRY_CODE,
} from '@/services/knowledge/manifests/demo-zz';
import {
  ZZ_CHUNKS,
  ZZ_PACK,
  ZZ_SOURCES,
} from '@/tests/fixtures/knowledge/synthetic-amendment-chain';

/**
 * The demonstration, end to end.
 *
 * These are the paths an advisor will actually see tomorrow, exercised through
 * the real service with the real registry — not with a manifest handed in by the
 * test. That distinction is the point of several of these cases: the manifest
 * previously existed and was never reached from the running product, so the
 * amendment machinery was correct and invisible.
 *
 * SYNTHETIC corpus only (G11).
 */

function mockDb(): SupabaseClient<Database> {
  const from = vi.fn((table: string) => {
    if (table === 'knowledge_packs') {
      return {
        select: () => ({
          eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: ZZ_PACK, error: null }) }) }),
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

const business = {
  id: 'biz-demo',
  country_code: DEMO_ZZ_COUNTRY_CODE,
  industry: DEMO_ZZ_BUSINESS_INDUSTRY,
};

/**
 * Ask exactly the way the server action asks.
 *
 * The manifest is resolved from the REGISTRY by the business's jurisdiction, so
 * these tests fail if the wiring is removed — which is the regression that
 * matters.
 */
async function ask(question: string) {
  const manifest = manifestForJurisdiction(business.country_code);

  return answerNovaQuestion(mockDb(), {
    context: buildNovaContext(business, null),
    question,
    queryRepresentation: buildQueryRepresentation(question, business, null),
    ...(manifest ? { manifest } : {}),
    topK: 6,
  });
}

const GOLDEN = 'What licence do I need to sell prepared food?';
const AMENDED = 'When must I submit an annual return?';
const RECORDS = 'What records am I required to keep?';
const REGISTRATION = 'When do I have to register my business?';
const OUT_OF_CORPUS = 'What is the VAT rate in The Bahamas?';

describe('golden path — a supported question is answered from quoted evidence', () => {
  it('answers rather than refusing', async () => {
    const answer = await ask(GOLDEN);
    expect(answer.outcome).toBe('answered');
  });

  it('quotes the prepared food licensing provision', async () => {
    const answer = await ask(GOLDEN);
    const leading = answer.envelope?.claims[0]?.content.statement ?? '';

    expect(leading).toContain('prepared food licence');
  });

  it('every statement is verbatim from the chunk it cites', async () => {
    // The anti-fabrication invariant, re-checked on the demo path specifically.
    const answer = await ask(GOLDEN);
    expect(answer.envelope?.claims.length).toBeGreaterThan(0);

    for (const claim of answer.envelope?.claims ?? []) {
      const cited = ZZ_CHUNKS.find((c) => c.chunk_id === claim.evidence[0]?.chunkId);
      expect(cited, `claim cites unknown chunk ${claim.evidence[0]?.chunkId}`).toBeDefined();
      expect(cited?.body).toContain(claim.content.statement);
    }
  });

  it('cites every claim with a chunk this run actually returned', async () => {
    const answer = await ask(GOLDEN);
    const retrieved = new Set(answer.retrievedChunkIds);

    for (const claim of answer.citations) {
      expect(claim.citations.length).toBeGreaterThan(0);
      for (const citation of claim.citations) {
        expect(retrieved.has(citation.chunk_id)).toBe(true);
      }
    }
  });

  it('leads with substantive law, never with an edit instruction', async () => {
    const answer = await ask(GOLDEN);
    expect(answer.envelope?.claims[0]?.content.statement).not.toContain('principal Act is amended');
  });

  it('produced no model output — the reasoner is extractive', async () => {
    const answer = await ask(GOLDEN);
    expect(answer.envelope?.modelVersion).toBe('none:deterministic-extractive');
  });

  it('answers the other supported starter questions too', async () => {
    for (const question of [RECORDS, REGISTRATION]) {
      const answer = await ask(question);
      expect(answer.outcome, question).toBe('answered');
      expect(answer.envelope?.claims.length, question).toBeGreaterThan(0);
    }
  });

  it('quotes the record-keeping obligation for a record-keeping question', async () => {
    const answer = await ask(RECORDS);
    const statements = (answer.envelope?.claims ?? []).map((c) => c.content.statement).join(' ');

    expect(statements).toContain('keep records');
  });
});

describe('refusal — a question the corpus does not cover', () => {
  it('refuses rather than answering from something adjacent', async () => {
    const answer = await ask(OUT_OF_CORPUS);
    expect(answer.outcome).toBe('no_matching_evidence');
  });

  it('states no claim at all', async () => {
    const answer = await ask(OUT_OF_CORPUS);
    expect(answer.envelope?.claims).toEqual([]);
    expect(answer.citations).toEqual([]);
  });

  it('names the question it could not answer', async () => {
    // A refusal that names nothing is never produced (ADR-0017).
    const answer = await ask(OUT_OF_CORPUS);
    expect(answer.unresolved.length).toBeGreaterThan(0);
    expect(answer.unresolved[0]?.question).toBe(OUT_OF_CORPUS);
  });

  it('invents no Bahamian knowledge anywhere in the response', async () => {
    const answer = await ask(OUT_OF_CORPUS);

    // `unresolved[].question` echoes the founder's words back verbatim, which
    // is required — a refusal must name what it could not answer. Everything
    // OUTSIDE that echo is what this test is about: Nova must not have produced
    // a single word about Bahamian VAT of its own.
    const withoutEcho = JSON.stringify(answer)
      .toLowerCase()
      .split(OUT_OF_CORPUS.toLowerCase())
      .join('');

    for (const forbidden of ['vat', 'rate', 'bahamas', 'per cent', '%']) {
      expect(
        withoutEcho,
        `response contains "${forbidden}" outside the echoed question`,
      ).not.toContain(forbidden);
    }
  });

  it('is the extractor refusing, not retrieval finding nothing', async () => {
    // Worth distinguishing: retrieval returns weak lexical matches here, and it
    // is the passage-level check that declines to quote any of them. That is
    // the property that stops a thin corpus from looking like a full answer.
    const answer = await ask(OUT_OF_CORPUS);
    expect(answer.retrievedChunkIds.length).toBeGreaterThan(0);
  });
});

describe('amendment notices are reachable from the running product', () => {
  it('attaches the amendment chain to an amended provision', async () => {
    const answer = await ask(AMENDED);
    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 9');

    expect(notice).toBeDefined();
    expect(notice?.amendments.length).toBeGreaterThan(0);
  });

  it('withholds the current position when a commencement is unestablished', async () => {
    const answer = await ask(AMENDED);
    const notice = answer.amendmentNotices.find((n) => n.provision === 'section 9');

    expect(notice?.currentApplicabilityEstablished).toBe(false);
  });

  it('names the instrument responsible for the uncertainty', async () => {
    const answer = await ask(AMENDED);
    expect(answer.unresolved.some((u) => u.why.includes('No. 2 of 2025'))).toBe(true);
  });

  it('still delivers the quoted passage — an amendment is not a refusal', async () => {
    const answer = await ask(AMENDED);
    expect(answer.outcome).toBe('answered');
    expect(answer.envelope?.claims.length).toBeGreaterThan(0);
  });

  it('reaches the manifest through the registry, not through the caller', () => {
    // The regression this guards: the manifest existed and was correct for a
    // week while `answerNovaQuestion` was never called with one, so every
    // amendment notice was silently empty in production.
    expect(manifestForJurisdiction(DEMO_ZZ_COUNTRY_CODE)).not.toBeNull();
  });

  it('is wired into the server action, not only into tests', () => {
    // A source-level assertion, deliberately. The action is a Server Action and
    // cannot be invoked here, but the wiring is exactly what went missing
    // before, so it is worth a guard that fails loudly if it is removed again.
    const source = readFileSync(resolve(process.cwd(), 'app/(app)/assistant/actions.ts'), 'utf8');

    expect(source).toContain('manifestForJurisdiction(business.country_code)');
  });
});

describe('the view a founder receives', () => {
  it('marks the answer as coming from a synthetic corpus', async () => {
    const view = toNovaAnswerView(await ask(GOLDEN), GOLDEN);

    expect(view.jurisdiction).toBe(DEMO_ZZ_COUNTRY_CODE);
    expect(
      isSyntheticCorpus({
        jurisdiction: view.jurisdiction,
        knowledgeVersion: view.knowledgeVersion,
      }),
    ).toBe(true);
  });

  it('carries no machine-facing reasoning', async () => {
    const view = toNovaAnswerView(await ask(GOLDEN), GOLDEN);
    expect(JSON.stringify(view)).not.toContain('Extractive selection');
  });

  it('offers follow-ups built only from structured metadata', async () => {
    const view = toNovaAnswerView(await ask(AMENDED), AMENDED);
    expect(view.followUps.length).toBeGreaterThan(0);

    for (const followUp of view.followUps) {
      // Self-contained: no pronoun, nothing that depends on a previous turn.
      expect(followUp.question).not.toMatch(/\b(it|this|that|these|those|above|previous)\b/i);
      expect(followUp.question.length).toBeGreaterThanOrEqual(3);
      expect(followUp.question.length).toBeLessThanOrEqual(500);
    }
  });

  it('offers a follow-up naming the amending instrument', async () => {
    const view = toNovaAnswerView(await ask(AMENDED), AMENDED);
    const labels = view.followUps.map((f) => f.label).join(' | ');

    expect(labels).toMatch(/No\. [12] of 2025/);
  });

  it('every follow-up question is answerable on its own', async () => {
    // The claim the UI makes is that each of these is a NEW question answered
    // independently. If one of them refused, that claim would be a decoration.
    const view = toNovaAnswerView(await ask(GOLDEN), GOLDEN);

    for (const followUp of view.followUps) {
      const answer = await ask(followUp.question);
      expect(answer.outcome, followUp.question).toBe('answered');
    }
  });

  it('offers no follow-ups on a refusal — there is no metadata to build from', async () => {
    const view = toNovaAnswerView(await ask(OUT_OF_CORPUS), OUT_OF_CORPUS);
    expect(view.followUps).toEqual([]);
  });
});
