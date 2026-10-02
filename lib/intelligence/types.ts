import type { NovaPerformanceContext } from '@/lib/business-intelligence/performance';

/**
 * Intelligence Gateway — shared contracts (P5).
 *
 * The single, controlled vocabulary for Islanda's future LLM-powered
 * capabilities. Pure types only — no I/O, no provider SDK, importable anywhere.
 *
 * Core principle (see docs/architecture/intelligence-gateway.md): the LLM is
 * never the source of truth. Deterministic services own facts, calculations,
 * provenance and permissions; the gateway lets the LLM reason and communicate on
 * top of those facts, and preserves the epistemic distinctions end to end.
 */

/** The controlled categories every intelligence request is classified into. */
export type IntelligenceCategory =
  | 'regulatory'
  | 'compliance'
  | 'financial'
  | 'business'
  | 'performance'
  | 'documents'
  | 'strategy'
  | 'growth'
  | 'creative'
  | 'registry'
  | 'monitoring'
  | 'general';

export const INTELLIGENCE_CATEGORIES: readonly IntelligenceCategory[] = [
  'regulatory',
  'compliance',
  'financial',
  'business',
  'performance',
  'documents',
  'strategy',
  'growth',
  'creative',
  'registry',
  'monitoring',
  'general',
];

/**
 * Epistemic classification of a claim. The gateway preserves these — the LLM
 * must never turn FOUNDER_PROVIDED into VERIFIED_FACT, or UNKNOWN into FACT.
 */
export type EpistemicType =
  | 'FACT'
  | 'VERIFIED_FACT'
  | 'FOUNDER_PROVIDED'
  | 'DOCUMENT_DERIVED'
  | 'EXTERNAL_DATA'
  | 'CALCULATION'
  | 'REGULATORY_EVIDENCE'
  | 'RECOMMENDATION'
  | 'INFERENCE'
  | 'UNKNOWN';

export const EPISTEMIC_TYPES: readonly EpistemicType[] = [
  'FACT',
  'VERIFIED_FACT',
  'FOUNDER_PROVIDED',
  'DOCUMENT_DERIVED',
  'EXTERNAL_DATA',
  'CALCULATION',
  'REGULATORY_EVIDENCE',
  'RECOMMENDATION',
  'INFERENCE',
  'UNKNOWN',
];

/** How the router decided a request should be served. */
export type IntelligenceDetermination = 'deterministic' | 'llm' | 'premium';

/** Capability tiers (ADR-0019). Callers request a tier, never a model name. */
export type ModelTier = 'nano' | 'mini' | 'premium';

export type IntelligenceConfidence = 'low' | 'medium' | 'high';

/**
 * A reference to a piece of evidence supplied in the request context. The LLM
 * may only cite ids that were supplied — it cannot invent evidence.
 */
export interface EvidenceRef {
  id: string;
  /** e.g. 'financial_metric', 'goal', 'document'. */
  type: string;
  /** A human label, e.g. 'Q2 2026'. Never a sensitive value. */
  source: string;
  provenance: EpistemicType;
}

/**
 * The controlled context an LLM request may see. Assembled by the context
 * builder from non-sensitive Business Object + performance data. There is
 * deliberately NO field for a tax id, registration or licence number.
 */
export interface IntelligenceContext {
  businessId: string;
  identity: {
    legalName: string | null;
    tradingName: string | null;
    businessType: string | null;
    industry: string | null;
    jurisdiction: string | null;
    stage: string | null;
    operatingStatus: string | null;
  };
  definition: {
    activities: string | null;
    productsServices: string | null;
    targetCustomers: string | null;
    location: string | null;
  };
  goals: { title: string; targetLabel: string | null; progressPercent: number | null }[];
  performance: NovaPerformanceContext | null;
  evidence: EvidenceRef[];
}

export interface IntelligenceRequest {
  question: string;
  businessId: string;
  /** Optional caller hint; the router classifies regardless. */
  category?: IntelligenceCategory;
  context: IntelligenceContext;
  actorId?: string | null;
  correlationId?: string;
}

export interface IntelligenceRecommendation {
  text: string;
  /** Always RECOMMENDATION or INFERENCE — never a fact type. */
  basis: EpistemicType;
}

/** The validated structured response. LLM → structured intelligence, never UI. */
export interface IntelligenceResponse {
  answer: string;
  category: IntelligenceCategory;
  confidence: IntelligenceConfidence;
  recommendations: IntelligenceRecommendation[];
  evidence: EvidenceRef[];
  followUps: string[];
  unknowns: string[];
}

/** Safe, minimal usage metadata for accounting/auditability. No content. */
export interface IntelligenceUsage {
  determination: IntelligenceDetermination;
  llmCalled: boolean;
  provider: string | null;
  model: string | null;
  modelTier: ModelTier | null;
  modelReason: string | null;
  inputTokens: number | null;
  outputTokens: number | null;
  estimatedCostUsd: number | null;
  validationOk: boolean | null;
  failed: boolean;
  errorCode: string | null;
}

export type IntelligenceUnavailableReason =
  'provider_not_configured' | 'provider_error' | 'validation_failed';

/**
 * The gateway's outcome. `deterministic` tells the caller to answer from
 * deterministic services (no LLM ran). `answered` carries a validated response.
 * `unavailable` is the fail-safe degraded state — no fabricated answer.
 */
export type IntelligenceOutcome =
  | { status: 'deterministic'; category: IntelligenceCategory; usage: IntelligenceUsage }
  | {
      status: 'answered';
      category: IntelligenceCategory;
      response: IntelligenceResponse;
      usage: IntelligenceUsage;
    }
  | {
      status: 'unavailable';
      category: IntelligenceCategory;
      reason: IntelligenceUnavailableReason;
      usage: IntelligenceUsage;
    };
