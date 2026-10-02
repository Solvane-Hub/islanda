import { describe, expect, it } from 'vitest';
import { classifyIntelligence } from '@/lib/intelligence/router';

/**
 * The router is the profitability gate: default to deterministic, escalate to an
 * LLM only for genuine reasoning, and to premium only for multi-source strategy.
 */
describe('classifyIntelligence', () => {
  it('routes a fact lookup to deterministic (no model)', () => {
    const d = classifyIntelligence('How much did revenue grow?');
    expect(d.determination).toBe('deterministic');
    expect(d.tier).toBeNull();
    expect(d.category).toBe('financial');
  });

  it('routes a reasoning question to the mini LLM tier', () => {
    const d = classifyIntelligence('Why did revenue grow?');
    expect(d.determination).toBe('llm');
    expect(d.tier).toBe('mini');
  });

  it('routes multi-source strategy to the premium tier', () => {
    const d = classifyIntelligence(
      'Create a 12-month growth strategy using my financial history and goals.',
    );
    expect(d.determination).toBe('premium');
    expect(d.tier).toBe('premium');
  });

  it('keeps a regulatory licence question deterministic (extractive Nova handles it)', () => {
    const d = classifyIntelligence('What licence do I need to sell prepared food?');
    expect(d.category).toBe('regulatory');
    expect(d.determination).toBe('deterministic');
  });

  it('treats "how is my business doing?" as reasoning', () => {
    expect(classifyIntelligence('How is my business doing?').determination).toBe('llm');
  });

  it('honours a caller category hint', () => {
    expect(classifyIntelligence('Tell me more', 'compliance').category).toBe('compliance');
  });
});
