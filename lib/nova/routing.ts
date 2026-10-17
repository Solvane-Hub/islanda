/**
 * Which Nova path a question takes.
 *
 *   • `regulatory` — the extractive path: Knowledge Pack retrieval, the
 *     deterministic quoting reasoner, the citation gate. No model.
 *   • `general`    — the Intelligence Gateway: validated LLM reasoning over the
 *     founder's own non-sensitive business context. Never a source of law.
 *
 * ## ⚠ `general` is an ALLOWLIST. Everything else is `regulatory`.
 *
 * The two misroutes do not cost the same. A general question sent down the
 * regulatory path gets a calm, honest refusal ("the sources do not cover
 * this"). A regulatory question sent to a model risks a fabricated rate,
 * deadline or requirement — the one failure this product exists to prevent
 * (AI Safety Framework H2, S1).
 *
 * An earlier version listed regulatory words and sent everything else to the
 * model. An audit showed that fails open: "Can I sell homemade food from my
 * kitchen?", "Should I be a sole trader or a company?", "Can I pay my workers in
 * cash?", "How long should I keep my records?" carry no legal vocabulary and
 * are regulatory all the same. A denylist cannot enumerate every way of asking
 * "am I allowed to". So a question is `general` only when BOTH:
 *
 *   1. it names a recognised general-business topic (marketing, branding,
 *      customers, pricing, planning, margins…), and
 *   2. it carries NO veto: no regulatory vocabulary, no permission/obligation
 *      framing, and no regulated domain (employment, contracts, IP, privacy,
 *      records, business structure, financial products, restricted goods,
 *      trade, business set-up).
 *
 * Anything unrecognised is `regulatory`. A false positive costs a refusal; a
 * false negative costs trust.
 *
 * It is deliberately separate from the gateway's category router
 * (`lib/intelligence/router.ts`), which is a COST router — it classifies "What
 * records am I required to keep?" as `documents`. This one is a SAFETY router.
 *
 * Pure and keyword-based: no model decides whether a model may answer. The
 * vocabulary is generic — no country, agency or statute is named here (CLAUDE.md:
 * no country-specific assumptions outside the Knowledge Pack).
 *
 * Downstream gates (`services/nova/general.ts`), independent of this one:
 *   • the model's own category — regulatory/compliance ⇒ answer discarded;
 *   • an output scan — legal vocabulary in the answer ⇒ answer discarded.
 */

export type NovaRoute = 'regulatory' | 'general';

/** Recognised general-business topics. A question must match one to be `general`. */
const GENERAL_TOPICS: readonly RegExp[] = [
  // Marketing and presence.
  /\b(marketing|advertis\w*|promot\w*|campaigns?|social media|instagram|facebook|tiktok|linkedin|followers|captions?|posts?|content|newsletters?|seo|websites?|online presence)\b/i,
  // Brand and positioning.
  /\b(brand\w*|taglines?|slogans?|name for|naming|colou?rs|positioning|value proposition|elevator pitch|pitch)\b/i,
  // Customers.
  /\b(customers?|clients?|footfall|loyalty|retention|referrals?|reviews?|word of mouth)\b/i,
  // Pricing and selling.
  /\b(pric\w*|markups?|discounts?|bundles?|upsell\w*|sell more|more sales|increase sales)\b/i,
  // Planning.
  /\b(business plan|strateg\w*|goals?|prioriti\w*|productiv\w*|time management|competitors?|competition|niche|target market|ideas for|brainstorm\w*)\b/i,
  // The founder's own numbers (figures come from context, never from the model).
  /\b(profit margins?|margins?|break.?even|budget\w*|reduce costs?|cut costs?|costs?|grow|growth|scale|revenue)\b/i,
];

/**
 * Vetoes. Any match routes `regulatory`, whatever the topic.
 *
 * Grouped by why the question cannot go to a model. Broad on purpose: each
 * false positive here costs one honest refusal.
 */
const VETOES: readonly RegExp[] = [
  // Law and its instruments.
  /\b(law|laws|legal|legally|illegal|legislat\w*|statut\w*|act|acts|regulat\w*|bylaws?|ordinances?|gazett\w*|rules?|lawyers?|attorneys?)\b/i,
  // Obligation and permission vocabulary.
  /\b(must|have to|has to|required?|requirements?|mandatory|compulsory|obliged|obligations?|allowed|permitted|permission|prohibited|banned|entitled|eligib\w*|consent)\b/i,
  // Permission/obligation FRAMING without the vocabulary.
  /^\s*(can|may|could)\s+(i|we|my|a|an|the|someone|people|customers?|clients?|they|you)\b/i,
  /\b(is it|are we|am i)\s+(ok|okay|alright|fine|legal|safe|able|supposed)\b/i,
  /\b(do|does|did)\s+(i|we|my business)\s+(need|have)\b/i,
  /\bwhat (do|does) (i|we|my business) need\b/i,
  /\bwhat happens if\b/i,
  // A yes/no question about acceptability: "Is selling X to customers fine?"
  /\b(ok|okay|alright|fine|legal|safe|a good idea)\s*\??\s*$/i,
  /\b(paperwork|forms|documents)\b/i,
  // Authorisations.
  /\b(licen[cs]\w*|permits?|certificat\w*|registr\w*|register\w*|incorporat\w*|approvals?|exemptions?|exempt|business number)\b/i,
  // Tax and charges.
  /\b(tax\w*|vat|gst|duty|duties|customs|tariffs?|levy|levies|fees?|fines?|penalt\w*|sanctions?|owe|deduct\w*|write.?offs?|declare)\b/i,
  // Compliance, filing, records and enforcement.
  /\b(complian\w*|comply\w*|filings?|file|returns?|deadlines?|due|renew\w*|audits?|inspect\w*|enforce\w*|offen[cs]es?|records?|receipts?|bookkeeping)\b/i,
  // The state.
  /\b(government|ministry|ministries|department|authority|authorities|agency|agencies|regulators?|official|national insurance|social security)\b/i,
  // Employment.
  /\b(employ\w*|staff|workers?|interns?|contractors?|helpers?|hire|hiring|dismiss\w*|fire|firing|let (someone|them|him|her) go|wages?|salar\w*|payroll|pensions?|contributions?|holidays?|leave|notice|overtime|hours)\b/i,
  // Contracts, consumer rights and liability.
  /\b(contracts?|agreements?|terms and conditions|t&cs?|refunds?|warrant\w*|guarantees?|liabilit\w*|liable|lawsuits?|sue|court|disputes?|rights|not pay|unpaid|debt collect\w*)\b/i,
  // Intellectual property.
  /\b(trademarks?|copyrights?|patents?|intellectual property|protect my|cop(y|ied|ying)|songs?|music)\b/i,
  // Privacy and data.
  /\b(privacy|data protection|personal (data|information)|customer (data|details|information|phone|emails?|list)|phone numbers|email (my|our) customers|cctv|cameras?|surveillance|record(ing)? calls)\b/i,
  // Business structure and set-up.
  /\b(sole trader|sole proprietor\w*|partnerships?|compan(y|ies)|llcs?|corporations?|limited|ltd|ibc|structure|bank account)\b/i,
  /\b(start|open|set up|setting up|launch)\w*\s+(a|an|my|our)?\s*(business|company|shop|store|salon|restaurant|bar|food truck|kitchen)\b/i,
  /\bstart(ing)? trading\b/i,
  // Financial products — regulated advice (AI Safety Framework §6, H5).
  /\b(loans?|borrow\w*|debt|credit|invest\w*|savings|mortgages?|crypto\w*|bitcoin|stocks?|shares|interest rates?|insurance)\b/i,
  // Selling food or drink — health and food-safety rules almost everywhere.
  /\bsell(ing)?\s+(\w+\s+)?(food|drinks?|meals?|milk|meat|fish|eggs|produce|baked goods)\b/i,
  // Restricted goods, health and trade.
  /\b(alcohol|liquor|beer|wine|rum|spirits|tobacco|vap(e|ing)|cannabis|cbd|marijuana|medicine|medical|pharma\w*|drugs?|supplements?|cosmetics?|firearms?|guns?|weapons?|gambling|lottery|homemade food|home.?made food|food (handler|safety|hygiene)|health and safety|zoning|import\w*|export\w*|ship(ping)? (to|abroad|overseas))\b/i,

  // ── Imposed charges, asked about in marketing or copywriting language ──
  //
  // The question that leaked: "Brainstorm ideas for a website banner explaining
  // what percentage gets added to prices at checkout". No legal word at all —
  // but a charge someone ELSE adds at checkout is very often a tax or another
  // mandatory charge, and any explanation of it is a claim about that
  // obligation. The owner's OWN choices ("what markup percentage should I
  // use?", "a 10% discount") are not caught: the distinction is a charge that
  // is ADDED / COLLECTED / IMPOSED, not a number the owner picks.
  /\b(surcharges?|service charges?|cover charges?|gratuit(y|ies)|obligatory|statutory)\b/i,
  /\bthe state\b(?!\s+of\b)/i,
  /\b(state|government|officially)[- ](collected|imposed|mandated|set|charged)\b/i,
  // A charge or percentage that gets added/collected/imposed…
  /\b(percentage|percent|per ?cent|%|amount|charges?|extra|costs?)\b[^.?!]{0,50}\b(added|applied|charged|collected|levied|imposed|withheld|deducted|on top)\b/i,
  // …or is added at the point of sale / onto prices.
  /\b(added|applied|charged|collected|levied|imposed|withheld|deducted)\b[^.?!]{0,50}\b(checkout|till|register|counter|each (sale|order|purchase|item)|every (sale|order|purchase|item)|(my |our |the )?prices?)\b/i,
  // A percentage or charge mentioned together with the checkout/till.
  /\b(checkout|till|register)\b[^.?!]*\b(percentage|percent|%|charges?|extra|added)\b/i,
  /\b(percentage|percent|%|charges?|extra)\b[^.?!]*\b(checkout|till|register)\b/i,
  // Copy that EXPLAINS a charge to customers is a claim about it.
  /\b(explain\w*|tell\w*|inform\w*|announc\w*|disclos\w*|justif\w*|word\w*|say\w*)\b[^.?!]{0,60}\b(charges?|percentage|extra (amount|cost|charge)|why (prices?|costs?) (went|go|are going) up)\b/i,
  // Inclusive/exclusive pricing is almost always about a tax.
  /\b(inclusive|exclusive) (pricing|prices?)\b|\bprices? (inclusive|exclusive) of\b|\b(inclusive|exclusive) of\b/i,
];

export function routeNovaQuestion(question: string): NovaRoute {
  if (VETOES.some((pattern) => pattern.test(question))) return 'regulatory';
  return GENERAL_TOPICS.some((pattern) => pattern.test(question)) ? 'general' : 'regulatory';
}

/**
 * Legal vocabulary that must not appear in a GENERAL answer.
 *
 * Narrower than `VETOES`: ordinary business prose says "must", "rules" and
 * "fee" constantly ("you must post consistently", "a delivery fee"), and a scan
 * that fired on those would discard every answer. These words have no business
 * in a marketing or pricing answer; their presence means the model drifted into
 * the territory rule 9 forbids, and the answer is discarded rather than shown.
 */
const OUTPUT_LEGAL_VOCABULARY: readonly RegExp[] = [
  /\b(laws?|legal(ly)?|illegal|legislation|statut\w*|regulations?|regulatory|licen[cs]\w*|permits?|tax\w*|vat|customs duty|penalt\w*|complian\w*|lawyers?|attorneys?)\b/i,
  // Charge and obligation phrasing — the leaked banner answer explained an
  // unnamed checkout charge without using any word above.
  /\b(surcharges?|service charges?|levy|levies|mandatory|compulsory|obligatory|required by|government|the state(?! of)|officially)\b/i,
  /\b(added|applied|collected|charged) (at|during) (the )?(checkout|till|register|point of sale)\b/i,
  /\b(percentage|charge) (is|gets|will be) (added|applied|collected|charged)\b/i,
];

export function containsLegalVocabulary(text: string): boolean {
  return OUTPUT_LEGAL_VOCABULARY.some((pattern) => pattern.test(text));
}
