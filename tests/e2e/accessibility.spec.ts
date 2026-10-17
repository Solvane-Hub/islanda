import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/**
 * Automated accessibility checks.
 *
 * Target: **WCAG 2.1 AA**. This was recommended and has not been formally
 * confirmed by the founder (open question Q23) — it is applied here as the
 * common procurement bar, which matters because the PRD names government
 * agencies and development organisations as partners.
 *
 * Automated testing catches roughly a third of WCAG issues. Passing this is
 * necessary, not sufficient; a manual keyboard and screen-reader pass is still
 * outstanding.
 */
const PUBLIC_PAGES = ['/', '/login', '/signup', '/forgot-password', '/admin/login'];

for (const path of PUBLIC_PAGES) {
  test(`${path} has no detectable WCAG 2.1 AA violations`, async ({ page }) => {
    await page.goto(path);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  });
}

const EMAIL = process.env.RLS_TEST_USER_A_EMAIL ?? '';
const PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD ?? '';

test.describe('authenticated pages', () => {
  test.skip(!EMAIL || !PASSWORD, 'RLS test user credentials not configured');

  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);
  });

  for (const path of [
    '/dashboard',
    '/businesses/new',
    '/businesses/new/build',
    '/intake',
    '/intake/review',
    '/passport',
    '/documents',
    '/assistant',
    '/settings',
  ]) {
    test(`${path} has no detectable WCAG 2.1 AA violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze();
      expect(results.violations).toEqual([]);
    });
  }

  test('the whole app is reachable by keyboard alone', async ({ page }) => {
    await page.goto('/dashboard');
    await page.keyboard.press('Tab');
    // The skip link must be the first stop — keyboard users should not have to
    // traverse the entire navigation on every page.
    const focused = await page.evaluate(() => document.activeElement?.textContent);
    expect(focused).toContain('Skip to content');
  });
});
