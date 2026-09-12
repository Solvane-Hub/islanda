import type {
  IntelligenceCategory,
  IntelligenceDetermination,
  ModelTier,
} from '@/lib/intelligence/types';

/**
 * The intelligence router — deterministic, rule-based, and FREE.
 *
 * Every request is classified into a category and a determination BEFORE any
 * model is considered. Classification itself never calls an LLM (that would cost
 * money to decide whether to spend money); it is keyword-based and pure. The
 * `nano` tier exists for future cheap LLM calls, not for this.
 *
 * The profitability rule is encoded here: default to `deterministic`. An LLM is
 * only chosen when the question genuinely asks for reasoning ("why", "explain",
 * "recommend", "should I"…), and the premium tier only for explicit
 * multi-source strategy/planning. "How much did revenue grow?" is deterministic;
 * "Why did revenue grow?" is llm; "Create a 12-month growth strategy…" is premium.
 */

export interface RoutingDecision {
  category: IntelligenceCategory;
  determination: IntelligenceDetermination;
  /** Null for a deterministic request (no model). */
  tier: ModelTier | null;
  /** A short, loggable reason for the model selection. No content. */
  modelReason: string;
}

const CATEGORY_PATTERNS: readonly { category: IntelligenceCategory; test: RegExp }[] = [
  {
    category: 'financial',
    test: /\b(revenue|profit|margin|expense|cash\s?flow|income|turnover|sales)\b/i,
  },
  {
    category: 'performance',
    test: /\b(perform|growth|grew|trend|compared?|quarter|q[1-4]\b|month(ly)?)\b/i,
  },
  {
    category: 'regulatory',
    test: /\b(vat|tax|licen[cs]e|permit|register(ed|ation)?|regulation|law|act\b)\b/i,
  },
  {
    category: 'compliance',
    test: /\b(compliance|comply|obligation|deadline|filing|renew(al)?)\b/i,
  },
  { category: 'documents', test: /\b(document|statement|upload|report|receipt|invoice|record)\b/i },
  { category: 'growth', test: /\b(grow|scale|expand|new market|more customers|increase sales)\b/i },
  { category: 'strategy', test: /\b(strategy|strategic|plan|roadmap|goal|objective|priorit)/i },
  { category: 'creative', test: /\b(brand|logo|design|aesthetic|tone|positioning|name for)\b/i },
  { category: 'registry', test: /\b(name available|trademark|business name|registry)\b/i },
  { category: 'monitoring', test: /\b(monitor|alert|changed?|what.?s new|notify)\b/i },
];

/** Reasoning verbs — a genuine ask for interpretation, not a fact lookup. */
const REASONING =
  /\b(why|explain|interpret|recommend|advise|suggest|should i|what should|how (can|do|should) i|improve|investigate|what could|what does .* mean|assess|evaluate|help me|how is|how are|how'?s)\b/i;

/** Multi-source strategy/planning — the only path to the premium tier. */
const PREMIUM =
  /\b(strategy|strategic plan|business plan|growth plan|12[-\s]?month|multi[-\s]?year|road\s?map|plan to (grow|scale|expand)|go[-\s]?to[-\s]?market)\b/i;

function inferCategory(question: string, hint?: IntelligenceCategory): IntelligenceCategory {
  if (hint) return hint;
  for (const { category, test } of CATEGORY_PATTERNS) if (test.test(question)) return category;
  return 'general';
}

export function classifyIntelligence(
  question: string,
  hint?: IntelligenceCategory,
): RoutingDecision {
  const category = inferCategory(question, hint);

  if (PREMIUM.test(question)) {
    return {
      category,
      determination: 'premium',
      tier: 'premium',
      modelReason: 'premium: multi-source strategy/planning request',
    };
  }

  if (REASONING.test(question)) {
    return {
      category,
      determination: 'llm',
      tier: 'mini',
      modelReason: 'llm: reasoning/interpretation request',
    };
  }

  return {
    category,
    determination: 'deterministic',
    tier: null,
    modelReason: 'deterministic: answerable from application logic',
  };
}
