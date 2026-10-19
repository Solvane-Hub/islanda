import 'server-only';

import { after } from 'next/server';
import { cookies, headers } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { errorCategoryFor, recordServerEvent } from '@/services/analytics';
import { analyticsContext } from '@/services/analytics/context';

/**
 * Records that a signed-in workflow failed (a save, an upload, an archive…),
 * for the admin Product Usage error breakdown. Runs AFTER the response with
 * `after()`, so it never delays or changes what the founder sees, and never
 * throws. Stores the feature area, a safe error category and the page path —
 * never the input, the error message or any business content.
 */
export function reportProductFailure(area: string, code: string | undefined): void {
  try {
    after(async () => {
      try {
        const [h, c] = await Promise.all([headers(), cookies()]);
        const db = await createClient();
        const {
          data: { user },
        } = await db.auth.getUser();
        let path = `/${area}`;
        try {
          const referer = h.get('referer');
          if (referer) path = new URL(referer).pathname;
        } catch {
          // Keep the area fallback.
        }
        await recordServerEvent(
          {
            name: 'product_action_failed',
            path,
            status: 'failure',
            errorCategory: errorCategoryFor(code),
            userId: user?.id ?? null,
            properties: { area },
          },
          analyticsContext(h, (name) => c.get(name)?.value),
        );
      } catch {
        // Analytics never affects the product.
      }
    });
  } catch {
    // Outside a request scope (e.g. unit tests) there is nothing to record.
  }
}
