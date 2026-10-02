import { FileStack, MessagesSquare, Scale, TrendingUp } from 'lucide-react';

/**
 * Section 02 — the problem.
 *
 * Named plainly, before the product is shown: a founder's information about
 * their own business is scattered across sources that don't talk to each
 * other, and a generic AI chatbot answers questions without holding any of
 * it — it has no memory of this specific business between one question and
 * the next.
 */
const SOURCES = [
  { icon: FileStack, label: 'Documents & records' },
  { icon: TrendingUp, label: 'Financial records' },
  { icon: Scale, label: 'Regulations & requirements' },
  { icon: MessagesSquare, label: 'Conversations & goals' },
] as const;

export function Problem() {
  return (
    <div className="flex flex-col gap-12 lg:flex-row lg:items-center lg:gap-16">
      <div className="max-w-xl">
        <p className="text-on-ink-muted text-base text-pretty sm:text-lg">
          What a business owner needs to know about their own business is scattered across
          documents, financial records, regulations, goals, other software, and conversations that
          never refer to one another. Generic AI can answer a question — but without persistent
          context about this specific business, it doesn&apos;t actually understand the business
          asking it.
        </p>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3 sm:gap-4">
        {SOURCES.map(({ icon: Icon, label }) => (
          <div
            key={label}
            className="border-ink-line/70 flex flex-col gap-3 rounded-2xl border bg-white/[0.03] px-5 py-6"
          >
            <Icon aria-hidden="true" className="text-champagne-dim size-5" strokeWidth={1.75} />
            <span className="text-on-ink text-sm font-medium text-pretty">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
