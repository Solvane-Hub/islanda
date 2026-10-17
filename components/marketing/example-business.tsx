import { Check, Clock } from 'lucide-react';

/**
 * Section C — one relatable example, labelled as an illustration.
 *
 * The answers mirror the five guided questions the app actually asks, in the
 * same order, so the example shows the real workflow rather than an imagined
 * one. The business is invented and says so twice — on the card and under it —
 * because a sample read as a real customer, or as a government determination,
 * is the misreading this page has to rule out.
 *
 * "What she can't get yet" is part of the example on purpose: the honest edge
 * of the product is information the visitor needs before joining.
 */
const ANSWERS = [
  {
    question: 'What does the business do?',
    answer: 'Sells conch salad and fritters from a weekend stand.',
  },
  { question: 'Where are you today, and where will it operate?', answer: 'Just an idea · Nassau' },
  { question: 'How many people will work in it?', answer: '2 people' },
  { question: 'How much money do you think you need?', answer: 'I don’t know yet' },
  { question: 'What do you want to achieve?', answer: 'Run the stand every weekend this year.' },
] as const;

const TODAY = [
  'Her five answers are saved in one business profile she can change any time.',
  'She keeps her supplier receipts and menu photos in private document storage.',
  'She sets a goal and records her first weekend’s sales against it.',
] as const;

const NOT_YET =
  'Which licences or registrations her stand needs. That guidance is still being built.';

export function ExampleBusiness() {
  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:items-start lg:gap-12">
      <figure className="border-ink-line/70 bg-ink/60 overflow-hidden rounded-2xl border">
        <div className="border-ink-line/70 flex flex-wrap items-center gap-x-3 gap-y-2 border-b px-5 py-4">
          <p className="text-on-ink text-base font-semibold">Conch &amp; Coast</p>
          <span className="border-champagne/40 text-champagne text-2xs ml-auto rounded-full border px-2.5 py-1 font-medium tracking-wide uppercase">
            Made-up example
          </span>
        </div>
        <dl className="flex flex-col divide-y divide-white/8">
          {ANSWERS.map(({ question, answer }) => (
            <div key={question} className="flex flex-col gap-1 px-5 py-3.5">
              <dt className="text-on-ink-muted text-xs">{question}</dt>
              <dd className="text-on-ink text-sm font-medium text-pretty">{answer}</dd>
            </div>
          ))}
        </dl>
        <figcaption className="text-on-ink-muted border-ink-line/70 border-t px-5 py-3 text-xs text-pretty">
          Illustration only. Conch &amp; Coast is not a real business or customer, and nothing here
          is official advice.
        </figcaption>
      </figure>

      <div className="flex flex-col gap-8">
        <div>
          <h3 className="text-on-ink text-lg font-semibold">What she can do in Islanda today</h3>
          <ul className="mt-4 flex flex-col gap-3">
            {TODAY.map((line) => (
              <li key={line} className="text-on-ink-muted flex gap-3 text-sm text-pretty">
                <Check
                  aria-hidden="true"
                  className="text-bahama-turquoise mt-0.5 size-4 shrink-0"
                  strokeWidth={2.5}
                />
                {line}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-on-ink text-lg font-semibold">What she can’t get yet</h3>
          <p className="text-on-ink-muted mt-4 flex gap-3 text-sm text-pretty">
            <Clock
              aria-hidden="true"
              className="text-champagne-dim mt-0.5 size-4 shrink-0"
              strokeWidth={2}
            />
            {NOT_YET}
          </p>
        </div>
      </div>
    </div>
  );
}
