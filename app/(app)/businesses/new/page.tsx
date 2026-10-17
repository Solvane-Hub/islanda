import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowRight, Building2, Sparkles } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveCountries } from '@/services/business';
import { Alert } from '@/components/ui/alert';

export const metadata: Metadata = { title: 'Add your business' };

/**
 * The two front doors. Both create the same Business Object — this screen only
 * asks which experience fits where the founder is today.
 *
 * Build starts from an idea; Manage brings an existing company in. The choice is
 * a real fork in tone (constructing vs importing), not two data models.
 */
const PATHS = [
  {
    href: '/businesses/new/build',
    icon: Sparkles,
    eyebrow: 'Start from an idea',
    title: 'Build my business',
    body: 'You have an idea or are just getting started. Give it a name, say where it will operate, and answer a few questions to describe it.',
  },
  {
    href: '/businesses/new/manage',
    icon: Building2,
    eyebrow: 'You already operate',
    title: 'Manage my business',
    body: 'You already own or run a business. Add its details, such as its legal name and registration numbers, so its information is kept in one place.',
  },
] as const;

export default async function NewBusinessPage() {
  const db = await createClient();
  const countries = await getActiveCountries(db);

  if (countries.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Add your business</h1>
        <Alert tone="info" title="No countries are available yet">
          A business needs a country, and none has been switched on yet. Please contact the Islanda
          team.
        </Alert>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2">
        <p className="text-champagne text-2xs font-medium tracking-[0.16em] uppercase">
          New business
        </p>
        <h1 className="text-on-ink text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
          Add your business
        </h1>
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Choose the option that fits you today. You can change any detail later.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {PATHS.map((path) => (
          <Link
            key={path.href}
            href={path.href}
            className="group border-border-control bg-surface hover:border-bahama-turquoise/60 focus-visible:ring-bahama-turquoise/40 relative flex flex-col gap-4 rounded-2xl border p-6 transition-colors duration-150 hover:bg-white/[0.06] focus-visible:ring-[3px] focus-visible:outline-none sm:p-7"
          >
            <span className="bg-bahama-turquoise/12 text-bahama-turquoise flex size-10 items-center justify-center rounded-xl">
              <path.icon aria-hidden="true" className="size-5" strokeWidth={1.75} />
            </span>
            <div className="flex flex-col gap-1.5">
              <span className="text-2xs text-on-glass-subtle font-medium tracking-[0.14em] uppercase">
                {path.eyebrow}
              </span>
              <span className="text-on-ink text-lg font-semibold tracking-[-0.01em]">
                {path.title}
              </span>
              <p className="text-on-ink-muted text-sm text-pretty">{path.body}</p>
            </div>
            <span className="text-bahama-turquoise mt-auto inline-flex items-center gap-1.5 text-sm font-medium">
              Continue
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-150 group-hover:translate-x-0.5"
                strokeWidth={1.75}
              />
            </span>
          </Link>
        ))}
      </div>

      <p className="text-on-ink-subtle text-xs">
        Nothing here is sent to any government office. Your business information stays private to
        your account.
      </p>
    </div>
  );
}
