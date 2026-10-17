import { expect, test } from '@playwright/test';

/**
 * Journey C, end to end: a new business owner starts from an idea.
 *
 *   sign in → add a business ("Build my business") → answer the five questions
 *   → leave mid-flow and resume → review → finish → Home → reload
 *
 * Uses the pre-provisioned RLS test user. Registration is covered separately in
 * auth.spec.ts — creating a real user per run would pollute auth.users and hit
 * Supabase's email rate limits.
 */
const EMAIL = process.env.RLS_TEST_USER_A_EMAIL ?? '';
const PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD ?? '';

test.describe('new business owner — full journey', () => {
  test.skip(!EMAIL || !PASSWORD, 'RLS test user credentials not configured');
  // Fifteen server round-trips plus clean-up. The 30s default was exceeded on a
  // dev server under parallel load even when every step passed.
  test.setTimeout(90_000);

  test('sign in → build a business → five questions → resume → Home', async ({ page }) => {
    const businessName = `E2E ${Date.now()}`;

    await page.goto('/login');
    await page.getByLabel('Email').fill(EMAIL);
    await page.getByLabel('Password').fill(PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // --- add a business: the "start from an idea" door -------------------
    await page.goto('/businesses/new');
    await page.getByRole('link', { name: /Build my business/ }).click();
    await expect(page).toHaveURL(/\/businesses\/new\/build/);
    await page
      .getByLabel('What is your business idea?')
      .fill('A seafood restaurant in Nassau serving locally caught fish.');
    await page.getByLabel('Business name').fill(businessName);
    await page.getByLabel('Which country will it operate in?').selectOption('BS');
    await page.getByLabel('Industry').fill('Restaurant');
    await page.getByRole('button', { name: 'Create my business' }).click();
    await expect(page).toHaveURL(/\/welcome/);

    // --- question 1 -------------------------------------------------------
    await page.getByRole('link', { name: /Answer five questions/ }).click();
    await expect(page).toHaveURL(/\/intake/);
    await page.goto('/intake?step=1');
    await page
      .getByLabel('What does the business do?')
      .fill('A seafood restaurant in Nassau serving locally caught fish.');
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // --- THE CRITICAL ASSERTION: leave mid-flow and come back -----------
    await expect(page).toHaveURL(/step=2/);
    await page.goto('/dashboard');
    await page.goto('/intake');
    await expect(page).toHaveURL(/step=2|\/intake$/);
    await page.goto('/intake?step=1');
    await expect(page.getByLabel('What does the business do?')).toHaveValue(/seafood restaurant/);

    // --- remaining questions ----------------------------------------------
    await page.goto('/intake?step=2');
    await page.getByLabel('Where are you today?').selectOption('idea');
    await page.getByLabel('Where will it operate?').fill('Nassau, New Providence');
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // Each save advances by a client-side navigation once the server confirms.
    // Wait for it: clicking "Save and continue" before it lands re-submits the
    // previous question instead of the next one.
    await expect(page).toHaveURL(/step=3/);
    await page.getByLabel(/How many people/).fill('3');
    await page.getByRole('button', { name: 'Save and continue' }).click();

    // "I don't know yet" must be SAID rather than inferred from a blank box —
    // a silent skip was indistinguishable from never having been asked (ADR-0020).
    await expect(page).toHaveURL(/step=4/);
    await page.getByRole('button', { name: 'Save and continue' }).click();
    await expect(page.getByText(/Enter an amount, or tick/)).toBeVisible();
    await page.getByRole('checkbox', { name: /I don.t know yet/ }).check();
    await page.getByRole('button', { name: 'Save and continue' }).click();

    await expect(page).toHaveURL(/step=5/);
    await page.getByLabel(/What do you want to achieve/).fill('Open a second location in a year.');
    await page.getByRole('button', { name: 'Save and review' }).click();

    // --- review and finish ------------------------------------------------
    await expect(page).toHaveURL(/\/intake\/review/);
    await expect(page.getByText('Nassau, New Providence')).toBeVisible();
    await page.getByRole('button', { name: 'Finish and go to Home' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // --- survives a reload ----------------------------------------------
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: businessName })).toBeVisible();
    await expect(page.getByText('Questions answered', { exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'What to do next' })).toBeVisible();

    // --- and shows nothing fabricated ------------------------------------
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Business Licence Act|Registrar General|Section \d+/);

    // --- clean up: archive (deletion is impossible by design) -------------
    await page.goto('/settings');
    await page.getByRole('button', { name: 'Archive this business' }).click();
    await page.getByRole('button', { name: 'Yes, archive it' }).click();
    await expect(page.getByText(/Archived/)).toBeVisible();
  });
});
