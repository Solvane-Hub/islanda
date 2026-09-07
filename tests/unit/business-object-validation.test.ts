import { describe, expect, it } from 'vitest';
import { buildBusinessSchema, manageBusinessSchema } from '@/lib/validation/business-object';

/**
 * Business Object onboarding contracts.
 *
 * These guard the two front doors. The load-bearing assertions: a Build needs a
 * real concept and jurisdiction; a Manage needs a legal name; and optional/blank
 * fields normalise to `undefined` rather than empty strings, so the service and
 * database never store a value that is really an absence.
 */

describe('buildBusinessSchema — build my business', () => {
  it('accepts a natural concept with name and jurisdiction', () => {
    const parsed = buildBusinessSchema.safeParse({
      name: 'Cay Naturals',
      countryCode: 'bs',
      concept: 'A premium Bahamian skincare company selling natural products to tourists.',
      industry: 'skincare',
      businessStage: 'idea',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.countryCode).toBe('BS'); // upper-cased
  });

  it('rejects a concept that is too thin to understand', () => {
    const parsed = buildBusinessSchema.safeParse({
      name: 'X',
      countryCode: 'BS',
      concept: 'soap',
    });
    expect(parsed.success).toBe(false);
  });

  it('treats a blank stage as "not sure yet" (undefined), not an empty value', () => {
    const parsed = buildBusinessSchema.safeParse({
      name: 'Cay Naturals',
      countryCode: 'BS',
      concept: 'A premium Bahamian skincare company selling natural products.',
      businessStage: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.businessStage).toBeUndefined();
  });
});

describe('manageBusinessSchema — manage my business', () => {
  it('accepts an existing business with identity and identifiers', () => {
    const parsed = manageBusinessSchema.safeParse({
      legalName: 'Cay Naturals Ltd',
      tradingName: 'Cay Naturals',
      businessType: 'company',
      countryCode: 'BS',
      industry: 'skincare',
      taxId: 'TIN-000123',
      registrationNumber: 'C-45678',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.legalName).toBe('Cay Naturals Ltd');
      expect(parsed.data.taxId).toBe('TIN-000123');
    }
  });

  it('requires a legal name', () => {
    const parsed = manageBusinessSchema.safeParse({ legalName: '   ', countryCode: 'BS' });
    expect(parsed.success).toBe(false);
  });

  it('normalises omitted identifiers to undefined, never empty strings', () => {
    const parsed = manageBusinessSchema.safeParse({
      legalName: 'Cay Naturals Ltd',
      countryCode: 'BS',
      taxId: '',
      registrationNumber: '',
      vatNumber: '',
      tradingName: '',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.taxId).toBeUndefined();
      expect(parsed.data.registrationNumber).toBeUndefined();
      expect(parsed.data.vatNumber).toBeUndefined();
      expect(parsed.data.tradingName).toBeUndefined();
    }
  });
});
