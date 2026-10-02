import { describe, expect, it } from 'vitest';
import { SOLVANE_SERVICES, findSolvaneService, initiative } from '@/lib/solvane/catalog';

/**
 * Solvane is an OPTIONAL execution layer. The structure encodes the product
 * principles: a recommendation only ever appears as one option on an initiative
 * that already has a rationale, and "do it myself" is always first.
 */
describe('Solvane catalog & initiatives', () => {
  it('always offers self-service first, before any Solvane option', () => {
    const init = initiative({
      title: 'Launch an online store',
      rationale: 'Your stated goal is to increase online sales.',
      solvane: { label: 'Have Solvane build it', serviceCategory: 'ecommerce_development' },
    });
    expect(init.executionOptions[0]?.kind).toBe('self');
    expect(init.executionOptions[1]?.kind).toBe('solvane');
    expect(init.rationale.length).toBeGreaterThan(0);
  });

  it('needs no Solvane option at all — self-service stands alone', () => {
    const init = initiative({ title: 'Write your about page', rationale: 'Founder asked.' });
    expect(init.executionOptions).toHaveLength(1);
    expect(init.executionOptions[0]?.kind).toBe('self');
  });

  it('exposes the service catalog by category', () => {
    expect(findSolvaneService('seo')?.title).toBe('SEO');
    expect(SOLVANE_SERVICES.length).toBeGreaterThan(0);
    // Every service declares who it applies to — build, manage, or both.
    for (const s of SOLVANE_SERVICES) {
      expect(['build', 'manage', 'both']).toContain(s.audience);
    }
  });
});
