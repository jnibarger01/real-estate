// @vitest-environment happy-dom
import { cleanup, render } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { formatDocumentTitle, PRODUCT_TITLE, useDocumentTitle } from '../src/lib/documentTitle';

afterEach(cleanup);

function View({ name }: { name: string }) {
  useDocumentTitle(name);
  return null;
}

describe('document titles', () => {
  it('formats view titles with the stable product suffix', () => {
    expect(formatDocumentTitle('Sign in')).toBe('Sign in · Jackson County Property Intelligence');
    expect(formatDocumentTitle('Dashboard')).toBe('Dashboard · Jackson County Property Intelligence');
  });

  it('switches Sign in → Dashboard → Sign in across logout/login and restores on unmount', () => {
    document.title = PRODUCT_TITLE;
    const { rerender, unmount } = render(<View name="Sign in" />);
    expect(document.title).toBe('Sign in · Jackson County Property Intelligence');
    rerender(<View name="Dashboard" />);
    expect(document.title).toBe('Dashboard · Jackson County Property Intelligence');
    rerender(<View name="Sign in" />);
    expect(document.title).toBe('Sign in · Jackson County Property Intelligence');
    unmount();
    expect(document.title).toBe(PRODUCT_TITLE);
  });

  it('LoginPage and DashboardPage set their titles', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync('src/auth/LoginPage.tsx', 'utf8')).toMatch(/useDocumentTitle\('Sign in'\)/);
    expect(readFileSync('src/dashboard/DashboardPage.tsx', 'utf8')).toMatch(/useDocumentTitle\('Dashboard'\)/);
  });
});
