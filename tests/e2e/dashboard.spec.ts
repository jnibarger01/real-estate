import { expect, test, type Page } from '@playwright/test';

function e2eCredentials() {
  const username = process.env.DASHBOARD_AUTH_USER;
  const password = process.env.DASHBOARD_AUTH_PASSWORD;
  if (!username || !password) {
    throw new Error('DASHBOARD_AUTH_USER and DASHBOARD_AUTH_PASSWORD must be set for e2e');
  }
  return { username, password };
}

async function loginViaForm(page: Page) {
  const { username, password } = e2eCredentials();
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await page.getByTestId('login-username').fill(username);
  await page.getByTestId('login-password').fill(password);
  await page.getByTestId('login-submit').click();
  await expect(page.getByRole('heading', { name: 'Jackson County Property Intelligence' })).toBeVisible({
    timeout: 30_000,
  });
}

test('unauthenticated API is 401 and document shows login', async ({ playwright, baseURL, browser }) => {
  const api = await playwright.request.newContext({ baseURL, httpCredentials: undefined });
  const response = await api.get('/api/dashboard/summary');
  expect(response.status()).toBe(401);
  expect(response.headers()['www-authenticate'] || '').toMatch(/Basic/i);
  await api.dispose();

  const anon = await browser.newContext();
  const page = await anon.newPage();
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await anon.close();
});

test('authenticated same-origin dashboard loads live API data', async ({ page }) => {
  await loginViaForm(page);
  await expect(page.getByText(/residential parcels across Jackson County/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('pages-not-pii')).toHaveCount(0);
  await expect(page.getByTestId('auth-required')).toHaveCount(0);

  const yoy = page.getByTestId('kpi-yoy');
  await expect(yoy).toContainText(/[+-]?\d+\.\d{2}%/);
  await expect(yoy).toContainText(/Avg market value, 20\d{2} vs 20\d{2}/);

  const badge = page.getByTestId('ingest-freshness-badge');
  await expect(badge).toBeVisible();
  const stamped = await badge.getAttribute('data-refreshed-at');
  expect(stamped).toBeTruthy();
  await expect(badge).toContainText(stamped!.slice(0, 10)); // YYYY-MM-DD from ingest_state
  await expect(badge).toContainText(/Fresh|Stale|Unknown/);
});

test('logout clears client state and returns to login', async ({ page }) => {
  await loginViaForm(page);
  await expect(page.getByTestId('logout-button')).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('property-row').first()).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('logout-button').click();
  await expect(page.getByTestId('login-page')).toBeVisible();
  await expect(page.getByTestId('property-row')).toHaveCount(0);
});

test('table select opens owner detail and close dismisses it', async ({ page }) => {
  await loginViaForm(page);
  const row = page.getByTestId('property-row').first();
  await expect(row).toBeVisible({ timeout: 30_000 });
  await row.click();

  const detail = page.getByTestId('property-detail');
  await expect(detail).toBeVisible();
  await expect(detail.getByText('Owner')).toBeVisible();
  await expect(detail.getByText('Mailing')).toBeVisible();

  await detail.getByRole('button', { name: 'Close' }).click();
  await expect(detail).toHaveCount(0);
});
