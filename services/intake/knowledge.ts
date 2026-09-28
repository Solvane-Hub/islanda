import type { BusinessProfile } from '@/types/business';
import {
  INTAKE_STEPS,
  TOTAL_INTAKE_STEPS,
  knowledgeRecordSchema,
  type KnowledgeProvenance,
} from '@/lib/validation/intake';

/**
 * What Islanda knows about a business, and how much of it.
 *
 * Intake is five pieces of business knowledge, not five pages a founder has to
 * visit. That distinction is the whole point of this module.
 *
 * Progress used to be read off `last_completed_step` — a cursor recording how
 * far through the guided flow the founder had walked. That is a measure of
 * PAGE VISITATION, and it is the wrong measure the moment anything other than
 * the five screens can supply an answer. Nova will hold a conversation and
 * establish the description, the jurisdiction, the stage and the team size; if
 * completeness were still read off the cursor, the founder would be told they
 * had answered 0 of 5 questions they had just spent ten minutes answering.
 *
 * So completeness is read from the VALUES. A slot is known when the profile
 * actually holds the fact, whoever put it there. Nothing about that is
 * speculative — it is true today, with the five screens as the only writer,
 * and it stays true when there is a second one.
 *
 * ── The Nova extension point ────────────────────────────────────────────────
 *
 * The typed columns on `business_profiles` are the single source of truth for
 * the VALUES, and they stay that way. Nova does not get its own table and does
 * not get its own copy: it will call the Intake Application Service, which
 * performs the write, exactly as the five screens do (agents never write to
 * the database — CLAUDE.md, ADR-0016/0017).
 *
 * `responses.knowledge` carries PROVENANCE — who established a fact, how
 * confident an extraction was, and whether the founder has confirmed it.
 * `business_profiles.responses` (jsonb, `not null default '{}'`) already exists
 * and is currently unused by any code path. It is the intended home:
 *
 *   {
 *     "knowledge": {
 *       "business": { "source": "nova", "confidence": "low",
 *                     "run_id": "…", "confirmed_at": null },
 *       "team":     { "source": "founder", "confirmed_at": "2026-08-09T…" }
 *     }
 *   }
 *
 * Provenance only — never a second copy of the value. `readKnowledge` reads it
 * defensively and emits `needs_confirmation` for an unconfirmed Nova proposal.
 * No migration, no new table, and no change to the meaning of the typed
 * columns are required.
 */

/** One piece of business knowledge. Ids are the `INTAKE_STEPS` slugs — one vocabulary. */
export type IntakeSlotId = (typeof INTAKE_STEPS)[number]['slug'];

/**
 * A Nova proposal remains `needs_confirmation` until the founder confirms or
 * replaces it. Consumers must not reduce this to a boolean: `declined` is an
 * established answer without an amount, while `unknown` has no answer at all.
 */
export type KnowledgeState = 'known' | 'declined' | 'needs_confirmation' | 'unknown';

/** Who established the fact. */
export type KnowledgeSource = 'founder' | 'nova';

export interface IntakeSlot {
  id: IntakeSlotId;
  /** The intake screen that collects it. */
  step: number;
  title: string;
}

export interface SlotKnowledge {
  slot: IntakeSlot;
  state: KnowledgeState;
  /** `null` when the slot is unknown. */
  source: KnowledgeSource | null;
}

export const INTAKE_SLOTS: readonly IntakeSlot[] = INTAKE_STEPS.map((s) => ({
  id: s.slug,
  step: s.step,
  title: s.title,
}));

/**
 * Anything recorded about the answers themselves, as opposed to the answers.
 *
 * Untrusted jsonb: a row written by an older build, a bad migration or a hand
 * edit must degrade to "nothing recorded" rather than throw inside a render.
 */
export function readKnowledgeRecord(profile: BusinessProfile | null) {
  const parsed = knowledgeRecordSchema.safeParse(profile?.responses ?? {});
  return parsed.success ? (parsed.data.knowledge ?? {}) : {};
}

/** The founder was asked for a figure and said they do not know one yet. */
export function hasDeclinedFunding(profile: BusinessProfile | null): boolean {
  return readKnowledgeRecord(profile).funding?.declined === true;
}

function provenanceFor(profile: BusinessProfile, id: IntakeSlotId): KnowledgeProvenance | null {
  const record = readKnowledgeRecord(profile)[id];
  return record ?? null;
}

/**
 * Is the fact behind each slot actually held?
 *
 * Funding is the one slot with two ways to be answered. It is deliberately
 * optional — "a guess you're unsure of is worse than no answer" — so "I don't
 * know yet" is a real answer and is stored as one. It is NOT inferred from the
 * guided-flow cursor: that inference could not tell a founder who declined
 * from one who had simply walked past the screen, and it made completeness
 * depend on navigation, which is the thing ADR-0020 removed.
 */
function isKnown(profile: BusinessProfile, id: IntakeSlotId): boolean {
  switch (id) {
    case 'business':
      return hasText(profile.description);
    case 'stage':
      // Both halves of one question; either alone leaves the slot incomplete.
      return hasText(profile.business_stage) && hasText(profile.location);
    case 'team':
      return profile.employee_count !== null && profile.employee_count !== undefined;
    case 'funding':
      return (
        profile.funding_requirement_amount !== null &&
        profile.funding_requirement_amount !== undefined
      );
    case 'goals':
      return hasText(profile.founder_goals);
  }
}

function hasText(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

export function readKnowledge(profile: BusinessProfile | null): SlotKnowledge[] {
  return INTAKE_SLOTS.map((slot) => {
    if (!profile) return { slot, state: 'unknown' as const, source: null };

    const provenance = provenanceFor(profile, slot.id);
    const source = provenance?.source ?? 'founder';
    const hasValue = isKnown(profile, slot.id);
    const needsConfirmation =
      hasValue && provenance?.source === 'nova' && provenance.confirmed_at === null;

    // A declined funding figure resolves the slot without inventing an amount.
    // A real amount wins if old or manually-edited metadata is contradictory.
    const state: KnowledgeState = hasValue
      ? needsConfirmation
        ? 'needs_confirmation'
        : 'known'
      : slot.id === 'funding' && hasDeclinedFunding(profile)
        ? 'declined'
        : 'unknown';

    return {
      slot,
      state,
      source: state === 'unknown' ? null : source,
    };
  });
}

/** A resolved slot can progress intake. A Nova proposal still needs the founder. */
export function isKnowledgeEstablished(state: KnowledgeState): boolean {
  return state === 'known' || state === 'declined';
}

/**
 * How much of the business profile Islanda holds.
 *
 * `isComplete` means every slot is known — the condition for finishing intake.
 * It is deliberately NOT the same thing as `completed_at`, which records that
 * the founder pressed the button.
 */
export function knowledgeCompleteness(profile: BusinessProfile | null): {
  known: number;
  total: number;
  isComplete: boolean;
} {
  const known = readKnowledge(profile).filter((k) => isKnowledgeEstablished(k.state)).length;
  return { known, total: TOTAL_INTAKE_STEPS, isComplete: known >= TOTAL_INTAKE_STEPS };
}

/** Whether the screen for one step already has its answer stored. */
export function isSlotKnownForStep(profile: BusinessProfile | null, step: number): boolean {
  const state = readKnowledge(profile).find((k) => k.slot.step === step)?.state;
  return state !== undefined && isKnowledgeEstablished(state);
}
