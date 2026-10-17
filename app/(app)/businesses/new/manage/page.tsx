import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { getActiveCountries } from '@/services/business';
import { Alert } from '@/components/ui/alert';
import { ManageBusinessForm } from '../../../_components/manage-business-form';

export const metadata: Metadata = { title: 'Manage my business' };

export default async function ManageBusinessPage() {
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
          Manage my business
        </p>
        <h1 className="text-on-ink text-2xl font-semibold tracking-[-0.02em] text-balance sm:text-3xl">
          Add your existing business
        </h1>
        <p className="text-on-ink-muted max-w-prose text-sm text-pretty">
          Share as much or as little as you have. Only the legal name and country are needed.
          Islanda marks everything as provided by you, and does not treat it as checked.
        </p>
      </div>

      {countries.length === 0 ? (
        <Alert tone="info" title="No countries are available yet">
          A business needs a country, and none has been switched on yet. Please contact the Islanda
          team.
        </Alert>
      ) : (
        <ManageBusinessForm countries={countries.map((c) => ({ code: c.code, name: c.name }))} />
      )}
    </div>
  );
}
