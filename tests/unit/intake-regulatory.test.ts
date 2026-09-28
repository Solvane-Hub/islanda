import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Database } from '@/types/database';

import { completeIntake } from '@/services/intake';

import { findProfileByBusinessId } from '@/lib/db/business-profiles';
import { findBusinessById, updateBusiness } from '@/lib/db/businesses';
import { recordAuditEvent } from '@/services/audit';
import { evaluateBusinessRequirements } from '@/services/regulatory';

vi.mock('@/lib/db/business-profiles', () => ({
  findProfileByBusinessId: vi.fn(),
  updateProfile: vi.fn(),
}));

vi.mock('@/lib/db/businesses', () => ({
  findBusinessById: vi.fn(),
  updateBusiness: vi.fn(),
}));

vi.mock('@/services/audit', () => ({
  recordAuditEvent: vi.fn(),
}));

vi.mock('@/services/regulatory', () => ({
  evaluateBusinessRequirements: vi.fn(),
}));

const mockedFindProfile = vi.mocked(findProfileByBusinessId);
const mockedFindBusiness = vi.mocked(findBusinessById);
const mockedUpdateBusiness = vi.mocked(updateBusiness);
const mockedAudit = vi.mocked(recordAuditEvent);
const mockedEvaluateRegulatory = vi.mocked(evaluateBusinessRequirements);

const db = {} as never;

const business: Database['public']['Tables']['businesses']['Row'] = {
  id: 'business-1',
  owner_id: 'owner-1',
  name: 'Test Business',
  industry: 'retail',
  country_code: 'BS',
  status: 'intake_started',
  business_mode: 'build',
  legal_name: null,
  trading_name: null,
  business_type: null,
  logo_storage_path: null,
  archived_at: null,
  created_at: '2026-08-14T00:00:00.000Z',
  updated_at: '2026-08-14T00:00:00.000Z',
};

const profile: Database['public']['Tables']['business_profiles']['Row'] = {
  id: 'profile-1',
  business_id: 'business-1',
  description: 'A retail business in Nassau.',
  business_stage: 'operating',
  location: 'Nassau',
  employee_count: 12,
  funding_requirement_amount: 50000,
  funding_requirement_currency: 'BSD',
  founder_goals: 'Grow the business.',
  products_services: null,
  target_customers: null,
  business_activities: null,
  operating_status: null,
  responses: {
    knowledge: {
      description: { source: 'founder' },
      stage: { source: 'founder' },
      team: { source: 'founder' },
      funding: { source: 'founder' },
      goals: { source: 'founder' },
    },
  },
  last_completed_step: 5,
  completed_at: null,
  created_at: '2026-08-14T00:00:00.000Z',
  updated_at: '2026-08-14T00:00:00.000Z',
};

describe('completeIntake regulatory lifecycle', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedFindProfile.mockResolvedValue(profile);
    mockedFindBusiness.mockResolvedValue(business);

    mockedUpdateBusiness.mockResolvedValue({
      data: {
        ...business,
        status: 'intake_complete',
      },
      error: null,
    });

    mockedEvaluateRegulatory.mockResolvedValue({
      evaluated: 3,
      applicable: 2,
      notApplicable: 1,
      needsInformation: 0,
    });

    mockedAudit.mockResolvedValue();
  });

  it('evaluates regulatory requirements after intake becomes complete', async () => {
    await completeIntake(db, 'business-1', 'owner-1');

    expect(mockedUpdateBusiness).toHaveBeenCalledWith(db, 'business-1', {
      status: 'intake_complete',
    });

    expect(mockedEvaluateRegulatory).toHaveBeenCalledWith(db, 'business-1');
  });

  it('evaluates regulatory requirements only after the intake transition', async () => {
    const events: string[] = [];

    mockedUpdateBusiness.mockImplementation(async () => {
      events.push('business.updated');

      return {
        data: {
          ...business,
          status: 'intake_complete',
        },
        error: null,
      };
    });

    mockedEvaluateRegulatory.mockImplementation(async () => {
      events.push('regulatory.evaluated');

      return {
        evaluated: 3,
        applicable: 2,
        notApplicable: 1,
        needsInformation: 0,
      };
    });

    await completeIntake(db, 'business-1', 'owner-1');

    expect(events).toEqual(['business.updated', 'regulatory.evaluated']);
  });

  it('does not evaluate regulatory requirements when intake is incomplete', async () => {
    mockedFindProfile.mockResolvedValue({
      ...profile,
      founder_goals: null,
    });

    await expect(completeIntake(db, 'business-1', 'owner-1')).rejects.toMatchObject({
      humanMessage: 'Please finish the remaining questions first.',
    });

    expect(mockedEvaluateRegulatory).not.toHaveBeenCalled();
    expect(mockedUpdateBusiness).not.toHaveBeenCalled();
  });

  it('does not re-transition an already completed intake', async () => {
    mockedFindBusiness.mockResolvedValue({
      ...business,
      status: 'intake_complete',
    });

    await completeIntake(db, 'business-1', 'owner-1');

    expect(mockedUpdateBusiness).not.toHaveBeenCalled();
    expect(mockedEvaluateRegulatory).toHaveBeenCalledWith(db, 'business-1');
  });
});
