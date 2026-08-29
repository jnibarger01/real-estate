import { expect, test } from '@playwright/test';

test('unauthenticated document is 401', async ({ playwright, baseURL }) => {
  const api = await playwright.request.newContext({ baseURL, httpCredentials: undefined });
  const response = await api.get('/');
  expect(response.status()).toBe(401);
  expect(response.headers()['www-authenticate'] || '').toMatch(/Basic/i);
  await api.dispose();
});

test('authenticated same-origin dashboard loads live API data', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Jackson County Property Intelligence' })).toBeVisible();
  await expect(page.getByText(/residential parcels across Jackson County/i)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId('pages-not-pii')).toHaveCount(0);
  await expect(page.getByTestId('auth-required')).toHaveCount(0);

  const yoy = page.getByTestId('kpi-yoy');
  await expect(yoy).toContainText(/[+-]?\d+\.\d{2}%/);
  await expect(yoy).toContainText(/Avg market value, 20\d{2} vs 20\d{2}/);
});

test('table select opens owner detail and close dismisses it', async ({ page }) => {
  await page.goto('/');
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
