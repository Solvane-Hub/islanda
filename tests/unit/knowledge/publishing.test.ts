import { describe, expect, it } from 'vitest';
import {
  assertCommercialPublicationCleared,
  assertPackTransition,
  canTransitionPack,
  embeddingRebuildRequiresNewPackVersion,
  PublicationError,
  runQualityGate,
  type SourceReadiness,
} from '@/services/knowledge/publishing';
import type { KnowledgePackStatus } from '@/types/knowledge';

describe('G11 commercial-publication eligibility gate', () => {
  it('permits publication only when the pack is cleared', () => {
    expect(() => assertCommercialPublicationCleared('cleared')).not.toThrow();
  });

  it('blocks publication of a restricted pack (fail-closed)', () => {
    expect(() => assertCommercialPublicationCleared('restricted')).toThrow(PublicationError);
    // The error names G11 and points at the fix, without blocking ingestion/staging.
    try {
      assertCommercialPublicationCleared('restricted');
    } catch (e) {
      expect((e as Error).message).toMatch(/G11/);
      expect((e as Error).message).toMatch(/permission/i);
    }
  });
});

const ok: SourceReadiness = {
  sourceId: 'src-1',
  outcome: 'validated',
  chunkCount: 4,
  chunksMissingIdentity: 0,
  chunksMissingProvenance: 0,
};

describe('K7 §4 publication state machine', () => {
  it('permits the documented happy path', () => {
    expect(canTransitionPack('draft', 'validating')).toBe(true);
    expect(canTransitionPack('validating', 'staged')).toBe(true);
    expect(canTransitionPack('staged', 'published')).toBe(true);
  });

  it('forbids skipping staging — nothing reaches production unevaluated', () => {
    expect(canTransitionPack('draft', 'published')).toBe(false);
    expect(canTransitionPack('validating', 'published')).toBe(false);
    expect(() => assertPackTransition('draft', 'published')).toThrow(PublicationError);
  });

  it('treats published as immutable except for succession or withdrawal', () => {
    expect(canTransitionPack('published', 'superseded')).toBe(true);
    expect(canTransitionPack('published', 'rolled_back')).toBe(true);
    expect(canTransitionPack('published', 'draft')).toBe(false);
    expect(canTransitionPack('published', 'staged')).toBe(false);
  });

  it('makes superseded and rolled_back terminal', () => {
    const all: KnowledgePackStatus[] = [
      'draft',
      'validating',
      'staged',
      'published',
      'superseded',
      'rolled_back',
    ];
    for (const to of all) {
      expect(canTransitionPack('superseded', to)).toBe(false);
      expect(canTransitionPack('rolled_back', to)).toBe(false);
    }
  });

  it('distinguishes succession from withdrawal', () => {
    // Collapsing these loses the only signal that a release was withdrawn
    // rather than replaced.
    expect(canTransitionPack('published', 'superseded')).toBe(true);
    expect(canTransitionPack('published', 'rolled_back')).toBe(true);
    expect(canTransitionPack('superseded', 'rolled_back')).toBe(false);
  });

  it('allows a staged pack to be pulled back to draft', () => {
    expect(canTransitionPack('staged', 'draft')).toBe(true);
  });
});

describe('K7 §6 quality gate', () => {
  it('passes a clean pack', () => {
    const r = runQualityGate([ok]);
    expect(r.passed).toBe(true);
    expect(r.totalChunks).toBe(4);
  });

  it('refuses an empty pack', () => {
    expect(runQualityGate([]).passed).toBe(false);
  });

  it('refuses an unverified source', () => {
    const r = runQualityGate([{ ...ok, outcome: 'unverified' }]);
    expect(r.passed).toBe(false);
    expect(r.failures.join(' ')).toMatch(/unverified/);
  });

  it('refuses a rejected source', () => {
    expect(runQualityGate([{ ...ok, outcome: 'rejected' }]).passed).toBe(false);
  });

  it('admits partially_validated — reduced confidence, not exclusion (K2 §9)', () => {
    expect(runQualityGate([{ ...ok, outcome: 'partially_validated' }]).passed).toBe(true);
  });

  it('refuses a source that produced no chunks', () => {
    expect(runQualityGate([{ ...ok, chunkCount: 0 }]).passed).toBe(false);
  });

  it('refuses any chunk lacking chunk_id (K5 §3.10)', () => {
    const r = runQualityGate([{ ...ok, chunksMissingIdentity: 1 }]);
    expect(r.passed).toBe(false);
    expect(r.failures.join(' ')).toMatch(/chunk_id/);
  });

  it('refuses any chunk lacking citation provenance (K4 §6)', () => {
    expect(runQualityGate([{ ...ok, chunksMissingProvenance: 2 }]).passed).toBe(false);
  });

  it('reports every failure, not just the first', () => {
    const r = runQualityGate([
      { ...ok, outcome: 'unverified', chunkCount: 0, chunksMissingIdentity: 3 },
    ]);
    expect(r.failures.length).toBeGreaterThanOrEqual(3);
  });
});

describe('K7 §3.1 embeddings are retrieval artifacts', () => {
  it('does not bump the Knowledge Pack version on rebuild', () => {
    // The rule most likely to be violated by someone doing the obvious thing
    // after swapping the embedding model.
    expect(embeddingRebuildRequiresNewPackVersion()).toBe(false);
  });
});
