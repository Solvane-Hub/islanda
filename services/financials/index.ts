import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type {
  BusinessFinancialPeriod,
  BusinessMetric,
  BusinessMetricKey,
  FinancialPeriodType,
} from '@/types/business-intelligence';
import type { FactProvenance } from '@/types/business';
import { AppError, newCorrelationId } from '@/lib/errors';
import { recordAuditEvent } from '@/services/audit';
import {
  insertFinancialPeriod,
  insertMetric,
  listFinancialPeriods,
  listMetricsForBusiness,
  listMetricsForPeriod,
} from '@/lib/db/financials';
import { derivePeriodLabel } from '@/lib/business-intelligence/period';
import type { RequestContext } from '@/services/auth';

/**
 * Financial Application Service — all writes for periods and metrics (ADR-0001).
 *
 * Ownership is enforced by RLS on insert (`app.business_access`); a write
 * against a business the caller does not own fails at the database. Every stored
 * metric carries provenance, and the DB CHECK forbids a founder- or AI-sourced
 * value from being `verified`. Audit metadata carries SHAPE only — a metric key
 * or period label, NEVER a financial value.
 */

export interface CreateFinancialPeriodInput {
  businessId: string;
  periodType: FinancialPeriodType;
  /** `YYYY-MM-DD`. */
  periodStart: string;
  /** `YYYY-MM-DD`. */
  periodEnd: string;
  /** Derived from the dates when omitted. */
  label?: string | undefined;
}

export interface RecordMetricInput {
  businessId: string;
  metricKey: BusinessMetricKey;
  value: number;
  /** Required when `metricKey` is 'other'; a human name for a custom metric. */
  label?: string | null;
  currency?: string | null;
  /** For non-monetary metrics, e.g. 'count', 'percent'. */
  unit?: string | null;
  financialPeriodId?: string | null;
  /** The document this value was extracted from, when document-derived. */
  sourceDocumentId?: string | null;
  asOfDate?: string | null;
  /** Defaults to founder_provided. Never silently promoted to verified. */
  provenance?: FactProvenance;
}

export async function createFinancialPeriod(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: CreateFinancialPeriodInput,
  ctx: RequestContext = {},
): Promise<BusinessFinancialPeriod> {
  const correlationId = ctx.correlationId ?? newCorrelationId();
  const label =
    input.label ?? derivePeriodLabel(input.periodType, input.periodStart, input.periodEnd);

  const { data, error } = await insertFinancialPeriod(db, {
    business_id: input.businessId,
    period_type: input.periodType,
    period_start: input.periodStart,
    period_end: input.periodEnd,
    label,
  });

  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that reporting period. Please try again.',
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.financial_period_created',
    actorId: ownerId,
    businessId: input.businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    metadata: { period_type: input.periodType, label },
  });

  return data;
}

export async function recordMetric(
  db: SupabaseClient<Database>,
  ownerId: string,
  input: RecordMetricInput,
  ctx: RequestContext = {},
): Promise<BusinessMetric> {
  const correlationId = ctx.correlationId ?? newCorrelationId();

  const { data, error } = await insertMetric(db, {
    business_id: input.businessId,
    metric_key: input.metricKey,
    value: input.value,
    label: input.label ?? null,
    currency: input.currency ?? null,
    unit: input.unit ?? null,
    financial_period_id: input.financialPeriodId ?? null,
    source_document_id: input.sourceDocumentId ?? null,
    as_of_date: input.asOfDate ?? null,
    provenance: input.provenance ?? 'founder_provided',
  });

  if (error || !data) {
    throw new AppError({
      code: 'UNEXPECTED',
      humanMessage: 'We could not save that figure. Please try again.',
      // developerMessage must never echo the metric value.
      developerMessage: error ?? 'insert returned no row',
      correlationId,
    });
  }

  await recordAuditEvent({
    event: 'business.metric_recorded',
    actorId: ownerId,
    businessId: input.businessId,
    correlationId,
    ipAddress: ctx.ipAddress ?? null,
    userAgent: ctx.userAgent ?? null,
    // Shape only — the metric KEY and provenance, never the value.
    metadata: { metric_key: input.metricKey, provenance: input.provenance ?? 'founder_provided' },
  });

  return data;
}

/** Read accessors so `app/` never imports the data-access layer (ADR-0001). */
export async function getFinancialPeriods(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessFinancialPeriod[]> {
  return listFinancialPeriods(db, businessId);
}

export async function getBusinessMetrics(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessMetric[]> {
  return listMetricsForBusiness(db, businessId);
}

export async function getMetricsForPeriod(
  db: SupabaseClient<Database>,
  periodId: string,
): Promise<BusinessMetric[]> {
  return listMetricsForPeriod(db, periodId);
}
