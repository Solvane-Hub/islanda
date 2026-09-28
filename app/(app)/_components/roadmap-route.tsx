import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getIntakeProfile } from '@/services/intake';
import {
  businessProfileStatus,
  getJurisdictionCapability,
  knowledgePackStatus,
} from '@/services/knowledge/capability';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { PageHeader } from '@/components/ui/page-header';
import { RoadmapSurface } from '@/components/ui/roadmap-surface';

/**
 * A surface that is not built yet.
 *
 * ## Why this is one component and not four pages
 *
 * Compliance, Timeline, Funding and Documents were four near-identical files
 * differing only in a title and one sentence of purpose. Each one carried its
 * own copy of the prerequisite list, and each one asserted
 * `met: false` for the Knowledge Pack as a literal — so when a pack was
 * published, all four went on saying "no pack has been published yet".
 *
 * The duplication was the mechanism: nobody edits four files to change a status
 * they think is static. Now the status is computed once, and the pages describe
 * only what makes them different from each other.
 *
 * ⚠ Prerequisites being MET is not the capability being BUILT. This component
 *   never implies the surface exists; it reports honestly on what it is waiting
 *   for. A founder whose intake is complete and whose jurisdiction has a
 *   published pack still sees a roadmap here, because the roadmap is the truth.
 */
export async function RoadmapRoute({
  title,
  purpose,
}: {
  title: string;
  /** One sentence on what this surface will do. Never phrased as if it exists. */
  purpose: string;
}) {
  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  const [intake, capability] = await Promise.all([
    current ? getIntakeProfile(db, current.id) : Promise.resolve(null),
    getJurisdictionCapability(db, current?.country_code),
  ]);

  const intakeComplete = Boolean(intake?.completed_at);

  return (
    <div className="workspace-env flex max-w-4xl flex-col gap-8 pt-3 sm:pt-6">
      <PageHeader eyebrow="In development" title={title} />
      <RoadmapSurface
        purpose={purpose}
        prerequisites={[businessProfileStatus(intakeComplete), knowledgePackStatus(capability)]}
        today={
          intakeComplete
            ? {
                text: 'Your intake is complete, so Islanda already holds the profile this surface will be built on. Nothing further is needed from you here.',
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
    </div>
  );
}
