import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/client';
import RouteErrorBoundary from './RouteErrorBoundary';

let shouldThrow = false;
let throwError: Error = new Error('bad route');

function ThrowingChild() {
  if (shouldThrow) {
    throw throwError;
  }
  return <p>Recovered content</p>;
}

describe('RouteErrorBoundary', () => {
  const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

  beforeEach(() => {
    shouldThrow = false;
    throwError = new Error('bad route');
  });

  afterEach(() => {
    consoleError.mockClear();
  });

  afterAll(() => {
    consoleError.mockRestore();
  });

  it('renders children when there is no error', () => {
    render(
      <RouteErrorBoundary>
        <p>Safe</p>
      </RouteErrorBoundary>,
    );

    expect(screen.getByText('Safe')).toBeInTheDocument();
  });

  it('shows alert with message and Try again when a child throws', () => {
    shouldThrow = true;

    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something went wrong');
    expect(alert).toHaveTextContent('bad route');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('surfaces Request ID separately for ApiError', () => {
    shouldThrow = true;
    throwError = new ApiError('bad gateway', { status: 502, requestId: 'corr-99' });

    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('bad gateway');
    expect(alert).toHaveTextContent('Request ID');
    expect(alert).toHaveTextContent('corr-99');
    // Avoid duplicating the parenthetical form in the boundary UI.
    expect(alert.textContent).not.toMatch(/bad gateway \(request/);
  });

  it('recovers after Try again when child no longer throws', async () => {
    const user = userEvent.setup();
    shouldThrow = true;

    render(
      <RouteErrorBoundary>
        <ThrowingChild />
      </RouteErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toBeInTheDocument();

    shouldThrow = false;
    await user.click(screen.getByRole('button', { name: /try again/i }));

    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(screen.getByText('Recovered content')).toBeInTheDocument();
  });
});
