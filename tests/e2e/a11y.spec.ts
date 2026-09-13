import AxeBuilder from '@axe-core/playwright';
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

/** Fail CI on serious/critical axe findings; report ids for triage. */
async function expectNoSeriousAxeViolations(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
    .analyze();

  const blocking = results.violations.filter(
    (v) => v.impact === 'serious' || v.impact === 'critical',
  );

  expect(
    blocking,
    `${label} serious/critical axe violations:\n${blocking
      .map((v) => `- [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} nodes)`)
      .join('\n')}`,
  ).toEqual([]);
}

test('login view has no serious axe violations', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('login-page')).toBeVisible();
  await expectNoSeriousAxeViolations(page, 'login');
});

test('search results view has no serious axe violations', async ({ page }) => {
  await loginViaForm(page);
  await expect(page.getByTestId('property-row').first()).toBeVisible({ timeout: 30_000 });
  await expectNoSeriousAxeViolations(page, 'search results');
});

test('keyboard Enter submits property search', async ({ page }) => {
  await loginViaForm(page);
  await expect(page.getByTestId('property-row').first()).toBeVisible({ timeout: 30_000 });

  const search = page.getByTestId('dashboard-search');
  await search.focus();
  await search.fill('MAIN');
  await search.press('Enter');

  await expect(page.getByTestId('property-row')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByTestId('property-row').first()).toContainText(/100 MAIN ST/i);
});
