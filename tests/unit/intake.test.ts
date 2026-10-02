import { describe, expect, it } from 'vitest';
import {
  stepDescriptionSchema,
  stepFromParam,
  stepFundingSchema,
  stepGoalsSchema,
  stepStageSchema,
  stepTeamSchema,
  TOTAL_INTAKE_STEPS,
} from '@/lib/validation/intake';
import { intakeProgress } from '@/services/intake';
import type { BusinessProfile } from '@/types/business';

describe('stepFromParam — resume logic', () => {
  it('resumes at the next unanswered step', () => {
    expect(stepFromParam(undefined, 2)).toBe(3);
  });

  it('starts at step 1 for a fresh intake', () => {
    expect(stepFromParam(undefined, 0)).toBe(1);
  });

  it('honours an explicit step the founder has already reached', () => {
    expect(stepFromParam('2', 4)).toBe(2);
  });

  it('honours an explicit link to any valid knowledge slot', () => {
    // Dashboard and review links must still work when a slot was supplied by
    // another writer and the guided-flow cursor has not advanced.
    expect(stepFromParam('5', 0)).toBe(5);
    expect(stepFromParam('4', 1)).toBe(4);
  });

  it('clamps at the final step', () => {
    expect(stepFromParam(undefined, TOTAL_INTAKE_STEPS)).toBe(TOTAL_INTAKE_STEPS);
  });

  it('ignores junk input', () => {
    for (const junk of ['abc', '-1', '0', '999', '', '2.5']) {
      const r = stepFromParam(junk, 1);
      expect(r).toBeGreaterThanOrEqual(1);
      expect(r).toBeLessThanOrEqual(TOTAL_INTAKE_STEPS);
    }
  });
});

describe('intake step validation', () => {
  it('requires a substantive description', () => {
    expect(stepDescriptionSchema.safeParse({ description: 'food' }).success).toBe(false);
    expect(
      stepDescriptionSchema.safeParse({
        description: 'A seafood restaurant in Nassau serving local catch.',
      }).success,
    ).toBe(true);
  });

  it('rejects an unknown business stage', () => {
    expect(
      stepStageSchema.safeParse({ businessStage: 'unicorn', location: 'Nassau' }).success,
    ).toBe(false);
  });

  it('accepts a documented stage', () => {
    expect(stepStageSchema.safeParse({ businessStage: 'idea', location: 'Nassau' }).success).toBe(
      true,
    );
  });

  it('accepts zero employees but rejects negatives', () => {
    expect(stepTeamSchema.safeParse({ employeeCount: '0' }).success).toBe(true);
    expect(stepTeamSchema.safeParse({ employeeCount: '-1' }).success).toBe(false);
  });

  it('rejects fractional employee counts', () => {
    expect(stepTeamSchema.safeParse({ employeeCount: '2.5' }).success).toBe(false);
  });

  it('makes "I don\u2019t know" representable, but requires it to be said', () => {
    // Forcing a number would fabricate data the Funding Agent would later
    // treat as real. But a silently blank submission was indistinguishable
    // from never having been asked, which is the ambiguity ADR-0020 closed:
    // one of the two answers must be given.
    const declined = stepFundingSchema.parse({ fundingAmount: '', fundingUnknown: 'on' });
    expect(declined.fundingAmount).toBeUndefined();
    expect(declined.fundingUnknown).toBe(true);

    expect(stepFundingSchema.safeParse({ fundingAmount: '' }).success).toBe(false);
    expect(stepFundingSchema.safeParse({}).success).toBe(false);
  });

  it('lets the decline win over a figure left in the input', () => {
    // The two are the same answer; storing both would put a number in the
    // column beside a record saying the founder has none.
    const r = stepFundingSchema.parse({ fundingAmount: '50000', fundingUnknown: 'on' });
    expect(r.fundingAmount).toBeUndefined();
    expect(r.fundingUnknown).toBe(true);
  });

  it('accepts a funding figure', () => {
    expect(stepFundingSchema.parse({ fundingAmount: '50000' }).fundingAmount).toBe(50000);
  });

  it('rejects negative funding', () => {
    expect(stepFundingSchema.safeParse({ fundingAmount: '-5' }).success).toBe(false);
  });

  it('requires goals of at least a sentence', () => {
    expect(stepGoalsSchema.safeParse({ founderGoals: 'grow' }).success).toBe(false);
    expect(
      stepGoalsSchema.safeParse({ founderGoals: 'Open a second location within a year.' }).success,
    ).toBe(true);
  });
});

/**
 * A profile holding `answeredSlots` of the five facts.
 *
 * Progress is read from the VALUES now, not from `last_completed_step` — see
 * services/intake/knowledge.ts. A fixture that sets only the cursor no longer
 * describes an answered intake, which is the point of the change.
 */
function profile(
  answeredSlots: number,
  completedAt: string | null = null,
  cursor = answeredSlots,
): BusinessProfile {
  return {
    id: 'p1',
    business_id: 'b1',
    description: answeredSlots >= 1 ? 'A seafood takeaway in Nassau.' : null,
    business_stage: answeredSlots >= 2 ? 'idea' : null,
    location: answeredSlots >= 2 ? 'Nassau' : null,
    employee_count: answeredSlots >= 3 ? 3 : null,
    funding_requirement_amount: answeredSlots >= 4 ? 50000 : null,
    funding_requirement_currency: answeredSlots >= 4 ? 'BSD' : null,
    founder_goals: answeredSlots >= 5 ? 'Open a second location.' : null,
    products_services: null,
    target_customers: null,
    business_activities: null,
    operating_status: null,
    responses: {},
    last_completed_step: cursor,
    completed_at: completedAt,
    created_at: '2026-08-07T00:00:00Z',
    updated_at: '2026-08-07T00:00:00Z',
  };
}

describe('intakeProgress', () => {
  it('reports zero for a fresh intake', () => {
    expect(intakeProgress(profile(0)).percent).toBe(0);
  });

  it('reports 100% when every step is answered', () => {
    expect(intakeProgress(profile(TOTAL_INTAKE_STEPS)).percent).toBe(100);
  });

  it('never exceeds 100% if the stored cursor is somehow larger', () => {
    expect(intakeProgress(profile(5, null, 99)).percent).toBe(100);
  });

  it('measures what is known, not how far the founder walked', () => {
    // Cursor at the end, nothing actually stored: the old reading said 100%.
    // Funding does not count either — walking past it is not a decline.
    expect(intakeProgress(profile(0, null, 5)).percent).toBe(0);
    // Facts stored with the cursor at zero — the shape Nova will produce.
    expect(intakeProgress(profile(3, null, 0)).completed).toBe(3);
  });

  it('handles a missing profile', () => {
    expect(intakeProgress(null).completed).toBe(0);
  });

  it('distinguishes answered-all from formally completed', () => {
    expect(intakeProgress(profile(TOTAL_INTAKE_STEPS)).isComplete).toBe(false);
    expect(intakeProgress(profile(TOTAL_INTAKE_STEPS, '2026-08-07T00:00:00Z')).isComplete).toBe(
      true,
    );
  });
});
