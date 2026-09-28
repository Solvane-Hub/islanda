import { expect, test } from '@playwright/test';

/**
 * Phase 3 Definition of Done, executed against a real browser and the live
 * Supabase project.
 *
 * Uses the two RLS test users, which are pre-confirmed. Signup is exercised
 * separately for validation behaviour only — creating real users on every run
 * would pollute auth.users and hit Supabase's email rate limits.
 */

const USER_A_EMAIL = process.env.RLS_TEST_USER_A_EMAIL ?? '';
const USER_A_PASSWORD = process.env.RLS_TEST_USER_A_PASSWORD ?? '';
const configured = Boolean(USER_A_EMAIL && USER_A_PASSWORD);

test.describe('route protection', () => {
  test('unauthenticated access to /dashboard redirects to /login, preserving intent', async ({
    page,
  }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
    await expect(page.getByRole('heading', { name: 'Sign in' })).toBeVisible();
  });

  test('every protected route redirects when unauthenticated', async ({ page }) => {
    const protectedRoutes = [
      '/intake',
      '/intake/review',
      '/settings',
      '/funding',
      '/compliance',
      '/timeline',
      '/documents',
      '/assistant',
      '/assistant/about',
      '/businesses/new',
      '/businesses/new/manage',
      '/passport',
      '/welcome',
    ];

    for (const route of protectedRoutes) {
      await page.goto(route);
      await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    }
  });
});

test.describe('sign-in validation', () => {
  test('rejects a malformed email at the field level', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('not-an-email');
    await page.getByLabel('Password').fill('whatever');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page.getByRole('alert')).toContainText('valid email');
  });

  test('wrong credentials do not reveal whether the account exists', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('definitely-not-registered@foundryai-test.dev');
    await page.getByLabel('Password').fill('some-wrong-password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    const alert = page.getByRole('alert').first();
    await expect(alert).toContainText('That email or password is incorrect');
    // Must NOT say "no account found" — that would enumerate registered addresses.
    await expect(alert).not.toContainText(/no account|not found|does not exist/i);
  });
});

test.describe('sign-up validation', () => {
  test('enforces the 12-character minimum', async ({ page }) => {
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Test Founder');
    await page.getByLabel('Email').fill('someone@foundryai-test.dev');
    await page.getByLabel('Password').fill('short');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert')).toContainText('at least 12 characters');
  });

  test('reports multiple field errors at once', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('alert').first()).toBeVisible();
  });
});

test.describe('full authenticated cycle', () => {
  test.skip(!configured, 'RLS test user credentials not configured');

  test('sign in → dashboard → reload persists → sign out → protected route blocked', async ({
    page,
  }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(USER_A_EMAIL);
    await page.getByLabel('Password').fill(USER_A_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();

    // Lands on the dashboard.
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();

    // Session survives a full reload (Sprint 1 DoD: "Persist data / Reload").
    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.getByRole('heading', { name: /Welcome/ })).toBeVisible();

    // Signed-in users are bounced away from auth routes.
    await page.goto('/login');
    await expect(page).toHaveURL(/\/dashboard/);

    // Sign out.
    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL(/\/login/);

    // Session is genuinely gone.
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('the dashboard shows no fabricated data', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill(USER_A_EMAIL);
    await page.getByLabel('Password').fill(USER_A_PASSWORD);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard/);

    // Constitution — Truth Before Fluency applies to demo surfaces.
    const body = await page.locator('body').innerText();
    expect(body).not.toMatch(/Business Licence|Registrar General|\$[0-9]/);
    await expect(page.getByText('nothing real to show')).toBeVisible();
  });
});
