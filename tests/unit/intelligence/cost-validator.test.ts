import { describe, expect, it } from 'vitest';
import { estimateCostUsd } from '@/lib/intelligence/cost';
import { MODELS } from '@/lib/intelligence/models';
import { validateIntelligenceResponse } from '@/lib/intelligence/validator';

describe('estimateCostUsd', () => {
  it('costs tokens against a model’s pricing', () => {
    // mini: $0.25/Mtok in, $2.00/Mtok out. 1000 in + 500 out.
    const cost = estimateCostUsd(MODELS.mini.pricing, 1000, 500);
    expect(cost).toBeCloseTo(0.00025 + 0.001, 6);
  });

  it('is zero for zero tokens', () => {
    expect(estimateCostUsd(MODELS.premium.pricing, 0, 0)).toBe(0);
  });
});

const valid = {
  answer: 'Revenue increased between the two recorded periods.',
  category: 'financial',
  confidence: 'medium',
  recommendations: [{ text: 'Keep recording each period.', basis: 'RECOMMENDATION' }],
  evidence: [
    {
      id: 'metric:revenue:recorded',
      type: 'financial_metric',
      source: 'Q2 2026',
      provenance: 'FOUNDER_PROVIDED',
    },
  ],
  followUps: ['What changed between Q1 and Q2?'],
  unknowns: [],
};

const ALLOWED = ['metric:revenue:recorded'];

describe('validateIntelligenceResponse', () => {
  it('accepts a well-formed object', () => {
    const r = validateIntelligenceResponse(valid, ALLOWED);
    expect(r.ok).toBe(true);
  });

  it('accepts a JSON string', () => {
    const r = validateIntelligenceResponse(JSON.stringify(valid), ALLOWED);
    expect(r.ok).toBe(true);
  });

  it('rejects non-JSON text', () => {
    const r = validateIntelligenceResponse('not json at all', ALLOWED);
    expect(r).toEqual({ ok: false, reason: 'not_json' });
  });

  it('rejects a missing required field', () => {
    const { answer: _drop, ...rest } = valid;
    expect(validateIntelligenceResponse(rest, ALLOWED)).toEqual({ ok: false, reason: 'schema' });
  });

  it('rejects a recommendation dressed up as a fact', () => {
    const bad = { ...valid, recommendations: [{ text: 'x', basis: 'VERIFIED_FACT' }] };
    expect(validateIntelligenceResponse(bad, ALLOWED)).toEqual({ ok: false, reason: 'schema' });
  });

  it('rejects evidence the model was never given (fabrication)', () => {
    const bad = {
      ...valid,
      evidence: [
        {
          id: 'metric:invented',
          type: 'financial_metric',
          source: 'x',
          provenance: 'FOUNDER_PROVIDED',
        },
      ],
    };
    expect(validateIntelligenceResponse(bad, ALLOWED)).toEqual({
      ok: false,
      reason: 'unknown_evidence',
    });
  });
});
