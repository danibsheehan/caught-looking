import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChartSuspense } from './ChartSuspense';

describe('ChartSuspense', () => {
  afterEach(() => {
    // Unmount (which may call requestIdleCallback/cancelIdleCallback cleanup) before
    // the stubs are removed -- otherwise the global setup.ts `cleanup()` runs after
    // this hook and throws on the now-undefined globals.
    cleanup();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('shows the skeleton, then renders children via setTimeout when requestIdleCallback is unavailable', () => {
    vi.stubGlobal('requestIdleCallback', undefined);
    vi.useFakeTimers();

    render(
      <ChartSuspense label="Loading test chart">
        <div>chart content</div>
      </ChartSuspense>,
    );

    expect(screen.getByRole('status', { name: 'Loading test chart' })).toBeInTheDocument();
    expect(screen.queryByText('chart content')).not.toBeInTheDocument();

    act(() => {
      vi.runOnlyPendingTimers();
    });

    expect(screen.getByText('chart content')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('renders children once requestIdleCallback fires when available', () => {
    let idleCallback: (() => void) | undefined;
    const cancelIdleCallback = vi.fn();
    vi.stubGlobal(
      'requestIdleCallback',
      vi.fn((cb: () => void) => {
        idleCallback = cb;
        return 1;
      }),
    );
    vi.stubGlobal('cancelIdleCallback', cancelIdleCallback);

    render(
      <ChartSuspense>
        <div>idle content</div>
      </ChartSuspense>,
    );

    expect(screen.queryByText('idle content')).not.toBeInTheDocument();
    act(() => idleCallback?.());
    expect(screen.getByText('idle content')).toBeInTheDocument();
  });

  describe('when requestIdleCallback is available', () => {
    beforeEach(() => {
      vi.stubGlobal(
        'requestIdleCallback',
        vi.fn((cb: () => void) => {
          cb();
          return 1;
        }),
      );
      vi.stubGlobal('cancelIdleCallback', vi.fn());
    });

    it('cancels the idle callback on unmount', () => {
      const { unmount } = render(
        <ChartSuspense>
          <div>content</div>
        </ChartSuspense>,
      );
      unmount();
      expect(window.cancelIdleCallback).toHaveBeenCalledWith(1);
    });
  });
});
