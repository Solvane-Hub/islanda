import { describe, expect, it } from 'vitest';
import type { NovaEvidenceInput } from '@/lib/ai/agents/nova/contract';
import { NOVA_AGENT, NOVA_NO_MODEL, NOVA_REASONER_VERSION } from '@/lib/ai/agents/nova/contract';
import { reasonExtractively } from '@/lib/ai/agents/nova/reason';

/**
 * The refusal tests come first, deliberately.
 *
 * Prompt Engineering Standard §8: "The refusal test is non-negotiable." F4 in
 * the same document rates a lost refusal instruction 🔴 Critical. AI-14 §8
 * makes refusal a designed output rather than a failure, and AI-14 S1 states
 * that wrong is worse than absent.
 *
 * Extractive Nova has no prompt to lose the instruction from, but it can still
 * be edited into answering when it should not, so the tests stay.
 */

const KNOWLEDGE_VERSION = 'BS-2026.1';

function evidence(overrides: Partial<NovaEvidenceInput> = {}): NovaEvidenceInput {
  return {
    chunkId: 'chunk-1',
    body: 'A person shall not operate a food business without a valid licence. The Minister may prescribe fees.',
    sourceAuthority: 5,
    sectionReference: 'Section 4',
    regulatoryDomain: 'business_licensing',
    rank: 1,
    ...overrides,
  };
}

describe('Nova reasoner — structured refusal (AI-14 §8, contract §7)', () => {
  it('refuses with NO_AUTHORITATIVE_INFORMATION_FOUND when no evidence was retrieved', () => {
    const envelope = reasonExtractively({
      question: 'Do I need a licence to run a food truck?',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [],
    });

    expect(envelope.status).toBe('NO_AUTHORITATIVE_INFORMATION_FOUND');
    expect(envelope.claims).toEqual([]);
  });

  it('treats refusal as a designed output, not an error', () => {
    // A5: "I could not determine this" is a valid, expected, first-class output.
    expect(() =>
      reasonExtractively({
        question: 'Do I need a licence?',
        knowledgeVersion: KNOWLEDGE_VERSION,
        evidence: [],
      }),
    ).not.toThrow();
  });

  it('names what it could not determine rather than silently returning nothing', () => {
    const envelope = reasonExtractively({
      question: 'Do I need a licence to run a food truck?',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [],
    });

    expect(envelope.unresolved).toHaveLength(1);
    expect(envelope.unresolved[0]?.question).toBe('Do I need a licence to run a food truck?');
    expect(envelope.unresolved[0]?.why.length).toBeGreaterThan(0);
  });

  it('refuses when evidence was retrieved but no passage supports the question', () => {
    // The dangerous case. Chunks came back, so the temptation is to summarise
    // them. Nothing in them addresses the question, so nothing may be claimed.
    const envelope = reasonExtractively({
      question: 'What are the requirements for marine salvage operations?',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence()],
    });

    expect(envelope.status).toBe('NO_AUTHORITATIVE_INFORMATION_FOUND');
    expect(envelope.claims).toEqual([]);
    expect(envelope.unresolved.length).toBeGreaterThan(0);
  });

  it('asks for clarification when the question carries no usable terms', () => {
    const envelope = reasonExtractively({
      question: '???',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence()],
    });

    expect(envelope.status).toBe('NEEDS_CLARIFICATION');
    expect(envelope.claims).toEqual([]);
    expect(envelope.unresolved.length).toBeGreaterThan(0);
  });

  it('checks evidence emptiness before input sufficiency, per the contract §7 flow', () => {
    const envelope = reasonExtractively({
      question: '???',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [],
    });

    expect(envelope.status).toBe('NO_AUTHORITATIVE_INFORMATION_FOUND');
  });

  it('never emits prose in a refusal', () => {
    const envelope = reasonExtractively({
      question: 'Do I need a licence?',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [],
    });

    // `reasoning` is machine-facing (§5) and must never be rendered. Everything
    // a founder could see is structured.
    expect(envelope.claims).toEqual([]);
    expect(Array.isArray(envelope.unresolved)).toBe(true);
  });
});

describe('Nova reasoner — extraction is quotation, never generation', () => {
  it('quotes a passage verbatim from the chunk body', () => {
    const chunk = evidence();
    const envelope = reasonExtractively({
      question: 'licence to operate a food business',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [chunk],
    });

    expect(envelope.status).toBe('OK');
    const quote = envelope.claims[0]?.evidence[0]?.quote ?? '';
    expect(quote.length).toBeGreaterThan(0);
    // The single strongest guarantee in the system: the quote is a substring of
    // the source. Fabrication is impossible by construction, not by evaluation.
    expect(chunk.body).toContain(quote);
  });

  it('makes the claim statement identical to the quoted passage', () => {
    const envelope = reasonExtractively({
      question: 'licence to operate a food business',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence()],
    });

    const claim = envelope.claims[0];
    expect(claim?.content.statement).toBe(claim?.evidence[0]?.quote);
  });

  it('selects the passage that matches the question, not merely the first', () => {
    const envelope = reasonExtractively({
      question: 'prescribed fees',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence()],
    });

    expect(envelope.claims[0]?.content.statement).toBe('The Minister may prescribe fees.');
  });

  it('binds every claim to the chunk_id it came from', () => {
    const envelope = reasonExtractively({
      question: 'licence food business',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence({ chunkId: 'chunk-abc' })],
    });

    expect(envelope.claims[0]?.evidence[0]?.chunkId).toBe('chunk-abc');
  });

  it('carries Source Authority on the evidence reference', () => {
    const envelope = reasonExtractively({
      question: 'licence food business',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence({ sourceAuthority: 4 })],
    });

    expect(envelope.claims[0]?.evidence[0]?.sourceAuthority).toBe(4);
  });

  it('reports one reasoning hop, because a quotation restates one passage', () => {
    const envelope = reasonExtractively({
      question: 'licence food business',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence()],
    });

    expect(envelope.claims[0]?.reasoningHops).toBe(1);
  });

  it('emits at most one claim per chunk', () => {
    const envelope = reasonExtractively({
      question: 'licence food business prescribe fees',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [evidence()],
    });

    expect(envelope.claims).toHaveLength(1);
  });

  it('records chunks that yielded no supported passage as unresolved', () => {
    const envelope = reasonExtractively({
      question: 'licence',
      knowledgeVersion: KNOWLEDGE_VERSION,
      evidence: [
        evidence({ chunkId: 'chunk-match' }),
        evidence({
          chunkId: 'chunk-nomatch',
          body: 'Vessels shall display navigation lights between sunset and sunrise.',
          rank: 2,
        }),
      ],
    });

    // §5.3: OK with claims AND an unresolved entry. Discarding what could not be
    // determined is the easiest route to a confidently incomplete answer.
    expect(envelope.status).toBe('OK');
    expect(envelope.claims).toHaveLength(1);
    expect(envelope.unresolved.length).toBeGreaterThan(0);
  });
});

describe('Nova reasoner — envelope conformance (ADR-0017 §5)', () => {
  const envelope = reasonExtractively({
    question: 'licence food business',
    knowledgeVersion: KNOWLEDGE_VERSION,
    evidence: [evidence()],
  });

  it('identifies the agent and its version', () => {
    expect(envelope.agent).toBe(NOVA_AGENT);
    expect(envelope.agentVersion.length).toBeGreaterThan(0);
  });

  it('records the reasoner version in place of a prompt version', () => {
    expect(envelope.promptVersion).toBe(NOVA_REASONER_VERSION);
  });

  it('states explicitly that no model produced the output', () => {
    expect(envelope.modelVersion).toBe(NOVA_NO_MODEL);
  });

  it('records the Knowledge Pack version the run was grounded in', () => {
    expect(envelope.knowledgeVersion).toBe(KNOWLEDGE_VERSION);
  });

  it('always includes unresolved, even when everything resolved', () => {
    expect(envelope).toHaveProperty('unresolved');
    expect(Array.isArray(envelope.unresolved)).toBe(true);
  });

  it('never self-assesses trust (A4)', () => {
    expect(envelope).not.toHaveProperty('trustLevel');
    expect(envelope).not.toHaveProperty('trustScore');
    for (const claim of envelope.claims) {
      expect(claim).not.toHaveProperty('trustLevel');
      expect(claim).not.toHaveProperty('trustScore');
      expect(claim).not.toHaveProperty('evidenceStrength');
      expect(claim).not.toHaveProperty('reasoningConfidence');
    }
  });
});

describe('Nova reasoner — idempotency (§6, ADR-0016)', () => {
  const input = {
    question: 'licence food business prescribe fees',
    knowledgeVersion: KNOWLEDGE_VERSION,
    evidence: [evidence(), evidence({ chunkId: 'chunk-2', rank: 2 })],
  };

  it('produces an identical envelope for identical input', () => {
    expect(reasonExtractively(input)).toEqual(reasonExtractively(input));
  });

  it('does not depend on wall-clock time', () => {
    // No `retrievedAt`, no `generatedAt`. The runner supplies dates (§6).
    const envelope = reasonExtractively(input);
    expect(JSON.stringify(envelope)).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });

  it('orders claims deterministically by retrieval rank', () => {
    const envelope = reasonExtractively({
      ...input,
      evidence: [
        evidence({ chunkId: 'chunk-second', rank: 2 }),
        evidence({ chunkId: 'chunk-first', rank: 1 }),
      ],
    });

    expect(envelope.claims.map((c) => c.evidence[0]?.chunkId)).toEqual([
      'chunk-first',
      'chunk-second',
    ]);
  });

  it('gives the same claim the same id across runs', () => {
    const a = reasonExtractively(input);
    const b = reasonExtractively(input);
    expect(a.claims.map((c) => c.claimId)).toEqual(b.claims.map((c) => c.claimId));
  });
});
