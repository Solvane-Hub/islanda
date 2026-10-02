import { describe, expect, it } from 'vitest';
import type { NovaClaim, NovaEnvelope } from '@/lib/ai/agents/nova/contract';
import {
  EnvelopeIntegrityError,
  NOVA_AGENT,
  NOVA_AGENT_VERSION,
  NOVA_NO_MODEL,
  NOVA_REASONER_VERSION,
  assertEnvelopeValid,
} from '@/lib/ai/agents/nova/contract';

/**
 * The envelope gate. Fails closed, exactly as `assertRetrievalResultValid` does.
 *
 * Every rule here restates an obligation from ADR-0017 §5 or AI-14. None of them
 * is a style preference, and none may be relaxed to make a test pass.
 */

function claim(overrides: Partial<NovaClaim> = {}): NovaClaim {
  return {
    claimId: '11111111-1111-5111-8111-111111111111',
    content: {
      statement: 'A person shall hold a current licence.',
      sectionReference: 'Section 4',
      regulatoryDomain: 'business_licensing',
    },
    evidence: [
      {
        chunkId: 'chunk-1',
        quote: 'A person shall hold a current licence.',
        sourceAuthority: 5,
      },
    ],
    reasoningHops: 1,
    ...overrides,
  };
}

function envelope(overrides: Partial<NovaEnvelope> = {}): NovaEnvelope {
  return {
    status: 'OK',
    agent: NOVA_AGENT,
    agentVersion: NOVA_AGENT_VERSION,
    promptVersion: NOVA_REASONER_VERSION,
    modelVersion: NOVA_NO_MODEL,
    knowledgeVersion: 'BS-2026.1',
    reasoning: 'Extractive selection over 1 retrieved chunk.',
    claims: [claim()],
    unresolved: [],
    ...overrides,
  };
}

describe('envelope gate — accepts a well-formed envelope', () => {
  it('accepts an OK envelope with one grounded claim', () => {
    expect(() => assertEnvelopeValid(envelope())).not.toThrow();
  });

  it('accepts a refusal with no claims and a named gap', () => {
    expect(() =>
      assertEnvelopeValid(
        envelope({
          status: 'NO_AUTHORITATIVE_INFORMATION_FOUND',
          claims: [],
          unresolved: [{ question: 'Do I need a licence?', why: 'No authoritative source found.' }],
        }),
      ),
    ).not.toThrow();
  });
});

describe('envelope gate — evidence binding (ADR-0017 §5.1)', () => {
  it('rejects a claim with no evidence', () => {
    expect(() => assertEnvelopeValid(envelope({ claims: [claim({ evidence: [] })] }))).toThrow(
      EnvelopeIntegrityError,
    );
  });

  it('rejects evidence with no chunk_id', () => {
    expect(() =>
      assertEnvelopeValid(
        envelope({
          claims: [claim({ evidence: [{ chunkId: '', quote: 'something', sourceAuthority: 5 }] })],
        }),
      ),
    ).toThrow(EnvelopeIntegrityError);
  });

  it('rejects evidence with no quote — a cited chunk without supporting text is unverifiable', () => {
    expect(() =>
      assertEnvelopeValid(
        envelope({
          claims: [claim({ evidence: [{ chunkId: 'chunk-1', quote: '', sourceAuthority: 5 }] })],
        }),
      ),
    ).toThrow(EnvelopeIntegrityError);
  });
});

describe('envelope gate — status semantics (contract §7, AI-14 §8)', () => {
  it('rejects OK with no claims', () => {
    expect(() => assertEnvelopeValid(envelope({ status: 'OK', claims: [] }))).toThrow(
      EnvelopeIntegrityError,
    );
  });

  it('rejects a refusal that still carries claims', () => {
    expect(() =>
      assertEnvelopeValid(
        envelope({
          status: 'NO_AUTHORITATIVE_INFORMATION_FOUND',
          unresolved: [{ question: 'q', why: 'w' }],
        }),
      ),
    ).toThrow(EnvelopeIntegrityError);
  });

  it('rejects a refusal that names nothing unresolved', () => {
    // A silent refusal tells the founder nothing and tells us nothing about
    // where the corpus is thin.
    expect(() =>
      assertEnvelopeValid(
        envelope({ status: 'NO_AUTHORITATIVE_INFORMATION_FOUND', claims: [], unresolved: [] }),
      ),
    ).toThrow(EnvelopeIntegrityError);
  });

  it('rejects NEEDS_CLARIFICATION that names nothing unresolved', () => {
    expect(() =>
      assertEnvelopeValid(envelope({ status: 'NEEDS_CLARIFICATION', claims: [], unresolved: [] })),
    ).toThrow(EnvelopeIntegrityError);
  });
});

describe('envelope gate — identity and idempotency (§6)', () => {
  it('rejects a claim with no claim_id', () => {
    expect(() => assertEnvelopeValid(envelope({ claims: [claim({ claimId: '' })] }))).toThrow(
      EnvelopeIntegrityError,
    );
  });

  it('rejects duplicate claim ids in one envelope', () => {
    expect(() => assertEnvelopeValid(envelope({ claims: [claim(), claim()] }))).toThrow(
      EnvelopeIntegrityError,
    );
  });

  it('rejects reasoning_hops below one', () => {
    expect(() => assertEnvelopeValid(envelope({ claims: [claim({ reasoningHops: 0 })] }))).toThrow(
      EnvelopeIntegrityError,
    );
  });
});

describe('envelope gate — provenance', () => {
  it('rejects a missing knowledge_version', () => {
    expect(() => assertEnvelopeValid(envelope({ knowledgeVersion: '' }))).toThrow(
      EnvelopeIntegrityError,
    );
  });

  it('rejects a missing prompt/reasoner version', () => {
    expect(() => assertEnvelopeValid(envelope({ promptVersion: '' }))).toThrow(
      EnvelopeIntegrityError,
    );
  });

  it('rejects a missing model version marker', () => {
    // Even "no model" must be stated. An absent value is indistinguishable from
    // an unrecorded one when a run is replayed.
    expect(() => assertEnvelopeValid(envelope({ modelVersion: '' }))).toThrow(
      EnvelopeIntegrityError,
    );
  });
});

describe('envelope gate — no trust self-assessment (A4, ADR-0015)', () => {
  it('rejects an envelope carrying a trust level', () => {
    const rogue = { ...envelope(), trustLevel: 'verified' } as NovaEnvelope;
    expect(() => assertEnvelopeValid(rogue)).toThrow(EnvelopeIntegrityError);
  });

  it('rejects a claim carrying a trust score', () => {
    const rogue = envelope({
      claims: [{ ...claim(), trustScore: 92 } as NovaClaim],
    });
    expect(() => assertEnvelopeValid(rogue)).toThrow(EnvelopeIntegrityError);
  });

  it('rejects a claim carrying evidence strength', () => {
    const rogue = envelope({
      claims: [{ ...claim(), evidenceStrength: 5 } as NovaClaim],
    });
    expect(() => assertEnvelopeValid(rogue)).toThrow(EnvelopeIntegrityError);
  });
});
