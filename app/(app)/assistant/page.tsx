import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { getActiveCountries, listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getIntakeProfile } from '@/services/intake';
import { getJurisdictionCapability, listPublishedSources } from '@/services/knowledge/capability';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { cn } from '@/lib/utils/cn';
import { PageHeader } from '@/components/ui/page-header';
import { RoadmapSurface, type Prerequisite } from '@/components/ui/roadmap-surface';
import { NovaConsole } from './_components/nova-console';

export const metadata: Metadata = { title: 'Get help' };

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

  const [intake, capability, countries, sources] = await Promise.all([
    current ? getIntakeProfile(db, current.id) : Promise.resolve(null),
    getJurisdictionCapability(db, current?.country_code),
    getActiveCountries(db),
    // What Nova can search, shown by title so a founder can see the edge of
    // its coverage before asking — read from the published pack, never listed
    // by hand.
    listPublishedSources(db, current?.country_code),
  ]);

  const intakeComplete = Boolean(intake?.completed_at);
  const knowledgePublished = capability.knowledgePublished;
  // Nova is per-business, so a business must be selected — but a MISSING published
  // pack is NOT a reason to hide Nova. The console always renders for a business;
  // the absence of jurisdictional evidence is a Nova state (NO_EVIDENCE), not a
  // different page. Only "no business at all" is a genuine upstream prerequisite.
  const ready = Boolean(current);

  /**
   * What Islanda holds for this jurisdiction, in one line.
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
      ? `Nova uses what you have told Islanda about ${current.name}, such as its country and industry, to focus its search.`
      : null;

  const knowledgeLine =
    countryName && capability.knowledgePublished
      ? capability.syntheticCorpus
        ? `${countryName}: a SYNTHETIC demonstration set of documents (${capability.knowledgeVersion}). Not real law.`
        : `${countryName}: Nova quotes only from these official documents (${capability.knowledgeVersion}).`
      : countryName
        ? `${countryName}: Islanda doesn't hold any official documents for this country yet, so Nova has nothing to quote here.`
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
      {!ready ? <PageHeader eyebrow="Nova" title="Get help with your business" /> : null}

      {ready && current ? (
        <NovaConsole
          businessName={current.name}
          knowledgeLine={knowledgeLine}
          businessContextLine={businessContextLine}
          knowledgePublished={knowledgePublished}
          sources={sources}
          {...(initialQuestion ? { initialQuestion } : {})}
        />
      ) : (
        <RoadmapSurface
          purpose="Ask questions about your business and get answers quoted from official documents, with a link to each source. Create your business first so Nova knows which country's documents to search."
          prerequisites={prerequisitesFor({ knowledgePublished, intakeComplete })}
          today={
            intakeComplete
              ? {
                  text: 'Your business details are complete. Create or choose a business to start asking questions.',
                  href: '/dashboard',
                  label: 'Go to Home',
                }
              : {
                  text: 'Start by creating your business and answering a few questions about it.',
                  href: '/dashboard',
                  label: 'Go to Home',
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
      label: 'Official documents for your country',
      detail:
        'Checked official documents Islanda can quote. They are identified; publishing them is waiting on a legal review of how they may be reused.',
      met: knowledgePublished,
    },
    {
      label: 'Nova',
      detail:
        'Built: it quotes the documents it finds, and says so when they do not answer the question.',
      met: true,
    },
    {
      label: 'Your business details',
      detail: 'Nova searches the documents for your country, which it reads from your business.',
      met: intakeComplete,
    },
  ];
}
