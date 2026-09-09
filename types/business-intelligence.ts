import type { Enums, Tables } from '@/types/database';
import type { FactProvenance } from '@/types/business';

/**
 * Business Intelligence Core domain types (P2).
 *
 * The durable spine for FoundryAI understanding a business over its lifecycle:
 * documents, financial periods, performance metrics, and goals. These live in
 * `types/` (not `lib/db/`) so `app/` and `components/` can name them without
 * importing the data-access layer.
 *
 * Provenance is the shared `fact_provenance` enum — every stored fact records
 * whether it is founder-provided, extracted from an uploaded document, verified
 * against external/authoritative evidence, or AI-derived. These origins never
 * silently blend, and a value is only ever `verified` when its provenance
 * genuinely supports it (enforced by DB CHECK).
 */

export type BusinessFinancialPeriod = Tables<'business_financial_periods'>;
export type FinancialPeriodType = Enums<'financial_period_type'>;

export type BusinessDocument = Tables<'business_documents'>;
export type BusinessDocumentType = Enums<'business_document_type'>;
export type DocumentProcessingStatus = Enums<'document_processing_status'>;
export type DocumentExtractionStatus = Enums<'document_extraction_status'>;

export type BusinessMetric = Tables<'business_metrics'>;
export type BusinessMetricKey = Enums<'business_metric_key'>;

export type BusinessGoal = Tables<'business_goals'>;
export type BusinessGoalType = Enums<'business_goal_type'>;
export type BusinessGoalStatus = Enums<'business_goal_status'>;

/**
 * Nova's intelligence categories — the durable vocabulary for the answer
 * contract's epistemic basis (product Part 7). These MUST stay distinct so a
 * future generative layer can never blur law, founder facts, document-derived
 * facts, financial calculations, external data and AI recommendations.
 *
 * Declared here as the single source of truth; Nova currently only emits
 * `regulatory`. Wiring the others is future work, gated behind their own
 * evidence/verification paths.
 */
export type IntelligenceCategory =
  | 'regulatory'
  | 'business'
  | 'financial'
  | 'strategy'
  | 'creative'
  | 'document'
  | 'registry'
  | 'monitoring'
  | 'roadmap';

/**
 * Goal progress — DERIVED, never stored.
 *
 * Computed by comparing a goal's target to the most authoritative recorded
 * metric for its `target_metric_key`. Kept out of the database on purpose: a
 * stored progress value would drift the moment a new metric arrives, and would
 * duplicate a fact the metrics already hold (product Part 5 — progress is
 * derived from metrics).
 */
export interface GoalProgress {
  goalId: string;
  targetValue: number | null;
  /** The latest authoritative metric value for the goal's metric, if any. */
  currentValue: number | null;
  /** 0–100, or null when it cannot be computed (no target or no metric). */
  percent: number | null;
  /** Provenance of the metric behind `currentValue`, so the UI can label it. */
  currentValueProvenance: FactProvenance | null;
}
