// @vitest-environment happy-dom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ErrorBoundary from '../src/components/ErrorBoundary';

afterEach(cleanup);

describe('ErrorBoundary', () => {
  it('catches a render throw, shows recovery UI, and Try again remounts children', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    let shouldThrow = true;
    function Flaky() {
      if (shouldThrow) throw new Error('boom');
      return <p>dashboard ok</p>;
    }

    render(
      <ErrorBoundary>
        <Flaky />
      </ErrorBoundary>,
    );
    expect(screen.getByRole('alert').textContent).toMatch(/Something went wrong/);
    expect(screen.queryByText('dashboard ok')).toBeNull();

    shouldThrow = false;
    fireEvent.click(screen.getByTestId('error-boundary-retry'));
    expect(screen.getByText('dashboard ok')).toBeTruthy();
    expect(screen.queryByTestId('error-boundary')).toBeNull();
    spy.mockRestore();
  });

  it('offers Sign out when provided', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const onSignOut = vi.fn();
    function Broken(): never {
      throw new Error('nope');
    }
    render(
      <ErrorBoundary onSignOut={onSignOut}>
        <Broken />
      </ErrorBoundary>,
    );
    fireEvent.click(screen.getByTestId('error-boundary-signout'));
    expect(onSignOut).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });

  it('renders children untouched when nothing throws', () => {
    render(
      <ErrorBoundary>
        <p>fine</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('fine')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
