import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

import { findProfileByBusinessId } from '@/lib/db/business-profiles';
import {
  listApplicabilityRules,
  listBusinessRegulatoryRequirements,
  listPublishedRequirements,
  upsertBusinessRegulatoryRequirement,
} from '@/lib/db/regulatory';
import { findBusinessById } from '@/lib/db/businesses';
import { evaluateApplicability } from '@/services/regulatory/applicability';

type Db = SupabaseClient<Database>;

export interface RegulatoryEvaluationSummary {
  evaluated: number;
  applicable: number;
  notApplicable: number;
  needsInformation: number;
}

export async function evaluateBusinessRequirements(
  db: Db,
  businessId: string,
): Promise<RegulatoryEvaluationSummary> {
  const business = await findBusinessById(db, businessId);

  if (!business) {
    return {
      evaluated: 0,
      applicable: 0,
      notApplicable: 0,
      needsInformation: 0,
    };
  }

  const profile = await findProfileByBusinessId(db, businessId);

  const requirements = await listPublishedRequirements(db, business.country_code);

  const knowledge: Record<string, unknown> = {
    business: {
      id: business.id,
      name: business.name,
      industry: business.industry,
      country_code: business.country_code,
    },
    profile: {
      business_stage: profile?.business_stage ?? null,
      description: profile?.description ?? null,
      employee_count: profile?.employee_count ?? null,
      location: profile?.location ?? null,
      founder_goals: profile?.founder_goals ?? null,
      funding_requirement_amount: profile?.funding_requirement_amount ?? null,
      funding_requirement_currency: profile?.funding_requirement_currency ?? null,
      responses: profile?.responses ?? {},
    },
  };

  let applicable = 0;
  let notApplicable = 0;
  let needsInformation = 0;

  for (const requirement of requirements) {
    const rules = await listApplicabilityRules(db, requirement.id);
    const result = evaluateApplicability(rules, knowledge);

    const { error } = await upsertBusinessRegulatoryRequirement(db, {
      business_id: business.id,
      requirement_id: requirement.id,
      state: result.state,
      reason: result.reason,
      missing_information: result.missingInformation,
      last_evaluated_at: new Date().toISOString(),
    });

    if (error) {
      throw new Error(`Failed to persist regulatory requirement ${requirement.id}: ${error}`);
    }

    switch (result.state) {
      case 'applicable':
        applicable += 1;
        break;

      case 'not_applicable':
        notApplicable += 1;
        break;

      case 'needs_information':
        needsInformation += 1;
        break;
    }
  }

  return {
    evaluated: requirements.length,
    applicable,
    notApplicable,
    needsInformation,
  };
}

export async function getBusinessRegulatoryState(db: Db, businessId: string) {
  return listBusinessRegulatoryRequirements(db, businessId);
}
