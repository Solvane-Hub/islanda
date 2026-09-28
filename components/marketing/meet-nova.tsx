import { NovaField } from '@/components/nova/nova-field';

/**
 * Section 05 — Meet Nova.
 *
 * Nova is Islanda's intelligent business assistant, not Islanda itself — the
 * distinction matters, so the copy always names Nova as something that works
 * *with* the business context Islanda holds, never as a synonym for the
 * product. Presented here as static introduction, not a live console: a
 * public visitor has no business context yet for Nova to reason over, so
 * running the real instrument here would either do nothing or imply a
 * capability (answering about a business it knows nothing about) the product
 * does not have.
 */
export function MeetNova() {
  return (
    <div className="flex flex-col items-center gap-10 text-center lg:flex-row lg:items-center lg:gap-16 lg:text-left">
      <div className="shrink-0">
        <NovaField state="idle" nodes={[]} className="opacity-80" />
      </div>

      <div className="max-w-xl">
        <p className="text-champagne-dim text-2xs mb-3 font-medium tracking-[0.14em] uppercase">
          Meet Nova
        </p>
        <p className="text-on-ink text-lg text-balance sm:text-xl">
          Nova is Islanda&apos;s intelligent business assistant — built to work with the business
          context Islanda holds, not to replace it.
        </p>
        <p className="text-on-ink-muted mt-4 text-base text-pretty">
          Once your business is in Islanda, Nova searches what it actually knows about your business
          and the sources that apply to it, and answers by quoting what it finds — never by
          guessing. It does not run your business for you, and it says plainly when it doesn&apos;t
          know something rather than filling the gap with a confident guess.
        </p>
      </div>
    </div>
  );
}
