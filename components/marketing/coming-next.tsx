import { Banknote, CalendarClock, type LucideIcon, ShieldCheck, Sparkles } from 'lucide-react';
import { comingNext, STATUS_COPY, type CapabilityId } from '@/lib/product/availability';

/**
 * Section D — everything not usable today, in one list.
 *
 * Replaces the page's earlier three overlapping roadmaps (route stages,
 * perspectives, territory). The items and their status come from the
 * availability register; the status line is the register's customer wording,
 * so nothing here can claim a date, a launch or a capability on its own.
 */
const ICONS: Partial<Record<CapabilityId, LucideIcon>> = {
  cited_answers: Sparkles,
  requirements_guidance: ShieldCheck,
  important_dates: CalendarClock,
  funding: Banknote,
};

export function ComingNext() {
  return (
    <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4">
      {comingNext().map((item) => {
        const Icon = ICONS[item.id] ?? Sparkles;
        return (
          <li key={item.id} className="border-ink-line/70 flex gap-4 rounded-2xl border p-5">
            <Icon
              aria-hidden="true"
              className="text-champagne-dim mt-0.5 size-5 shrink-0"
              strokeWidth={1.75}
            />
            <div className="min-w-0">
              <h3 className="text-on-ink text-base font-semibold text-pretty">{item.name}</h3>
              <p className="text-on-ink-muted mt-1.5 text-sm text-pretty">{item.summary}</p>
              <p className="text-2xs text-on-ink-muted mt-3 font-medium tracking-wide uppercase">
                {/* Built but held back from public release (Nova, pending its
                    disclaimer sign-off) is not the same as not built. */}
                {item.status === 'in_development'
                  ? STATUS_COPY.in_development
                  : 'Built, being tested before release'}
              </p>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
