'use client';

import { useRef } from 'react';
import type { BusinessSummary } from '@/types/business';
import { selectBusinessAction } from '../actions';

/**
 * Switches the active business, on the ink header.
 *
 * A form submit rather than client-side state: the selection lives in a cookie
 * read by Server Components, so the server must be told. Progressive
 * enhancement means it still works without JavaScript.
 */
export function BusinessSelector({
  businesses,
  currentId,
}: {
  businesses: BusinessSummary[];
  currentId: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);

  if (businesses.length <= 1) return null;

  return (
    <form ref={formRef} action={selectBusinessAction} className="relative">
      <label htmlFor="business-selector" className="sr-only">
        Current business
      </label>
      <select
        id="business-selector"
        name="businessId"
        defaultValue={currentId}
        onChange={() => formRef.current?.requestSubmit()}
        className="text-on-ink h-9 max-w-[7.5rem] cursor-pointer appearance-none truncate rounded-lg bg-transparent pr-7 pl-2.5 text-sm font-medium transition-colors duration-150 outline-none hover:bg-white/8 sm:max-w-[15rem]"
      >
        {businesses.map((b) => (
          <option key={b.id} value={b.id} className="bg-ink text-on-ink">
            {b.name}
          </option>
        ))}
      </select>
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="text-on-glass-subtle pointer-events-none absolute top-1/2 right-2 size-3.5 -translate-y-1/2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m4 6 4 4 4-4" />
      </svg>
      <noscript>
        <button type="submit" className="text-on-ink ml-2 text-sm underline">
          Switch
        </button>
      </noscript>
    </form>
  );
}
