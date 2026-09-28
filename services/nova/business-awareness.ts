import type { Business, BusinessProfile } from '@/types/business';
import type { NovaUnresolved } from '@/lib/ai/agents/nova/contract';
import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';

/**
 * Business-aware Nova — the deterministic bridge between the Business Object and
 * a regulatory answer.
 *
 * ## The line this module must never cross
 *
 * It states the founder's own BUSINESS FACTS and Nova's own EPISTEMIC LIMITS.
 * It never interprets the law. It composes no paraphrase of a provision, draws
 * no legal conclusion, and asserts nothing a citation would be needed for — that
 * boundary is the same one `lib/nova/narration.ts` and `components/ui/nova-answer.tsx`
 * hold, and it is why business-awareness can exist without a generative model.
 *
 *   ✅ "You're operating a restaurant in New Providence, so I read the material
 *       below in that context."                         (a business fact)
 *   ✅ "You haven't told me your turnover, so I can't work out whether a
 *       turnover-based obligation applies."             (an epistemic limit)
 *   ❌ "Because you earn over $100,000 you must register for VAT."
 *                                                       (a legal conclusion — forbidden)
 *
 * ## Founder facts are never converted into verified facts
 *
 * Everything here is founder-provided context. Nothing is promoted to
 * government-verified, and nothing the founder did NOT provide is invented — a
 * missing decisive fact is reported as missing (product §2, §5, §6).
 *
 * ## Sensitive identifiers cannot reach this layer
 *
 * `NovaBusinessFacts` has no field for a tax id, registration or licence number.
 * The exclusion is structural, not a filter that could be forgotten.
 */

/** The non-sensitive Business Object facts Nova may reason with. No identifiers. */
export interface NovaBusinessFacts {
  legalName: string | null;
  tradingName: string | null;
  businessType: string | null;
  industry: string | null;
  activities: string | null;
  productsServices: string | null;
  targetCustomers: string | null;
  location: string | null;
  /** The stored enum value (e.g. 'operating'); labelled for display separately. */
  stage: string | null;
  operatingStatus: string | null;
  employeeCount: number | null;
  founderGoals: string | null;
}

/** One founder-provided fact, ready to show as context. */
export interface NovaKnownFact {
  label: string;
  value: string;
}

/**
 * The business-aware layer attached to an answer.
 *
 * `category` is the intelligence category (§3): this path is always regulatory,
 * evidence-backed. It is stated explicitly so the presentation layer, and any
 * future router, can keep categories from blending.
 */
export interface NovaBusinessContext {
  category: 'regulatory';
  /** Founder-provided facts Nova used as context. Never verified, never invented. */
  knownFacts: readonly NovaKnownFact[];
  /** A law-free framing sentence, or null when there is too little context. */
  relevance: string | null;
  /** Decisive facts Nova does not hold, reported as gaps — never guessed. */
  openQuestions: readonly NovaUnresolved[];
  /** At most one focused question to the founder, when a single fact is decisive. */
  clarifyingQuestion: string | null;
}

/**
 * Build the non-sensitive fact set from the Business Object.
 *
 * ⚠ Takes only non-sensitive columns. There is deliberately no parameter for
 *   `business_identifiers` — a tax id or registration number cannot be passed
 *   in, so it can never reach the query representation or the answer.
 */
export function toNovaBusinessFacts(
  business: Pick<Business, 'legal_name' | 'trading_name' | 'business_type' | 'industry'>,
  profile: Pick<
    BusinessProfile,
    | 'business_activities'
    | 'products_services'
    | 'target_customers'
    | 'location'
    | 'business_stage'
    | 'operating_status'
    | 'employee_count'
    | 'founder_goals'
  > | null,
): NovaBusinessFacts {
  return {
    legalName: business.legal_name,
    tradingName: business.trading_name,
    businessType: business.business_type,
    industry: business.industry,
    activities: profile?.business_activities ?? null,
    productsServices: profile?.products_services ?? null,
    targetCustomers: profile?.target_customers ?? null,
    location: profile?.location ?? null,
    stage: profile?.business_stage ?? null,
    operatingStatus: profile?.operating_status ?? null,
    employeeCount: profile?.employee_count ?? null,
    founderGoals: profile?.founder_goals ?? null,
  };
}

function hasText(value: string | null | undefined): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function stageLabel(stage: string | null): string | null {
  if (!hasText(stage)) return null;
  return BUSINESS_STAGE_LABELS[stage as BusinessStage] ?? stage;
}

/** The decision-relevant facts, in a stable order, that Nova is working with. */
function knownFactsFrom(facts: NovaBusinessFacts): NovaKnownFact[] {
  const rows: NovaKnownFact[] = [];
  const push = (label: string, value: string | null) => {
    if (hasText(value)) rows.push({ label, value: value.trim() });
  };
  push('Industry', facts.industry);
  push('Activities', facts.activities);
  push('Location', facts.location);
  push('Stage', stageLabel(facts.stage));
  push('Operating status', facts.operatingStatus);
  if (facts.employeeCount !== null && facts.employeeCount !== undefined) {
    rows.push({
      label: 'Team',
      value: facts.employeeCount === 1 ? 'Just you' : `${facts.employeeCount} people`,
    });
  }
  return rows;
}

/**
 * A law-free sentence naming why Nova read the material in this business's
 * context. States business facts only — it never says the law applies.
 */
function composeRelevance(facts: NovaBusinessFacts): string | null {
  const stageVerb = ((): string | null => {
    switch (facts.stage) {
      case 'operating':
        return 'operating';
      case 'expanding':
        return 'growing';
      case 'pre_launch':
        return 'getting ready to launch';
      case 'planning':
        return 'planning';
      case 'idea':
        return 'shaping';
      default:
        return null;
    }
  })();

  const who = hasText(facts.industry)
    ? `a ${facts.industry.trim().toLowerCase()} business`
    : hasText(facts.tradingName)
      ? facts.tradingName.trim()
      : null;
  const where = hasText(facts.location) ? ` in ${facts.location.trim()}` : '';

  if (who && stageVerb) {
    return `Because you're ${stageVerb} ${who}${where}, I read the published material below in that context.`;
  }
  if (who) {
    return `Because you're building ${who}${where}, I read the published material below in that context.`;
  }
  if (where) {
    return `Because you're operating${where}, I read the published material below in that context.`;
  }
  return null;
}

/** A conservative decisive-fact detector, gated on evidence text and business gaps. */
interface Detector {
  id: string;
  /** Fires only when the question/evidence is actually about this area. */
  test: RegExp;
  /** Null when the fact is already known (so no gap to report). */
  openQuestion: (facts: NovaBusinessFacts) => NovaUnresolved | null;
  clarifying: (facts: NovaBusinessFacts) => string | null;
}

const DETECTORS: readonly Detector[] = [
  {
    id: 'turnover',
    // Islanda never collects turnover, so this is always a genuine gap when the
    // question/evidence is about VAT or a monetary threshold. Kept narrow: a bare
    // "register" (e.g. registering employees) must not trigger a turnover gap.
    test: /\b(vat|value added tax|turnover|taxable suppl(?:y|ies)|threshold)\b/i,
    openQuestion: () => ({
      question: 'Your current taxable turnover',
      why:
        "You haven't told me your turnover, so I can't work out whether anything that depends on a " +
        "turnover threshold applies to your business. The material above sets conditions I can't " +
        'check without it — I am not assuming either way.',
    }),
    clarifying: () =>
      "Roughly what is your annual turnover? That's the missing piece for anything that turns on a threshold.",
  },
  {
    id: 'employees',
    test: /\b(employ(?:ee|er|ment|s)?|worker|payroll|national insurance|nib)\b/i,
    openQuestion: (facts) =>
      facts.employeeCount !== null && facts.employeeCount !== undefined
        ? null
        : {
            question: 'How many people you employ',
            why:
              "You haven't told me your headcount, so I can't tell whether an obligation that depends " +
              'on the number of employees applies to your business.',
          },
    clarifying: (facts) =>
      facts.employeeCount !== null && facts.employeeCount !== undefined
        ? null
        : 'How many people do you employ? Some obligations only start at a certain headcount.',
  },
];

const MAX_OPEN_QUESTIONS = 2;

/**
 * Build the business-aware layer for an answer.
 *
 * Returns null when there is nothing business-specific to add — no facts and no
 * gaps — so the presentation layer shows nothing rather than an empty shell.
 * Only produced for an ANSWERED outcome: with no retrieved material there is
 * nothing to frame or to gate the decisive-fact detectors against.
 */
export function buildBusinessContext(input: {
  facts: NovaBusinessFacts;
  question: string;
  outcome: 'answered' | 'no_published_knowledge' | 'no_matching_evidence' | 'needs_clarification';
  claims: readonly { statement: string; sectionReference: string | null }[];
  documents: readonly string[];
}): NovaBusinessContext | null {
  if (input.outcome !== 'answered') return null;

  const knownFacts = knownFactsFrom(input.facts);
  const relevance = composeRelevance(input.facts);

  const haystack = [
    input.question,
    ...input.claims.map((c) => c.statement),
    ...input.claims.map((c) => c.sectionReference ?? ''),
    ...input.documents,
  ]
    .join(' ')
    .toLowerCase();

  const openQuestions: NovaUnresolved[] = [];
  const clarifiers: string[] = [];
  for (const detector of DETECTORS) {
    if (!detector.test.test(haystack)) continue;
    const gap = detector.openQuestion(input.facts);
    if (gap) {
      openQuestions.push(gap);
      const clarifying = detector.clarifying(input.facts);
      if (clarifying) clarifiers.push(clarifying);
    }
  }

  const limitedOpen = openQuestions.slice(0, MAX_OPEN_QUESTIONS);

  // Nothing business-specific to say at all.
  if (knownFacts.length === 0 && !relevance && limitedOpen.length === 0) return null;

  return {
    category: 'regulatory',
    knownFacts,
    relevance,
    openQuestions: limitedOpen,
    // Ask a focused clarification ONLY when exactly one fact is decisive — never
    // turn Nova into a questionnaire (§8).
    clarifyingQuestion: limitedOpen.length === 1 ? (clarifiers[0] ?? null) : null,
  };
}
