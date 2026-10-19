'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { track } from '@/lib/analytics/client';

/**
 * Sends one `page_view` per distinct path. Client navigations change the
 * pathname and are counted once; a re-render, a query-string change, or
 * React's development double-effect is not counted again (module-level guard
 * plus a short time window). Admin, API and auth paths are never tracked.
 */
let lastPath: string | null = null;
let lastSentAt = 0;

export function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!pathname) return;
    const now = Date.now();
    if (pathname === lastPath && now - lastSentAt < 2000) return;
    lastPath = pathname;
    lastSentAt = now;
    track('page_view');
  }, [pathname]);

  return null;
}
