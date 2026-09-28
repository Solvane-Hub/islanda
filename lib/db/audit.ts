import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';

/**
 * Audit repository. The ONLY place audit rows are written.
 *
 * audit_log has RLS enabled with zero policies, so it is unreachable by the
 * authenticated role. Writes go through the service-role client, which is why
 * this takes an explicit client rather than creating one — the caller must have
 * deliberately obtained admin privileges.
 */
export type AuditEvent =
  | 'auth.registered'
  | 'auth.signed_in'
  | 'auth.signed_out'
  | 'auth.password_reset_requested'
  | 'auth.password_reset_completed'
  | 'business.created'
  | 'business.updated'
  | 'business.archived'
  /**
   * Business Object onboarding. `business.built` is the new-founder (Build)
   * path; `business.imported` is the existing-business (Manage) path;
   * `business.identifier_added` records a sensitive identifier being stored.
   *
   * ⚠ Metadata carries SHAPE only — identifier type at most, never the
   *   identifier value, legal name, or any other sensitive content.
   */
  | 'business.built'
  | 'business.imported'
  | 'business.identifier_added'
  /**
   * Business Intelligence Core (P2). Metadata carries SHAPE only — a document
   * type, a metric key, a period label, a goal type — never a financial value,
   * a document's contents, or any sensitive figure.
   */
  | 'business.document_added'
  | 'business.financial_period_created'
  | 'business.metric_recorded'
  | 'business.goal_created'
  | 'business.goal_updated'
  /**
   * Business Case (P7.1) — a thin objective/owner/status correlation object.
   * Metadata carries SHAPE only — status value at most, never the case title
   * or objective text.
   */
  | 'business.case_created'
  | 'business.case_status_changed'
  /**
   * Generalized Evidence Linkage (P8 activation, ADR-0022). Metadata carries
   * SHAPE only — which kind of subject (metric, goal, ...) and the document
   * type, never a document's title or contents.
   */
  | 'business.evidence_attached'
  | 'intake.started'
  | 'intake.step_saved'
  | 'intake.knowledge_applied'
  | 'intake.completed'
  /**
   * Nova. Security Architecture requires AI generation to be recorded.
   *
   * ⚠ The metadata on these events carries the SHAPE of a run and nothing else:
   *   outcome, pack version, counts, correlation id. Never the founder's
   *   question, never retrieved legal text, never generated content. The
   *   reproducibility record in `agent_executions` observes the same rule.
   */
  | 'nova.answered'
  | 'nova.rate_limited'
  | 'nova.failed';

export interface AuditEntry {
  event: AuditEvent;
  actorId?: string | null;
  businessId?: string | null;
  correlationId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  metadata?: Record<string, unknown>;
}

export async function insertAuditEntry(
  admin: SupabaseClient<Database>,
  entry: AuditEntry,
): Promise<{ error: string | null }> {
  const { error } = await admin.from('audit_log').insert({
    event: entry.event,
    actor_id: entry.actorId ?? null,
    business_id: entry.businessId ?? null,
    correlation_id: entry.correlationId ?? null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent?.slice(0, 500) ?? null,
    metadata: (entry.metadata ?? {}) as never,
  });
  return { error: error?.message ?? null };
}
