import { Scissors, Store, UtensilsCrossed } from 'lucide-react';

/**
 * Section A — the problem, in the visitor's own situation.
 *
 * Three recognisable starting points, each with the questions people actually
 * ask. They are QUESTIONS only: this section answers none of them, because
 * answering a regulatory question on a marketing page would be exactly the
 * unsourced guidance Islanda exists to avoid.
 */
const SITUATIONS = [
  {
    icon: UtensilsCrossed,
    title: 'Selling food from home',
    questions: ['Do I need a licence?', 'Is there an inspection?', 'Which office do I go to?'],
  },
  {
    icon: Scissors,
    title: 'Opening a salon',
    questions: ['Do I need to register first?', 'What about staff?', 'What paperwork comes next?'],
  },
  {
    icon: Store,
    title: 'Turning a side hustle into a business',
    questions: [
      'When should I register?',
      'Do I need to charge tax?',
      'Is my information current?',
    ],
  },
] as const;

export function Problem() {
  return (
    <div className="flex flex-col gap-10 lg:gap-12">
      <p className="text-on-ink-muted max-w-2xl text-base text-pretty sm:text-lg">
        The information exists, but it is spread across government websites, PDFs, offices and
        advice from friends. It is hard to know which of it applies to you, whether it is still
        current, and what to do first.
      </p>

      <ul className="grid gap-3 sm:gap-4 md:grid-cols-3">
        {SITUATIONS.map(({ icon: Icon, title, questions }) => (
          <li
            key={title}
            className="border-ink-line/70 flex flex-col gap-4 rounded-2xl border bg-white/[0.03] px-5 py-6"
          >
            <Icon aria-hidden="true" className="text-champagne-dim size-5" strokeWidth={1.75} />
            <h3 className="text-on-ink text-base font-semibold text-pretty">{title}</h3>
            <ul className="flex flex-col gap-1.5">
              {questions.map((q) => (
                <li key={q} className="text-on-ink-muted text-sm text-pretty">
                  {q}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
