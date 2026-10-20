import { ChevronDown } from 'lucide-react';
import { ACCESS_COPY, type AccessMode } from '@/lib/product/availability';

/**
 * Section D — straight answers.
 *
 * Native `<details>`: keyboard- and screen-reader-operable with no client
 * JavaScript, and every answer is in the server HTML. Answers that depend on
 * who can get in are built from the access mode, so this section cannot
 * promise access the sign-in pages would refuse.
 *
 * Nothing here names a government office or describes a legal requirement:
 * the honest answer to "where do I check?" is the responsible office or a
 * qualified professional, not a list we have not verified.
 */
export function Faq({ mode }: { mode: AccessMode }) {
  const open = ACCESS_COPY[mode].signUpAvailable;

  const items: { q: string; a: string }[] = [
    {
      q: 'Who is Islanda for?',
      a: 'People starting or running a small business in The Bahamas, especially anyone who is not sure where to begin.',
    },
    {
      q: 'Can I use it today?',
      a: open
        ? 'Yes. During early access you can create an account and use the features listed under “What you can do in Islanda today”.'
        : 'Not yet. Islanda is in early access and is not open to the public. Join the waitlist and we will email you when access opens.',
    },
    {
      q: 'Is access open to everyone?',
      a: open
        ? 'During early access, anyone can create an account.'
        : 'Not yet. Sign-in is closed while we prepare early access. The waitlist is how you get in line.',
    },
    {
      q: 'Does Islanda register my business for me?',
      a: 'No. Islanda does not register businesses, apply for licences or send anything to the government on your behalf. It helps you organise your information so you are better prepared to do those things yourself.',
    },
    {
      q: 'Is Islanda a government website?',
      a: 'No. Islanda is built by Solvane Hub, a private company. It is not a government service and does not speak for any government office.',
    },
    {
      q: 'How does Islanda use my business information?',
      a: 'What you enter is kept in your private Islanda account and used to show you your own workspace. Other users cannot see it. Documents you upload are kept in private storage, and Islanda does not read their contents. If you join the waitlist, we keep your name and email address, and your phone number if you give it, so we can contact you about early access. Answers to our optional follow-up questions are used only to understand what entrepreneurs need and to plan early testing.',
    },
    {
      q: 'What happens after I join the waitlist?',
      a: 'You will get a confirmation email from waitlist@solvanehub.us. When early access opens to more people, we will email you again. Joining the waitlist does not create an account.',
    },
    {
      q: 'Where should I check official requirements?',
      a: 'Always confirm requirements with the government office responsible for your type of business, or with a qualified professional such as an attorney or accountant. Islanda is not legal advice.',
    },
  ];

  return (
    <div className="border-ink-line/70 divide-ink-line/70 flex flex-col divide-y rounded-2xl border">
      {items.map(({ q, a }) => (
        <details key={q} className="group">
          <summary className="text-on-ink flex min-h-14 cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-base font-medium marker:content-none sm:px-6">
            <h3 className="text-pretty">{q}</h3>
            <ChevronDown
              aria-hidden="true"
              className="text-on-ink-muted size-5 shrink-0 transition-transform duration-200 group-open:rotate-180"
              strokeWidth={2}
            />
          </summary>
          <p className="text-on-ink-muted max-w-3xl px-5 pb-5 text-sm text-pretty sm:px-6 sm:text-base">
            {a}
          </p>
        </details>
      ))}
    </div>
  );
}
