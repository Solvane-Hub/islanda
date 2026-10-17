import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveCountries } from '@/services/business';
import { Alert } from '@/components/ui/alert';
import { BuildBusinessForm } from '../../../_components/build-business-form';

export const metadata: Metadata = { title: 'Start from an idea' };

/**
 * Build my business — the "start from an idea" door from /businesses/new.
 *
 * This route was linked from the chooser but missing from the repository: the
 * root `.gitignore` rule `build/` also matched this directory, so the page was
 * never committed and the link led nowhere. The rule is now anchored to the
 * repository root (`/build/`). The form and its server action
 * (`buildBusinessAction` → `/welcome`) already existed; this page only mounts
 * them, mirroring the Manage route beside it.
 */
export default async function BuildBusinessPage() {
  const db = await createClient();
  const countries = await getActiveCountries(db);

  return (
    <div className="flex flex-col gap-7">
      <Link
        href="/businesses/new"
        className="text-on-ink-muted hover:text-on-ink inline-flex min-h-11 w-fit items-center gap-1.5 text-sm"
      >
        <ArrowLeft aria-hidden="true" className="size-4" strokeWidth={1.75} />
        Back
      </Link>

      <div className="flex flex-col gap-2">
        <p className="text-champagne text-2xs font-medium tracking-[0.16em] uppercase">
          Start from an idea
        </p>
        <h1 className="text-on-ink text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
          Tell us about your business idea
        </h1>
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Describe your idea and a few basics. A working name is fine, and you can change anything
          later. Nothing here is sent to any government office.
        </p>
      </div>

      {countries.length === 0 ? (
        <Alert tone="info" title="No countries are available yet">
          A business needs a country, and none has been switched on yet. Please contact the Islanda
          team.
        </Alert>
      ) : (
        <BuildBusinessForm countries={countries.map((c) => ({ code: c.code, name: c.name }))} />
      )}
    </div>
  );
}
