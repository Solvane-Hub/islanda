import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database';
import type { BusinessMode } from '@/types/business';
import type {
  BusinessDocumentType,
  BusinessGoal,
  DocumentProcessingStatus,
  GoalProgress,
} from '@/types/business-intelligence';
import type { DerivedMetricView, MetricView } from '@/lib/business-intelligence/performance';
import type { MetricEvidenceView } from '@/services/evidence';
import type { BusinessRegulatoryRequirement } from '@/lib/db/regulatory';
import { assembleBusinessFacts } from '@/services/business/facts';
import { getActiveCountries, getBusinessLogoViewUrl } from '@/services/business';
import { findBusinessById } from '@/lib/db/businesses';
import { getFinancialPeriods, getBusinessMetrics } from '@/services/financials';
import { getGoalProgress } from '@/services/goals';
import { getBusinessDocuments } from '@/services/documents';
import { getEvidenceForMetrics } from '@/services/evidence';
import { getBusinessRegulatoryState } from '@/services/regulatory';
import { getIntakeProfile, intakeProgress } from '@/services/intake';
import { buildPerformanceView } from '@/lib/business-intelligence/performance';

/**
 * Business Passport (P7 Milestone 4) — a read-only composed view over
 * existing domain sources. It is NOT a fourth way of deriving business facts,
 * not a persistence table, and not a Nova/Intelligence-Gateway context: it
 * composes `assembleBusinessFacts` (identity/definition — Milestone 1) and
 * the existing financials, goals, documents and evidence (Milestone 3)
 * services exactly as they already exist, adding no new database access code
 * of its own beyond the one plain read for intake completeness (see
 * `completeness` below).
 *
 * Nothing here is wired into any UI, route, or Nova/Intelligence Gateway
 * call — that is a separate, later, explicitly-authorized milestone.
 *
 * ## Sections deliberately OMITTED here, and why
 *
 * - **Sensitive identifiers** (`business_identifiers`): never fetched.
 *   `assembleBusinessFacts` already excludes them structurally; Passport
 *   inherits that exclusion by never calling `getBusinessObject` itself.
 * - **Document storage/security fields** (`storage_path`, `content_type`,
 *   `byte_size`, `metadata`): `documents` below is a hand-projected subset of
 *   `BusinessDocument`, not the row itself.
 * - **Business cases**: `services/cases` is fully built (schema, RLS, tests)
 *   but has zero reachable write or read path from any UI today, and the
 *   only rows in the live database are accumulated test fixtures, not real
 *   product data. Composing them here would cost a query and add a field
 *   nothing consumes, while creating exactly the kind of surface a later
 *   change could accidentally start summarizing, ranking, or feeding into
 *   completeness/Nova without anyone deciding that on purpose. Per the
 *   milestone's own instruction, omitting them because they provide no
 *   current architectural value is the documented, deliberate choice here.
 *   `services/cases` itself is untouched and fully available whenever a
 *   future milestone gives cases a real product surface.
 */
export interface BusinessPassport {
  businessId: string;
  mode: BusinessMode;

  /**
   * A short-lived signed URL to the business's own uploaded logo (P7 Business
   * Passport, logo upload), or `null` when none has been uploaded. This is
   * the one field on Passport that is presentation infrastructure rather
   * than a business fact — it exists so the Passport UI never has to sign
   * its own storage URL, not because a logo is "identity" in the same sense
   * `identity` below is. Never derived from or duplicated into
   * `assembleBusinessFacts`/`NovaBusinessFacts`: Financial Nova has no use
   * for an image URL, and putting it there would mean it rides along inside
   * the JSON blob `buildUserPrompt` sends an LLM for no reason.
   */
  logoUrl: string | null;

  identity: {
    legalName: string | null;
    tradingName: string | null;
    businessType: string | null;
    industry: string | null;
    countryCode: string | null;
    /** Resolved via `getActiveCountries` — the same enrichment step Financial Nova's context already does. */
    jurisdictionName: string | null;
    stage: string | null;
    operatingStatus: string | null;
  };

  definition: {
    activities: string | null;
    productsServices: string | null;
    targetCustomers: string | null;
    location: string | null;
    employeeCount: number | null;
    founderGoals: string | null;
  };

  financials: {
    hasData: boolean;
    currentPeriodLabel: string | null;
    recorded: MetricView[];
    derived: DerivedMetricView[];
  };

  goals: { goal: BusinessGoal; progress: GoalProgress }[];

  documents: {
    id: string;
    title: string;
    documentType: BusinessDocumentType;
    processingStatus: DocumentProcessingStatus;
    documentDate: string | null;
    createdAt: string;
  }[];

  /** Metric → evidence → source document metadata. Never document contents. */
  evidenceForMetrics: Record<string, MetricEvidenceView[]>;

  /**
   * Always `[]` today — the regulatory catalog and every business's
   * regulatory-requirement rows are genuinely empty in the live database
   * (confirmed by direct row-count check during the Milestone 4 audit, not
   * assumed). An empty array here is the honest current state, not a
   * placeholder standing in for a feature that silently doesn't work.
   */
  regulatory: {
    requirements: BusinessRegulatoryRequirement[];
  };

  completeness: {
    intake: { completed: number; total: number; percent: number; isComplete: boolean };
    hasFinancials: boolean;
    hasGoals: boolean;
    hasDocuments: boolean;
  };
}

/**
 * Assemble the read-only Business Passport for one business.
 *
 * `null` means "not found or not accessible to the caller" — identical to
 * `assembleBusinessFacts`'s own convention, and Passport returns that `null`
 * immediately, before any other domain is queried. Every read below goes
 * through the caller's own RLS-scoped `db`; nothing here uses a service-role
 * client, and every subordinate service call is already individually scoped
 * by `app.business_access(business_id)` on its own tables — Passport adds no
 * authorization logic of its own, it inherits it by composing already-safe
 * primitives.
 */
export async function assembleBusinessPassport(
  db: SupabaseClient<Database>,
  businessId: string,
): Promise<BusinessPassport | null> {
  const facts = await assembleBusinessFacts(db, businessId);
  if (!facts) return null; // not found or not owned (RLS) — matches assembleBusinessFacts exactly

  const [countries, periods, metrics, documents, profile, regulatory, business] = await Promise.all(
    [
      getActiveCountries(db),
      getFinancialPeriods(db, businessId),
      getBusinessMetrics(db, businessId),
      getBusinessDocuments(db, businessId),
      // `intakeProgress` needs the raw profile row, which `BusinessFacts` does
      // not expose (it only carries the derived fields) — one extra read this
      // composition could not avoid without changing that shared contract,
      // which is explicitly out of scope. Everything else below reuses data
      // already in hand rather than re-fetching it.
      getIntakeProfile(db, businessId),
      getBusinessRegulatoryState(db, businessId),
      // Only `logo_storage_path` is needed from the row itself; `facts` above
      // already carries every founder-fact field `BusinessFacts` exposes, so
      // this fetch exists solely to reach the one column that isn't part of
      // that shared contract (and, correctly, never should be — see `logoUrl`
      // above).
      findBusinessById(db, businessId),
    ],
  );

  // Goals and evidence reuse the metrics/documents already fetched above
  // instead of letting each service fetch its own copy.
  const [goals, evidenceForMetrics, logoUrl] = await Promise.all([
    getGoalProgress(db, businessId, metrics),
    getEvidenceForMetrics(
      db,
      businessId,
      metrics.map((m) => m.id),
      documents,
    ),
    getBusinessLogoViewUrl(db, business?.logo_storage_path ?? null),
  ]);

  const performance = buildPerformanceView(periods, metrics);
  const jurisdictionName =
    countries.find((c) => c.code === facts.countryCode)?.name ?? facts.countryCode;

  return {
    businessId,
    mode: facts.businessMode,
    logoUrl,

    identity: {
      legalName: facts.legalName,
      tradingName: facts.tradingName,
      businessType: facts.businessType,
      industry: facts.industry,
      countryCode: facts.countryCode,
      jurisdictionName,
      stage: facts.stage,
      operatingStatus: facts.operatingStatus,
    },

    definition: {
      activities: facts.activities,
      productsServices: facts.productsServices,
      targetCustomers: facts.targetCustomers,
      location: facts.location,
      employeeCount: facts.employeeCount,
      founderGoals: facts.founderGoals,
    },

    financials: {
      hasData: performance.hasData,
      currentPeriodLabel: performance.currentPeriodLabel,
      recorded: performance.recorded,
      derived: performance.derived,
    },

    goals,

    documents: documents.map((d) => ({
      id: d.id,
      title: d.title,
      documentType: d.document_type,
      processingStatus: d.processing_status,
      documentDate: d.document_date,
      createdAt: d.created_at,
    })),

    evidenceForMetrics,

    regulatory: {
      requirements: regulatory,
    },

    completeness: {
      intake: intakeProgress(profile),
      hasFinancials: performance.hasData,
      hasGoals: goals.length > 0,
      hasDocuments: documents.length > 0,
    },
  };
}
