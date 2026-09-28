import { expect, test } from '@playwright/test';

test.describe('Smoke', () => {
  test('application boots and renders', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Islanda' })).toBeVisible();
  });

  test('unknown routes return a helpful not-found page', async ({ page }) => {
    await page.goto('/this-route-does-not-exist');
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
  });

  test('landing page links into the auth flow', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('link', { name: 'Create an account' }).click();
    await expect(page).toHaveURL(/\/signup/);
  });
});
