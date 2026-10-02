import type { Metadata } from 'next';
import Link from 'next/link';
import { cookies } from 'next/headers';
import { ArrowLeft, FlaskConical, ShieldCheck } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { listBusinesses, resolveCurrentBusiness } from '@/services/business';
import { getJurisdictionCapability } from '@/services/knowledge/capability';
import { CURRENT_BUSINESS_COOKIE } from '@/lib/business-cookie';
import { NOVA_ABOUT, NOVA_DISCLAIMER, SYNTHETIC_CORPUS_EXPLANATION } from '@/lib/nova/about';
import { NOVA_UPDATES } from '@/lib/nova/updates';
import { NovaMark } from '@/components/ui/nova-mark';
import { SurfaceLabel, WorkspaceSurface } from '@/components/ui/workspace-surface';

export const metadata: Metadata = { title: 'How Nova works' };

/**
 * How Nova works.
 *
 * ## Why this is a route rather than a tooltip
 *
 * This is part of the trust architecture, not a legal footnote. A founder
 * deciding whether to act on a regulatory answer needs to know what was
 * searched, what was not, what the system refuses to do, and what happens when
 * coverage is incomplete — and that does not fit in small grey text under a
 * button.
 *
 * ⚠ The synthetic-corpus explanation appears only when one is actually in use
 *   for this founder's jurisdiction. A definition of something the reader is
 *   not looking at is noise, and its absence for a real pack is meaningful.
 */
export default async function AboutNovaPage() {
  const db = await createClient();
  const [businesses, store] = await Promise.all([listBusinesses(db), cookies()]);
  const current = resolveCurrentBusiness(businesses, store.get(CURRENT_BUSINESS_COOKIE)?.value);
  const capability = await getJurisdictionCapability(db, current?.country_code);

  const showSynthetic = capability.knowledgePublished && capability.syntheticCorpus;

  return (
    <div className="workspace-env flex max-w-3xl flex-col gap-8 pt-3 sm:pt-6">
      <header className="flex flex-col gap-5 px-1">
        <Link
          href="/assistant"
          className="text-on-ink-muted hover:text-on-ink inline-flex w-fit items-center gap-2 rounded-sm text-xs transition-colors duration-150"
        >
          <ArrowLeft aria-hidden="true" className="size-3.5" strokeWidth={2} />
          Back to Nova
        </Link>

        <div className="flex items-start gap-5">
          <NovaMark state="ready" size={64} className="mt-1 shrink-0" />
          <div className="min-w-0">
            <SurfaceLabel as="p">Nova</SurfaceLabel>
            <h1 className="text-on-ink mt-3 text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
              How Nova works
            </h1>
            <p className="text-on-ink-muted mt-3 max-w-xl text-sm text-pretty">
              What Nova searches, what it will not do, and what happens when the published sources
              do not support an answer.
            </p>
          </div>
        </div>
      </header>

      <WorkspaceSurface as="section" aria-labelledby="nova-about-heading" className="min-w-0">
        <h2 id="nova-about-heading" className="sr-only">
          How Nova works
        </h2>

        <dl className="divide-y divide-white/8">
          {NOVA_ABOUT.map((section) => (
            <div key={section.id} className="px-5 py-5 sm:px-8 sm:py-6">
              <dt className="text-on-ink text-sm font-medium text-pretty">{section.title}</dt>
              <dd className="text-on-ink-muted mt-2 text-sm text-pretty">{section.body}</dd>
            </div>
          ))}
        </dl>
      </WorkspaceSurface>

      {showSynthetic ? (
        <WorkspaceSurface
          as="section"
          tone="inset"
          aria-labelledby="nova-synthetic-explained"
          className="border-champagne/40 flex flex-col gap-2 border p-5 sm:p-6"
        >
          <div className="flex items-center gap-2.5">
            <FlaskConical aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
            <SurfaceLabel as="h2" id="nova-synthetic-explained">
              What &ldquo;synthetic demonstration corpus&rdquo; means
            </SurfaceLabel>
          </div>
          <p className="text-on-ink-muted text-sm text-pretty">{SYNTHETIC_CORPUS_EXPLANATION}</p>
          <p className="text-on-glass-subtle text-xs">
            Currently in use for your jurisdiction: {capability.knowledgeVersion}.
          </p>
        </WorkspaceSurface>
      ) : null}

      <WorkspaceSurface
        as="section"
        tone="deep"
        aria-labelledby="nova-disclaimer-heading"
        className="flex flex-col gap-3 p-5 sm:p-6"
      >
        <div className="flex items-center gap-2.5">
          <ShieldCheck aria-hidden="true" className="text-champagne size-3.5" strokeWidth={2} />
          <SurfaceLabel as="h2" id="nova-disclaimer-heading">
            What Nova is not
          </SurfaceLabel>
        </div>
        <p className="text-on-ink-muted text-sm text-pretty">{NOVA_DISCLAIMER}</p>
      </WorkspaceSurface>

      <section aria-labelledby="nova-history-heading" className="flex flex-col gap-3">
        <SurfaceLabel as="h2" id="nova-history-heading" className="px-1">
          What&rsquo;s changed
        </SurfaceLabel>

        <WorkspaceSurface tone="inset" className="divide-y divide-white/8">
          {NOVA_UPDATES.map((update) => (
            <article key={update.period} className="flex flex-col gap-3 p-5 sm:p-6">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h3 className="text-on-ink text-sm font-medium text-pretty">{update.headline}</h3>
                <span className="text-on-glass-subtle text-2xs shrink-0">{update.period}</span>
              </div>

              <p className="text-on-ink-muted text-sm text-pretty">{update.what}</p>

              <div>
                <SurfaceLabel as="p" className="text-on-glass-subtle">
                  Why this matters
                </SurfaceLabel>
                <p className="text-on-ink-muted mt-1.5 text-sm text-pretty">{update.why}</p>
              </div>

              <div>
                <SurfaceLabel as="p" className="text-on-glass-subtle">
                  What we&rsquo;re working on
                </SurfaceLabel>
                <ul className="text-on-ink-muted mt-1.5 flex flex-col gap-1 text-sm">
                  {update.next.map((item) => (
                    <li key={item} className="flex gap-2 text-pretty">
                      <span aria-hidden="true" className="text-champagne shrink-0">
                        ·
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </article>
          ))}
        </WorkspaceSurface>
      </section>
    </div>
  );
}
