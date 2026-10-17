import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
  test('application boots and says who it is for', async ({ page }) => {
    await page.goto('/');
    await expect(
      page.getByRole('heading', { level: 1, name: /Starting a business in The Bahamas/ }),
    ).toBeVisible();
  });

  test('unknown routes return a helpful not-found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('the primary action leads to the waitlist form', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: /Join the early-access waitlist/ }).click();
    await expect(page.getByLabel('Email address')).toBeVisible();
  });

  // CI runs with WAITLIST_ONLY_MODE=false (open mode), where sign-in is offered.
  test('landing page links into the auth flow in open mode', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('banner').getByRole('link', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
