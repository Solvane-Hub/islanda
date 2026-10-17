import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { ArrowRight, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  getActiveCountries,
  getBusinessObject,
  listBusinesses,
  resolveCurrentBusiness,
} from '@/services/business';
import { hasPublishedKnowledge } from '@/services/nova/retrieval';
import { toNovaBusinessFacts } from '@/services/nova/business-awareness';
import type { BusinessPassport } from '@/services/passport';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { BUSINESS_STAGE_LABELS, type BusinessStage } from '@/lib/validation/intake';
import { buttonVariants } from '@/components/ui/button';
import { WorkspaceSurface, SurfaceLabel } from '@/components/ui/workspace-surface';
import { BusinessCommandCenter } from '../_components/business-command-center';

export const metadata: Metadata = { title: 'Your business in Islanda' };

/**
 * The first-value moment.
 *
 * Straight after onboarding the founder should see Islanda understood what
 * they brought in — not an empty dashboard. Build mode reflects the concept
 * back; Manage mode shows the command centre. Both then offer a clear path into
 * Nova, which is the only "next" that genuinely works today — the rest are named
 * honestly as coming, never as ready.
 */
export default async function WelcomePage() {
  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);

  if (!current) redirect('/businesses/new');

  const [object, countries, novaAvailable] = await Promise.all([
    getBusinessObject(db, current.id),
    getActiveCountries(db),
    hasPublishedKnowledge(db, current.country_code),
  ]);

  if (!object) redirect('/dashboard');

  const { business, profile } = object;
  const isManage = business.business_mode === 'manage';
  const countryName =
    countries.find((c) => c.code === business.country_code)?.name ?? business.country_code;
  const stageLabel = profile?.business_stage
    ? (BUSINESS_STAGE_LABELS[profile.business_stage as BusinessStage] ?? profile.business_stage)
    : null;

  // Same resolved-value shape as the dashboard's Command Centre (P7 Milestone
  // 5) — `business`/`profile` are already in hand via `getBusinessObject`, so
  // this is a pure derivation, not a second query.
  const passportFacts = toNovaBusinessFacts(business, profile);
  const commandCenterIdentity: BusinessPassport['identity'] = {
    legalName: passportFacts.legalName,
    tradingName: passportFacts.tradingName,
    businessType: passportFacts.businessType,
    industry: passportFacts.industry,
    countryCode: business.country_code,
    jurisdictionName: countryName,
    stage: passportFacts.stage,
    operatingStatus: passportFacts.operatingStatus,
  };
  const commandCenterDefinition: BusinessPassport['definition'] = {
    activities: passportFacts.activities,
    productsServices: passportFacts.productsServices,
    targetCustomers: passportFacts.targetCustomers,
    location: passportFacts.location,
    employeeCount: passportFacts.employeeCount,
    founderGoals: passportFacts.founderGoals,
  };

  // Built from the availability register's wording: what works now, then what
  // does not yet. No surface is listed here that the register does not name.
  const nextAreas: { label: string; available: boolean; note: string }[] = [
    {
      label: 'Describe your business',
      available: true,
      note: 'Five short questions. Your answers are saved as you go.',
    },
    {
      label: 'Ask a question',
      available: novaAvailable,
      note: novaAvailable
        ? 'Nova quotes the official documents Islanda holds for your country.'
        : 'Islanda does not hold official documents for this country yet.',
    },
    {
      label: 'Business requirements',
      available: false,
      note: 'Which registrations and licences may apply. We are working on this.',
    },
    {
      label: 'Funding',
      available: false,
      note: 'Programmes that may suit your business. We are working on this.',
    },
  ];

  return (
    <div className="workspace-env flex flex-col gap-6">
      <header className="flex flex-col gap-2 px-1 pt-2">
        <p className="text-2xs text-champagne font-medium tracking-[0.16em] uppercase">
          {isManage ? 'Business imported' : 'Business started'}
        </p>
        <h1 className="text-on-ink text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
          {isManage ? 'Your business is in Islanda.' : 'Your business is set up.'}
        </h1>
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Here is what you have told Islanda so far. You can change any of it at any time.
        </p>
      </header>

      {isManage ? (
        <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-7 p-6 sm:p-8">
          <SurfaceLabel>What you told Islanda</SurfaceLabel>
          <BusinessCommandCenter
            identity={commandCenterIdentity}
            definition={commandCenterDefinition}
            identifiers={object.identifiers}
          />
        </WorkspaceSurface>
      ) : (
        <WorkspaceSurface as="section" tone="shell" className="flex flex-col gap-7 p-6 sm:p-8">
          <div className="grid gap-7 sm:grid-cols-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                Your business
              </span>
              <span className="text-on-ink text-base font-medium">{business.name}</span>
              <span className="text-on-ink-muted text-sm">
                {countryName}
                {business.industry ? ` · ${business.industry}` : ''}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                Your stage
              </span>
              <span className="text-on-ink text-base font-medium">
                {stageLabel ?? 'Early days'}
              </span>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                Country
              </span>
              <span className="text-on-ink text-base font-medium">{countryName}</span>
            </div>
          </div>

          {profile?.description ? (
            <div className="flex flex-col gap-2 border-t border-white/8 pt-6">
              <span className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                What you&apos;re building
              </span>
              <p className="text-on-ink max-w-2xl text-lg leading-relaxed text-pretty italic">
                “{profile.description}”
              </p>
            </div>
          ) : null}
        </WorkspaceSurface>
      )}

      {/* What we can work on next — honest about what is available now. */}
      <section aria-labelledby="next-heading" className="flex flex-col gap-3">
        <SurfaceLabel id="next-heading" className="px-1">
          What you can do next
        </SurfaceLabel>
        <div className="grid gap-3 sm:grid-cols-2">
          {nextAreas.map((area) => (
            <div
              key={area.label}
              className="border-border-control bg-surface flex items-start justify-between gap-4 rounded-xl border p-4"
            >
              <div className="flex min-w-0 flex-col gap-1">
                <span className="text-on-ink text-sm font-medium">{area.label}</span>
                <span className="text-on-ink-muted text-xs text-pretty">{area.note}</span>
              </div>
              {area.available ? (
                <span className="text-bahama-turquoise text-2xs font-medium tracking-[0.1em] uppercase">
                  Available
                </span>
              ) : (
                <span className="text-on-glass-subtle text-2xs font-medium tracking-[0.1em] uppercase">
                  Soon
                </span>
              )}
            </div>
          ))}
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-3 px-1">
        <Link href="/intake" className={buttonVariants()}>
          Answer five questions
          <ArrowRight aria-hidden="true" strokeWidth={1.75} />
        </Link>
        {novaAvailable ? (
          <Link href="/assistant" className={buttonVariants({ variant: 'secondary' })}>
            <Sparkles aria-hidden="true" strokeWidth={1.75} />
            Ask a question
          </Link>
        ) : null}
        <Link
          href="/dashboard"
          className="text-on-ink-muted hover:text-on-ink inline-flex min-h-11 items-center gap-1.5 text-sm"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
