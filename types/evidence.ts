import type { Enums, Tables } from '@/types/database';

/**
 * Generalized Evidence Linkage domain types (ADR-0022, P8).
 *
 * Live in `types/` (not `lib/db/`) so `app/` and `components/` can name them
 * without importing the data-access layer (ADR-0001).
 */

export type BusinessEvidence = Tables<'business_evidence'>;
export type BusinessEvidenceForMetric = Tables<'business_evidence_for_metrics'>;
export type EvidenceRelationshipType = Enums<'evidence_relationship_type'>;
