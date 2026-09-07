import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/database';

import { evaluateBusinessRequirements } from '@/services/regulatory';

import { findProfileByBusinessId } from '@/lib/db/business-profiles';
import {
  listApplicabilityRules,
  listPublishedRequirements,
  upsertBusinessRegulatoryRequirement,
} from '@/lib/db/regulatory';
import { findBusinessById } from '@/lib/db/businesses';
vi.mock('@/lib/db/business-profiles', () => ({
  findProfileByBusinessId: vi.fn(),
}));

vi.mock('@/lib/db/regulatory', () => ({
  listApplicabilityRules: vi.fn(),
  listBusinessRegulatoryRequirements: vi.fn(),
  listPublishedRequirements: vi.fn(),
  upsertBusinessRegulatoryRequirement: vi.fn(),
}));

vi.mock('@/lib/db/businesses', () => ({
  findBusinessById: vi.fn(),
}));

const mockedFindProfile = vi.mocked(findProfileByBusinessId);
const mockedFindBusiness = vi.mocked(findBusinessById);
const mockedListRequirements = vi.mocked(listPublishedRequirements);
const mockedListRules = vi.mocked(listApplicabilityRules);
const mockedUpsert = vi.mocked(upsertBusinessRegulatoryRequirement);

const db = {} as never;

const business: Database['public']['Tables']['businesses']['Row'] = {
  id: 'business-1',
  owner_id: 'owner-1',
  name: 'Test Business',
  industry: 'retail',
  country_code: 'BS',
  status: 'active',
  business_mode: 'build',
  legal_name: null,
  trading_name: null,
  business_type: null,
  archived_at: null,
  created_at: '2026-08-14T00:00:00.000Z',
  updated_at: '2026-08-14T00:00:00.000Z',
};

const profile: Database['public']['Tables']['business_profiles']['Row'] = {
  business_id: 'business-1',
  business_stage: 'operating',
  completed_at: null,
  created_at: '2026-08-14T00:00:00.000Z',
  description: 'A retail business.',
  employee_count: 12,
  founder_goals: null,
  funding_requirement_amount: null,
  funding_requirement_currency: null,
  id: 'profile-1',
  last_completed_step: 1,
  location: 'Nassau',
  products_services: null,
  target_customers: null,
  business_activities: null,
  operating_status: null,
  responses: {},
  updated_at: '2026-08-14T00:00:00.000Z',
};

const requirement = {
  id: 'requirement-1',
  title: 'Business Licence',
  jurisdiction: 'BS',
  status: 'published',
} as never;

const applicableRule: Database['public']['Tables']['regulatory_applicability_rules']['Row'] = {
  id: 'rule-1',
  requirement_id: 'requirement-1',
  rule_type: 'custom',
  operator: 'equals',
  field_path: 'business.industry',
  expected_value: 'retail',
  explanation: 'Applies to retail businesses.',
  created_at: '2026-08-14T00:00:00.000Z',
};

describe('evaluateBusinessRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFindBusiness.mockResolvedValue(business);
    mockedFindProfile.mockResolvedValue(profile);
    mockedListRequirements.mockResolvedValue([requirement]);
    mockedListRules.mockResolvedValue([applicableRule]);

    mockedUpsert.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  it('returns an empty summary when the business does not exist', async () => {
    mockedFindBusiness.mockResolvedValue(null);

    const result = await evaluateBusinessRequirements(db, 'missing-business');

    expect(result).toEqual({
      evaluated: 0,
      applicable: 0,
      notApplicable: 0,
      needsInformation: 0,
    });

    expect(mockedFindProfile).not.toHaveBeenCalled();
    expect(mockedListRequirements).not.toHaveBeenCalled();
    expect(mockedUpsert).not.toHaveBeenCalled();
  });

  it('evaluates published requirements and persists the result', async () => {
    const result = await evaluateBusinessRequirements(db, 'business-1');

    expect(result).toEqual({
      evaluated: 1,
      applicable: 1,
      notApplicable: 0,
      needsInformation: 0,
    });

    expect(mockedFindBusiness).toHaveBeenCalledWith(db, 'business-1');

    expect(mockedFindProfile).toHaveBeenCalledWith(db, 'business-1');

    expect(mockedListRequirements).toHaveBeenCalledWith(db, 'BS');

    expect(mockedListRules).toHaveBeenCalledWith(db, 'requirement-1');

    expect(mockedUpsert).toHaveBeenCalledTimes(1);

    expect(mockedUpsert).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        business_id: 'business-1',
        requirement_id: 'requirement-1',
        state: 'applicable',
        reason: 'All applicability rules were satisfied.',
        missing_information: [],
      }),
    );
  });

  it('persists needs_information when required business knowledge is missing', async () => {
    mockedListRules.mockResolvedValue([
      {
        ...applicableRule,
        field_path: 'business.missing_field',
      } as never,
    ]);

    const result = await evaluateBusinessRequirements(db, 'business-1');

    expect(result).toEqual({
      evaluated: 1,
      applicable: 0,
      notApplicable: 0,
      needsInformation: 1,
    });

    expect(mockedUpsert).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        state: 'needs_information',
        missing_information: ['business.missing_field'],
      }),
    );
  });

  it('persists not_applicable when a rule fails', async () => {
    mockedListRules.mockResolvedValue([
      {
        ...applicableRule,
        expected_value: 'construction',
        explanation: 'This requirement only applies to construction businesses.',
      } as never,
    ]);

    const result = await evaluateBusinessRequirements(db, 'business-1');

    expect(result).toEqual({
      evaluated: 1,
      applicable: 0,
      notApplicable: 1,
      needsInformation: 0,
    });

    expect(mockedUpsert).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        state: 'not_applicable',
        reason: 'This requirement only applies to construction businesses.',
        missing_information: [],
      }),
    );
  });

  it('surfaces a persistence failure', async () => {
    mockedUpsert.mockResolvedValue({
      data: null,
      error: 'database write failed',
    });

    await expect(evaluateBusinessRequirements(db, 'business-1')).rejects.toThrow(
      'Failed to persist regulatory requirement requirement-1: database write failed',
    );
  });
});
