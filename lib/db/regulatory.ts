import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

type Db = SupabaseClient<Database>;

export type RegulatoryRequirement = Database['public']['Tables']['regulatory_requirements']['Row'];

export type RegulatoryPathway = Database['public']['Tables']['regulatory_pathways']['Row'];

export type RegulatoryPathwayStep = Database['public']['Tables']['regulatory_pathway_steps']['Row'];

export type RegulatoryApplicabilityRule =
  Database['public']['Tables']['regulatory_applicability_rules']['Row'];

export type BusinessRegulatoryRequirement =
  Database['public']['Tables']['business_regulatory_requirements']['Row'];

export async function listPublishedRequirements(
  db: Db,
  jurisdiction: string,
): Promise<RegulatoryRequirement[]> {
  const { data } = await db
    .from('regulatory_requirements')
    .select('*')
    .eq('status', 'published')
    .eq('jurisdiction', jurisdiction)
    .order('title', { ascending: true });

  return data ?? [];
}

export async function findPublishedRequirementById(
  db: Db,
  requirementId: string,
): Promise<RegulatoryRequirement | null> {
  const { data } = await db
    .from('regulatory_requirements')
    .select('*')
    .eq('id', requirementId)
    .eq('status', 'published')
    .maybeSingle();

  return data ?? null;
}

export async function listPublishedPathways(
  db: Db,
  jurisdiction: string,
): Promise<RegulatoryPathway[]> {
  const { data } = await db
    .from('regulatory_pathways')
    .select('*')
    .eq('status', 'published')
    .eq('jurisdiction', jurisdiction)
    .order('name', { ascending: true });

  return data ?? [];
}

export async function listPublishedPathwaySteps(
  db: Db,
  pathwayId: string,
): Promise<RegulatoryPathwayStep[]> {
  const { data } = await db
    .from('regulatory_pathway_steps')
    .select('*')
    .eq('pathway_id', pathwayId)
    .eq('status', 'published')
    .order('step_number', { ascending: true });

  return data ?? [];
}

export async function listApplicabilityRules(
  db: Db,
  requirementId: string,
): Promise<RegulatoryApplicabilityRule[]> {
  const { data } = await db
    .from('regulatory_applicability_rules')
    .select('*')
    .eq('requirement_id', requirementId);

  return data ?? [];
}

export async function listBusinessRegulatoryRequirements(
  db: Db,
  businessId: string,
): Promise<BusinessRegulatoryRequirement[]> {
  const { data } = await db
    .from('business_regulatory_requirements')
    .select('*')
    .eq('business_id', businessId)
    .order('updated_at', { ascending: false });

  return data ?? [];
}
export async function upsertBusinessRegulatoryRequirement(
  db: Db,
  values: {
    business_id: string;
    requirement_id: string;
    state: 'needs_information' | 'not_applicable' | 'applicable';
    reason: string;
    missing_information: string[];
    last_evaluated_at: string;
  },
): Promise<{ data: BusinessRegulatoryRequirement | null; error: string | null }> {
  const { data, error } = await db
    .from('business_regulatory_requirements')
    .upsert(
      {
        business_id: values.business_id,
        requirement_id: values.requirement_id,
        state: values.state,
        reason: values.reason,
        missing_information: values.missing_information,
        last_evaluated_at: values.last_evaluated_at,
      },
      {
        onConflict: 'business_id,requirement_id',
      },
    )
    .select('*')
    .single();

  return {
    data: data ?? null,
    error: error?.message ?? null,
  };
}
