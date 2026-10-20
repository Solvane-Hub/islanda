import {
  Check,
  ClipboardList,
  FileText,
  LayoutList,
  type LucideIcon,
  Store,
  Target,
  TrendingUp,
} from 'lucide-react';
import { availableToday, type CapabilityId } from '@/lib/product/availability';

/**
 * Section B — what Islanda helps with today.
 *
 * The list is `availableToday()` from the availability register, not copy
 * written here, so this section can only ever name what the register says is
 * built. The closing line states the two limits a first-time visitor most
 * needs to know: Islanda files nothing with the government, and it does not
 * yet tell you which requirements apply.
 */
const ICONS: Partial<Record<CapabilityId, LucideIcon>> = {
  business_profile: Store,
  guided_questions: ClipboardList,
  business_summary: LayoutList,
  documents: FileText,
  goals: Target,
  money_records: TrendingUp,
};

export function AvailableToday() {
  const items = availableToday();
  return (
    <div className="flex flex-col gap-8">
      <ul className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
        {items.map((item) => {
          const Icon = ICONS[item.id] ?? Check;
          return (
            <li
              key={item.id}
              className="border-ink-line/70 flex gap-4 rounded-2xl border bg-white/[0.03] p-5"
            >
              <span className="bg-bahama-turquoise/12 text-bahama-turquoise flex size-9 shrink-0 items-center justify-center rounded-xl">
                <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
              </span>
              <div className="min-w-0">
                <h3 className="text-on-ink text-base font-semibold text-pretty">{item.name}</h3>
                <p className="text-on-ink-muted mt-1.5 text-sm text-pretty">{item.summary}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="text-on-ink-muted max-w-2xl text-sm text-pretty">
        <span className="text-on-ink font-medium">What Islanda does not do:</span> it does not
        register your business, apply for licences or send anything to the government for you, and
        it does not tell you which requirements apply to your business.
      </p>
    </div>
  );
}
