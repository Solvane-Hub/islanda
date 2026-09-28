import { describe, expect, it } from 'vitest';
import {
  buildWaitlistConfirmationMessage,
  ISLANDA_PUBLIC_URL,
  SOLVANE_HUB_INSTAGRAM_URL,
  SOLVANE_HUB_URL,
  WAITLIST_LOGO_CONTENT_ID,
} from '@/lib/email/templates/waitlist-confirmation';

describe('waitlist confirmation email', () => {
  const data = {
    email: 'jamil@example.com',
    firstName: 'Jamil',
    lastName: 'Nash',
    status: 'joined' as const,
  };

  it('builds a branded email for the signup recipient', () => {
    const message = buildWaitlistConfirmationMessage(data);

    expect(message.to).toBe(data.email);
    expect(message.subject).toBe("You're on the Islanda waitlist");
    expect(message.preheader).toContain('Thanks for joining Islanda');
    expect(message.html).toContain(`cid:${WAITLIST_LOGO_CONTENT_ID}`);
    expect(message.html).toContain('Islanda');
    expect(message.html).toContain('A Solvane Hub product');
    expect(message.html).toContain(`href="${ISLANDA_PUBLIC_URL}"`);
    expect(message.html).toContain(`href="${SOLVANE_HUB_URL}"`);
    expect(message.html).toContain(`href="${SOLVANE_HUB_INSTAGRAM_URL}"`);
  });

  it('personalizes with first and last name and escapes user values', () => {
    const message = buildWaitlistConfirmationMessage({
      ...data,
      firstName: '<img src=x onerror=alert(1)>',
      lastName: "O'Connor & Co",
    });

    expect(message.html).toContain('Hi &lt;img src=x onerror=alert(1)&gt; O&#39;Connor &amp; Co,');
    expect(message.html).not.toContain('<img src=x onerror=alert(1)>');
    expect(message.text).toContain("Hi <img src=x onerror=alert(1)> O'Connor & Co,");
  });

  it('renders well-formed HTML markup', () => {
    const message = buildWaitlistConfirmationMessage(data);
    const parsed = new DOMParser().parseFromString(message.html, 'text/html');

    expect(parsed.querySelector('parsererror')).toBeNull();
    expect(parsed.querySelectorAll('table').length).toBeGreaterThan(0);
    expect(parsed.querySelector('a[href="https://solvanehub.us/islanda"]')?.textContent).toBe(
      'Visit Islanda',
    );
  });
});
