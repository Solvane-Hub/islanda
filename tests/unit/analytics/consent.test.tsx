import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db/rate-limit', () => ({ consumeRateLimit: vi.fn() }));

import { analyticsContext } from '@/services/analytics/context';
import { AnalyticsConsent } from '@/components/analytics/analytics-consent';
import { AnalyticsChoicesButton } from '@/components/analytics/analytics-choices-button';
import { CONSENT_COOKIE, VISITOR_COOKIE } from '@/lib/analytics/events';

const ID = '0b7a2a62-6f6b-4c8e-9d5f-2b2b0a0e9e11';
const granted = (name: string) =>
  name === CONSENT_COOKIE ? 'granted' : name === VISITOR_COOKIE ? ID : undefined;

function clearCookies() {
  for (const c of document.cookie.split('; ')) {
    const name = c.split('=')[0];
    if (name) document.cookie = `${name}=; Max-Age=0; Path=/`;
  }
}

afterEach(clearCookies);

describe('server-side privacy signals', () => {
  it('uses the stored choice when the browser sends no signal', () => {
    const ctx = analyticsContext(new Headers({ host: 'islanda.app' }), granted);
    expect(ctx).toMatchObject({ consent: 'granted', visitorId: ID });
  });

  it.each([
    ['Sec-GPC', 'sec-gpc'],
    ['DNT', 'dnt'],
  ])('a %s signal overrides an earlier "Allow" and drops the persistent id', (_, header) => {
    const ctx = analyticsContext(new Headers({ host: 'islanda.app', [header]: '1' }), granted);
    expect(ctx).toMatchObject({ consent: 'denied', visitorId: null });
  });
});

describe('changing the analytics choice', () => {
  it('the footer control withdraws the choice and id, and brings the prompt back', () => {
    document.cookie = `${CONSENT_COOKIE}=granted; Path=/`;
    document.cookie = `${VISITOR_COOKIE}=${ID}; Path=/`;
    render(
      <>
        <AnalyticsConsent />
        <AnalyticsChoicesButton />
      </>,
    );
    // A choice is recorded, so no prompt.
    expect(screen.queryByRole('region', { name: 'Analytics choice' })).toBeNull();

    act(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Analytics choices' }));
    });
    expect(document.cookie).not.toContain(CONSENT_COOKIE);
    expect(document.cookie).not.toContain(VISITOR_COOKIE);
    expect(screen.getByRole('region', { name: 'Analytics choice' })).toBeTruthy();

    // Choosing again works and hides the prompt.
    fireEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(screen.queryByRole('region', { name: 'Analytics choice' })).toBeNull();
    expect(document.cookie).toContain(`${CONSENT_COOKIE}=denied`);
  });
});
