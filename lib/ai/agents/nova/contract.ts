import type { SourceAuthority } from '@/types/knowledge';

/**
 * Nova's agent output envelope — Specialist Agent Contract (AI document 4) §5,
 * ADR-0017.
 *
 * "Every agent returns exactly this shape. No exceptions." Nova is the first
 * agent to implement it, so this file is where the envelope stops being a
 * document and becomes a type.
 *
 * ⚠ Four hard obligations from §1, all enforced below by `assertEnvelopeValid`:
 *     emit the envelope · bind every claim to retrieved evidence ·
 *     be idempotent · never self-assess trust.
 *
 * Layer note: `lib/ai/**` must not import `lib/db` or `services` (ESLint).
 * That is why the reasoner's evidence input is defined here rather than reusing
 * `NovaRetrievedChunk` from `services/nova/retrieval.ts`. The Assistant Service
 * maps between them; the agent stays a pure function of its inputs.
 */

export const NOVA_AGENT = 'nova';

/** Bumped when the agent's contract or behaviour changes. */
export const NOVA_AGENT_VERSION = '1.0.0';

/**
 * Extractive Nova has no prompt. This value occupies `promptVersion` because the
 * reasoner plays exactly the role a prompt plays: it is the versioned, in-Git
 * artifact that determines the output (Prompt Engineering Standard P1 —
 * "prompts are source code"). Recording it keeps replay meaningful.
 */
export const NOVA_REASONER_VERSION = 'nova-extractive@1.0.0';

/**
 * Stated explicitly rather than left blank. An empty `modelVersion` on a
 * replayed run is indistinguishable from a value nobody recorded; this says
 * affirmatively that no model was involved.
 */
export const NOVA_NO_MODEL = 'none:deterministic-extractive';

/** §5 status set. `ERROR` exists for the runner; the reasoner never returns it. */
export type NovaStatus =
  'OK' | 'NO_AUTHORITATIVE_INFORMATION_FOUND' | 'NEEDS_CLARIFICATION' | 'ERROR';

/**
 * §5.1 — the load-bearing field.
 *
 * `chunkId` is the single citation identity (A12). `quote` is the verbatim
 * supporting text, without which the Trust Layer cannot assess Evidence
 * Strength and the claim is quarantined.
 *
 * ⚠ Carries Source Authority only. Evidence Strength, Reasoning Confidence,
 *   Trust Level and Trust Score are derived per claim by the Trust Layer and
 *   must never appear here (A4, ADR-0015).
 */
export interface NovaEvidenceRef {
  chunkId: string;
  quote: string;
  sourceAuthority: SourceAuthority;
}

export interface NovaClaimContent {
  /**
   * For extractive Nova this is the quoted passage itself, byte-identical to
   * `evidence[0].quote`. That equality is the anti-fabrication guarantee and is
   * asserted by test rather than left as a convention.
   */
  statement: string;
  sectionReference: string | null;
  regulatoryDomain: string | null;
}

export interface NovaClaim {
  /** §6 — a hash of normalised content, so a retry produces matching claims. */
  claimId: string;
  content: NovaClaimContent;
  evidence: readonly NovaEvidenceRef[];
  /**
   * §5.2 — the agent reports the count; the Trust Layer maps it to Reasoning
   * Confidence. Always 1 here: a quotation restates one passage.
   */
  reasoningHops: number;
}

/** §5.3 — not failure. Dropping what could not be determined produces a confidently incomplete answer. */
export interface NovaUnresolved {
  question: string;
  why: string;
}

export interface NovaEnvelope {
  status: NovaStatus;
  agent: typeof NOVA_AGENT;
  agentVersion: string;
  promptVersion: string;
  modelVersion: string;
  knowledgeVersion: string;
  /** Machine-facing rationale. §5: never rendered to a founder. */
  reasoning: string;
  claims: readonly NovaClaim[];
  /** MANDATORY. Present on every envelope, empty only when nothing was left open. */
  unresolved: readonly NovaUnresolved[];
}

/** One retrieved chunk, as the reasoner sees it. No service or database types. */
export interface NovaEvidenceInput {
  chunkId: string;
  body: string;
  sourceAuthority: SourceAuthority;
  sectionReference: string | null;
  regulatoryDomain: string | null;
  /** Retrieval rank. Determines claim order, so the output stays reproducible. */
  rank: number;
}

export interface NovaReasonerInput {
  question: string;
  knowledgeVersion: string;
  evidence: readonly NovaEvidenceInput[];
}

export class EnvelopeIntegrityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'EnvelopeIntegrityError';
  }
}

const VALID_STATUSES: readonly NovaStatus[] = [
  'OK',
  'NO_AUTHORITATIVE_INFORMATION_FOUND',
  'NEEDS_CLARIFICATION',
  'ERROR',
];

/**
 * Field names an agent may never emit (A4, ADR-0015). Checked in both casings
 * because the envelope is camelCase in TypeScript and snake_case in the
 * specification, and a violation could arrive in either shape.
 */
const FORBIDDEN_TRUST_FIELDS: readonly string[] = [
  'trustLevel',
  'trustScore',
  'evidenceStrength',
  'reasoningConfidence',
  'coverageConfidence',
  'trust_level',
  'trust_score',
  'evidence_strength',
  'reasoning_confidence',
  'coverage_confidence',
];

function assertNoTrustSelfAssessment(subject: object, where: string): void {
  for (const field of FORBIDDEN_TRUST_FIELDS) {
    if (Object.hasOwn(subject, field)) {
      throw new EnvelopeIntegrityError(
        `A4 / ADR-0015: ${where} carries "${field}". Trust dimensions are derived by the Trust ` +
          'Layer — a component that both produces and validates a claim provides no assurance.',
      );
    }
  }
}

/**
 * Reject a malformed envelope before the Trust Layer or a founder ever sees it.
 *
 * Fails closed, deliberately mirroring `assertRetrievalResultValid`. Trust
 * validation fails closed throughout the platform: unvalidated guidance is worse
 * than none. This is the opposite of audit logging, which fails open (ADR-0012).
 */
export function assertEnvelopeValid(envelope: NovaEnvelope): void {
  if (!VALID_STATUSES.includes(envelope.status)) {
    throw new EnvelopeIntegrityError(`ADR-0017 §5: unknown status "${envelope.status}".`);
  }
  if (envelope.agent !== NOVA_AGENT) {
    throw new EnvelopeIntegrityError(`ADR-0017 §5: envelope agent must be "${NOVA_AGENT}".`);
  }
  if (!Array.isArray(envelope.claims) || !Array.isArray(envelope.unresolved)) {
    throw new EnvelopeIntegrityError(
      'ADR-0017 §5: claims and unresolved must both be arrays. `unresolved` is mandatory.',
    );
  }

  for (const [field, value] of [
    ['agentVersion', envelope.agentVersion],
    ['promptVersion', envelope.promptVersion],
    ['modelVersion', envelope.modelVersion],
    ['knowledgeVersion', envelope.knowledgeVersion],
  ] as const) {
    if (!value) {
      throw new EnvelopeIntegrityError(
        `ADR-0017 §5 / document 15: "${field}" is mandatory — a run without it cannot be replayed.`,
      );
    }
  }

  assertNoTrustSelfAssessment(envelope, 'the envelope');

  // ── Status semantics (contract §7, AI-14 §8) ─────────────────────────────
  if (envelope.status === 'OK' && envelope.claims.length === 0) {
    throw new EnvelopeIntegrityError(
      'ADR-0017 §7: OK with no claims is not a success. A refusal must say so in its status.',
    );
  }

  const isRefusal =
    envelope.status === 'NO_AUTHORITATIVE_INFORMATION_FOUND' ||
    envelope.status === 'NEEDS_CLARIFICATION';

  if (isRefusal) {
    if (envelope.claims.length > 0) {
      throw new EnvelopeIntegrityError(
        `ADR-0017 §7: status ${envelope.status} cannot carry claims.`,
      );
    }
    if (envelope.unresolved.length === 0) {
      throw new EnvelopeIntegrityError(
        `AI-14 §8: status ${envelope.status} must name what could not be determined. ` +
          'A silent refusal tells the founder nothing and records no coverage gap.',
      );
    }
  }

  if (envelope.status === 'ERROR' && envelope.claims.length > 0) {
    throw new EnvelopeIntegrityError('ADR-0017 §7: an ERROR envelope cannot carry claims.');
  }

  // ── Claims ───────────────────────────────────────────────────────────────
  const seen = new Set<string>();

  for (const claim of envelope.claims) {
    if (!claim.claimId) {
      throw new EnvelopeIntegrityError(
        'ADR-0017 §6: every claim needs a stable claim_id, or a retry duplicates rather than converges.',
      );
    }
    if (seen.has(claim.claimId)) {
      throw new EnvelopeIntegrityError(`ADR-0017 §6: duplicate claim_id "${claim.claimId}".`);
    }
    seen.add(claim.claimId);

    assertNoTrustSelfAssessment(claim, `claim ${claim.claimId}`);

    if (!claim.content?.statement) {
      throw new EnvelopeIntegrityError(`Claim ${claim.claimId} has no statement.`);
    }
    if (!Number.isInteger(claim.reasoningHops) || claim.reasoningHops < 1) {
      throw new EnvelopeIntegrityError(
        `ADR-0017 §5.2: claim ${claim.claimId} must report at least one reasoning hop.`,
      );
    }
    if (!Array.isArray(claim.evidence) || claim.evidence.length === 0) {
      throw new EnvelopeIntegrityError(
        `ADR-0017 §5.1: claim ${claim.claimId} cites nothing. An unevidenced claim is fabrication.`,
      );
    }

    for (const ref of claim.evidence) {
      if (!ref.chunkId) {
        throw new EnvelopeIntegrityError(
          `A12: evidence on claim ${claim.claimId} has no chunk_id — it cannot be bound to a retrieval run.`,
        );
      }
      if (!ref.quote) {
        throw new EnvelopeIntegrityError(
          `ADR-0017 §5.1: evidence on claim ${claim.claimId} cites chunk ${ref.chunkId} without ` +
            'quoting supporting text. That claim is unverifiable and would be quarantined.',
        );
      }
    }
  }
}
