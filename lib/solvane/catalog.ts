/**
 * Solvane Hub Tech — optional execution layer (architecture only).
 *
 * FoundryAI is Solvane's flagship product and Solvane is also a technology
 * services company, so FoundryAI may eventually offer an OPTIONAL path to
 * Solvane's execution help when a genuine business need calls for it. This
 * module establishes the boundary and vocabulary for that — and nothing more.
 *
 * ## Non-negotiable product principles (encoded as structure)
 *
 *  1. **A recommendation must originate from a real business need, goal, or
 *     initiative — never from the fact that Solvane exists.** That is why there
 *     is no "recommend Solvane" function here: the entry point is a
 *     `BusinessInitiative`, and Solvane is only ever ONE of its execution
 *     options.
 *  2. **The founder is never forced down the Solvane path.** Every initiative
 *     carries a first-class "do it myself" option; `executionOptions` is
 *     constructed self-first by `initiative()`.
 *  3. **FoundryAI stays valuable even if no Solvane service is ever bought.**
 *     Nothing here is persisted, wired to checkout, or required by the Business
 *     Intelligence Core. It is a typed boundary a future capability can build on
 *     without rewriting the Business Object.
 *
 * There is deliberately NO database table, marketplace, checkout, payment, or
 * fulfilment here (scope control). If service *requests* ever need persistence,
 * a `business_service_requests` table can be added additively later.
 */

export type SolvaneServiceCategory =
  | 'website_development'
  | 'website_redesign'
  | 'ecommerce_development'
  | 'mobile_app_development'
  | 'seo'
  | 'ai_automation'
  | 'software_development'
  | 'it_consulting'
  | 'strategic_technology_planning'
  | 'digital_transformation'
  | 'website_maintenance';

/** Which onboarding mode a service typically applies to. */
export type ServiceAudience = 'build' | 'manage' | 'both';

export interface SolvaneService {
  category: SolvaneServiceCategory;
  title: string;
  /** One line, plain. Not marketing copy. */
  summary: string;
  audience: ServiceAudience;
}

/**
 * The (small, illustrative) catalog. NOT exhaustive and NOT a committed product
 * surface — it is here so the categories have a single typed home. Extend it as
 * Solvane's real capabilities are confirmed.
 */
export const SOLVANE_SERVICES: readonly SolvaneService[] = [
  {
    category: 'website_development',
    title: 'Website development',
    summary: 'Design and build a new business website.',
    audience: 'build',
  },
  {
    category: 'website_redesign',
    title: 'Website redesign',
    summary: 'Modernise and improve an existing website.',
    audience: 'manage',
  },
  {
    category: 'ecommerce_development',
    title: 'E-commerce development',
    summary: 'Build or upgrade an online store.',
    audience: 'both',
  },
  {
    category: 'mobile_app_development',
    title: 'Mobile app development',
    summary: 'Build a mobile application.',
    audience: 'both',
  },
  { category: 'seo', title: 'SEO', summary: 'Improve search visibility.', audience: 'both' },
  {
    category: 'ai_automation',
    title: 'AI automation',
    summary: 'Automate a manual business process.',
    audience: 'both',
  },
  {
    category: 'software_development',
    title: 'Software development',
    summary: 'Build custom software.',
    audience: 'both',
  },
  {
    category: 'it_consulting',
    title: 'IT consulting',
    summary: 'Advice on technology decisions.',
    audience: 'both',
  },
  {
    category: 'strategic_technology_planning',
    title: 'Strategic technology planning',
    summary: 'Plan technology for growth.',
    audience: 'both',
  },
  {
    category: 'digital_transformation',
    title: 'Digital transformation',
    summary: 'Modernise how the business operates digitally.',
    audience: 'both',
  },
  {
    category: 'website_maintenance',
    title: 'Website maintenance',
    summary: 'Keep a website secure and current.',
    audience: 'manage',
  },
];

export function findSolvaneService(category: SolvaneServiceCategory): SolvaneService | null {
  return SOLVANE_SERVICES.find((s) => s.category === category) ?? null;
}

/** How an initiative can be executed. Self-service is always first-class. */
export type ExecutionOption =
  | { kind: 'self'; label: string }
  | { kind: 'solvane'; label: string; serviceCategory: SolvaneServiceCategory };

/**
 * A concrete initiative derived from a business need or goal.
 *
 * This is the ONLY place an optional Solvane service is surfaced — as one
 * execution option among others, downstream of a real `rationale`. There is no
 * function that recommends a service from nothing.
 */
export interface BusinessInitiative {
  title: string;
  /** Why this initiative follows from the business's need/goal. Required. */
  rationale: string;
  executionOptions: readonly ExecutionOption[];
}

/**
 * Build an initiative with a mandatory rationale and a self-first option list.
 *
 * If a Solvane service is offered it is appended AFTER the self option, encoding
 * principle (2): the founder always sees "do it myself" first, and Solvane only
 * ever as optional help for a need that already exists.
 */
export function initiative(params: {
  title: string;
  rationale: string;
  selfLabel?: string;
  solvane?: { label: string; serviceCategory: SolvaneServiceCategory };
}): BusinessInitiative {
  const options: ExecutionOption[] = [
    { kind: 'self', label: params.selfLabel ?? 'Plan it myself with FoundryAI' },
  ];
  if (params.solvane) {
    options.push({
      kind: 'solvane',
      label: params.solvane.label,
      serviceCategory: params.solvane.serviceCategory,
    });
  }
  return { title: params.title, rationale: params.rationale, executionOptions: options };
}
