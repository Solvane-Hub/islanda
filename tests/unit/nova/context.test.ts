import { describe, expect, it } from 'vitest';
import {
  NovaContextError,
  buildNovaContext,
  buildQueryRepresentation,
} from '@/services/nova/context';

/**
 * Context building — where jurisdiction is established.
 *
 * K5 §3.2: jurisdiction is mandatory and never inferred. These tests exist
 * because the failure they guard against is invisible: retrieval scoped to the
 * wrong country returns fluent, well-cited, entirely inapplicable law.
 */

const business = { id: 'biz-1', country_code: 'ZZ', industry: 'widgets' };

describe('buildNovaContext — jurisdiction', () => {
  it('takes the country from the business record', () => {
    expect(buildNovaContext(business, null).retrieval.countryCode).toBe('ZZ');
  });

  it('refuses to build a context with no country', () => {
    expect(() => buildNovaContext({ ...business, country_code: '' }, null)).toThrow(
      NovaContextError,
    );
  });

  it('does NOT promote free-text location to a jurisdiction component', () => {
    // "Nassau" is the canonical trap: it names a city in The Bahamas and a
    // county in New York. A free-text field a founder typed may never become a
    // retrieval filter.
    const ctx = buildNovaContext(business, { location: 'Nassau' });

    expect(ctx.retrieval.region).toBeNull();
    expect(ctx.retrieval.municipality).toBeNull();
  });

  it('carries the industry through', () => {
    expect(buildNovaContext(business, null).retrieval.industry).toBe('widgets');
  });

  it('carries the business id for downstream correlation', () => {
    expect(buildNovaContext(business, null).businessId).toBe('biz-1');
  });

  it('passes through requested regulatory domains', () => {
    const ctx = buildNovaContext(business, null, { regulatoryDomains: ['widget_licensing'] });
    expect(ctx.retrieval.regulatoryDomains).toEqual(['widget_licensing']);
  });

  it('omits regulatory domains when none are requested', () => {
    expect(buildNovaContext(business, null).retrieval.regulatoryDomains).toBeUndefined();
  });

  it('is pure — identical input gives identical output', () => {
    expect(buildNovaContext(business, { location: 'Example City' })).toEqual(
      buildNovaContext(business, { location: 'Example City' }),
    );
  });
});

describe('buildQueryRepresentation — structured, never raw conversation', () => {
  it('combines the question with the business facts that scope it', () => {
    const q = buildQueryRepresentation('do I need a licence', business, {
      location: 'Example City',
      description: 'a mobile widget stall',
    });

    expect(q).toContain('do I need a licence');
    expect(q).toContain('widgets');
    expect(q).toContain('Example City');
    expect(q).toContain('a mobile widget stall');
  });

  it('uses free-text location as a ranking term, which is where it is harmless', () => {
    // The same field that must never filter jurisdiction is fine here: a wrong
    // term costs relevance, a wrong filter costs correctness.
    expect(
      buildQueryRepresentation('licence', business, { location: 'Nassau', description: null }),
    ).toContain('Nassau');
  });

  it('tolerates a missing profile', () => {
    expect(buildQueryRepresentation('licence', business, null)).toBe('licence widgets');
  });

  it('skips blank parts rather than emitting empty gaps', () => {
    const q = buildQueryRepresentation(
      'licence',
      { industry: null },
      {
        location: '   ',
        description: null,
      },
    );
    expect(q).toBe('licence');
  });

  it('enriches ranking with the Business Object fields', () => {
    const q = buildQueryRepresentation(
      'do I need a food handler certificate',
      {
        industry: 'skincare',
        business_type: 'company',
        trading_name: 'Cay Naturals',
        legal_name: 'Cay Naturals Ltd',
      },
      {
        location: 'Nassau',
        description: 'natural skincare for tourists',
        business_activities: 'manufacturing and retail of cosmetics',
        products_services: 'soaps and balms',
        target_customers: 'tourists and local consumers',
      },
    );

    for (const term of [
      'company',
      'Cay Naturals',
      'manufacturing and retail of cosmetics',
      'soaps and balms',
      'tourists and local consumers',
    ]) {
      expect(q).toContain(term);
    }
  });

  it('NEVER carries a sensitive identifier — the signature cannot name one', () => {
    // This string is hashed into agent_executions.query_representation_hash, so a
    // tax id here would leave the isolated business_identifiers table. The guard
    // is structural: an object carrying a stray `taxId` contributes nothing,
    // because the function only reads declared, non-sensitive fields.
    const q = buildQueryRepresentation(
      'vat',
      { industry: 'skincare', taxId: 'TIN-123456' } as never,
      { location: null, description: null, taxId: 'TIN-123456' } as never,
    );
    expect(q).toBe('vat skincare');
    expect(q).not.toContain('TIN-123456');
  });
});
