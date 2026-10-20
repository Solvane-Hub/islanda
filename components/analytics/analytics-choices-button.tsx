'use client';

import { reopenConsent } from '@/lib/analytics/client';

/**
 * "Analytics choices" — lets a visitor change or withdraw their analytics
 * choice at any time. Withdrawing deletes the browser's analytics id at once.
 */
export function AnalyticsChoicesButton({ className }: { className?: string }) {
  return (
    <button type="button" onClick={reopenConsent} className={className}>
      Analytics choices
    </button>
  );
}
