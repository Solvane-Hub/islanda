/**
 * Centralized brand identity.
 *
 * Solvane Hub → Islanda → Nova. The company builds the product; the product
 * hosts the agent. New code should read the product/company/agent name from
 * here rather than writing the string inline, so a future name change is a
 * one-file edit rather than a repo-wide search.
 *
 * Historical documents, applied migration comments, and stable technical
 * identifiers (UUID namespaces, cookie/storage keys mid-transition) are
 * deliberately NOT sourced from here — see docs/decisions and the P8/rebrand
 * audit for why those stay as they are.
 */
export const PRODUCT_NAME = 'Islanda';
export const COMPANY_NAME = 'Solvane Hub';
export const AI_AGENT_NAME = 'Nova';
export const TAGLINE = "Navigate What's Next.";
