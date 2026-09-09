import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getActiveCountries, listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getIntakeProfile } from '@/services/intake';
import { getJurisdictionCapability } from '@/services/knowledge/capability';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { cn } from '@/lib/utils/cn';
import { PageHeader } from '@/components/ui/page-header';
import { RoadmapSurface, type Prerequisite } from '@/components/ui/roadmap-surface';
import { NovaConsole } from './_components/nova-console';

export const metadata: Metadata = { title: 'Nova' };

/**
 * Nova.
 *
 * The composer is offered only when a Knowledge Pack is actually published for
 * this business's jurisdiction. That gate is not decoration:
 *
 *   • Inviting a founder to type a regulatory question we already know cannot be
 *     answered is the "implied capability" failure AI-14 §6 exists to prevent.
 *   • With no published pack, retrieval returns `no_published_knowledge` and no
 *     legal text can reach the screen — which is also how the G11 commercial
 *     reuse gate is honoured structurally rather than by convention.
 *
 * When no pack exists the founder sees the roadmap surface, whose prerequisite
 * states are REAL: `met` is computed from the database, not asserted.
 */
export default async function AssistantPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  // A contextual "Ask Nova" elsewhere in the product may prefill a question via
  // `?q=`. It fills the composer; it never auto-submits — the founder still
  // decides to ask, and the question is a plain regulatory one Nova can answer.
  const { q } = await searchParams;
  const initialQuestion =
    typeof q === 'string' && q.trim().length > 0 ? q.slice(0, 500) : undefined;

  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  const [intake, capability, countries] = await Promise.all([
    current ? getIntakeProfile(db, current.id) : Promise.resolve(null),
    getJurisdictionCapability(db, current?.country_code),
    getActiveCountries(db),
  ]);

  const intakeComplete = Boolean(intake?.completed_at);
  const knowledgePublished = capability.knowledgePublished;
  // Nova is per-business, so a business must be selected — but a MISSING published
  // pack is NOT a reason to hide Nova. The console always renders for a business;
  // the absence of jurisdictional evidence is a Nova state (NO_EVIDENCE), not a
  // different page. Only "no business at all" is a genuine upstream prerequisite.
  const ready = Boolean(current);

  /**
   * What Foundry holds for this jurisdiction, in one line.
   *
   * ⚠ Every part of this comes from the database — the country name from
   *   `countries`, the pack version from the published pack, the synthetic flag
   *   from the jurisdiction's ISO range. Nothing is asserted, and where a pack
   *   is synthetic the line says so, because a founder reading "published
   *   sources available" about invented law is the one impression this whole
   *   labelling apparatus exists to prevent.
   *
   * `null` when there is nothing true to say. The landing renders no panel
   * rather than a placeholder.
   */
  const countryName = current
    ? (countries.find((c) => c.code === current.country_code)?.name ?? current.country_code)
    : null;

  /**
   * A subtle acknowledgement that Nova is working with the business the founder
   * brought in (§10/§11). Shown only when there is genuinely enough context to
   * say so — otherwise null, so Nova never claims to know a business it doesn't.
   * Makes no legal claim; it names the business and invites a question.
   */
  const hasBusinessContext = Boolean(
    current &&
    (current.industry || intake?.description || intake?.business_activities || intake?.location),
  );
  const businessContextLine =
    current && hasBusinessContext
      ? `I already have the basics of ${current.name}. Ask about the requirements that may affect it.`
      : null;

  const knowledgeLine =
    countryName && capability.knowledgePublished
      ? capability.syntheticCorpus
        ? `${countryName} · ${capability.knowledgeVersion} — a SYNTHETIC demonstration corpus. Not real law.`
        : `${countryName} · ${capability.knowledgeVersion} published. Nova quotes only from these sources.`
      : countryName
        ? `${countryName} — no published Knowledge Pack yet. Nova answers only from published, cited sources, so it has nothing to quote here.`
        : null;

  return (
    /*
      Nova is the one surface that uses the whole shell width.

      Every other page is a document and is capped at a reading measure. This
      one is a workspace: the answer and its evidence sit side by side, and
      capping it at `max-w-4xl` squeezed the context rail until the source
      titles wrapped after two words. The console re-imposes a reading measure
      on the parts that are prose — the composer, the landing, the record of
      work — so nothing here stretches a paragraph across 72rem.
    */
    <div
      className={cn(
        'workspace-env flex flex-col gap-8 pt-3 sm:pt-6',
        ready && current ? null : 'max-w-4xl',
      )}
    >
      {!ready ? <PageHeader eyebrow="In development" title="Nova" /> : null}

      {ready && current ? (
        <NovaConsole
          businessName={current.name}
          knowledgeLine={knowledgeLine}
          businessContextLine={businessContextLine}
          knowledgePublished={knowledgePublished}
          {...(initialQuestion ? { initialQuestion } : {})}
        />
      ) : (
        <RoadmapSurface
          purpose="Questions about your business answered from the same cited evidence as the rest of the workspace — never from a model’s memory."
          prerequisites={prerequisitesFor({ knowledgePublished, intakeComplete })}
          today={
            intakeComplete
              ? {
                  text: 'Your intake is complete, so FoundryAI already holds the profile this surface is built on. The remaining work is ours.',
                  href: '/dashboard',
                  label: 'Back to your workspace',
                }
              : {
                  text: 'Completing your intake is the part of this that depends on you. The rest is ours to build.',
                  href: '/intake',
                  label: 'Continue intake',
                }
          }
        />
      )}
    </div>
  );
}

/**
 * Prerequisites, computed rather than asserted.
 *
 * The reasoning layer is `met` because it exists and is tested — the extractive
 * reasoner, its envelope gate and its citation grounding all ship. Saying
 * otherwise would understate the system as badly as overstating it.
 */
function prerequisitesFor({
  knowledgePublished,
  intakeComplete,
}: {
  knowledgePublished: boolean;
  intakeComplete: boolean;
}): Prerequisite[] {
  return [
    {
      label: 'A published Knowledge Pack',
      detail:
        'Validated regulatory sources for your jurisdiction, each one citable. The sources are identified and verified; publication is pending a legal review of reuse terms.',
      met: knowledgePublished,
    },
    {
      label: 'The reasoning layer',
      detail:
        'The component that turns retrieved sources into a cited answer, and refuses when the sources do not support one.',
      met: true,
    },
    {
      label: 'Your business profile',
      detail:
        'Nova scopes every search to your jurisdiction and industry, which it reads from your intake.',
      met: intakeComplete,
    },
  ];
}
