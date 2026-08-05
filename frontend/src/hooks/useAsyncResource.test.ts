import { renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { isAbortError, useAsyncResource } from './useAsyncResource';

describe('isAbortError', () => {
  it('detects DOMException AbortError', () => {
    expect(isAbortError(new DOMException('Aborted', 'AbortError'))).toBe(true);
  });

  it('returns false for other errors', () => {
    expect(isAbortError(new Error('fail'))).toBe(false);
    expect(isAbortError(null)).toBe(false);
  });
});

describe('useAsyncResource', () => {
  it('resolves data and clears loading', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true });

    const { result } = renderHook(() => useAsyncResource({ fetch, initialPending: true }, []));

    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(fetch).toHaveBeenCalledTimes(1);
    expect(fetch.mock.calls[0]![0]).toBeInstanceOf(AbortSignal);
    expect(result.current.data).toEqual({ ok: true });
    expect(result.current.error).toBeNull();
  });

  it('normalizes non-Error rejections', async () => {
    const fetch = vi.fn().mockRejectedValue('boom');

    const { result } = renderHook(() => useAsyncResource({ fetch, initialPending: false }, []));

    await waitFor(() => expect(result.current.error?.message).toBe('boom'));
    expect(result.current.data).toBeNull();
  });

  it('does not fetch when disabled', () => {
    const fetch = vi.fn().mockResolvedValue(1);

    const { result } = renderHook(() => useAsyncResource({ enabled: false, fetch }, []));

    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBeNull();
  });

  it('keeps data when disabled if resetOnDisable is false', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(42).mockResolvedValueOnce(99);

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAsyncResource({ enabled, fetch, initialPending: false, resetOnDisable: false }, [
          enabled,
        ]),
      { initialProps: { enabled: true } },
    );

    await waitFor(() => expect(result.current.data).toBe(42));

    rerender({ enabled: false });

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toBe(42);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('clears data when deps change and clearDataBeforeFetch is true', async () => {
    const { result, rerender } = renderHook(
      ({ key }: { key: number }) =>
        useAsyncResource(
          {
            fetch: () => Promise.resolve({ v: key }),
            initialPending: false,
            clearDataBeforeFetch: true,
          },
          [key],
        ),
      { initialProps: { key: 1 } },
    );

    await waitFor(() => expect(result.current.data?.v).toBe(1));

    rerender({ key: 2 });

    await waitFor(() => expect(result.current.data?.v).toBe(2));
    expect(result.current.error).toBeNull();
  });

  it('refetches when deps change', async () => {
    const { result, rerender } = renderHook(
      ({ n }: { n: number }) =>
        useAsyncResource(
          {
            fetch: () => Promise.resolve(n),
            initialPending: false,
          },
          [n],
        ),
      { initialProps: { n: 1 } },
    );

    await waitFor(() => expect(result.current.data).toBe(1));

    rerender({ n: 2 });

    await waitFor(() => expect(result.current.data).toBe(2));
  });

  it('ignores AbortError when deps change aborts the prior request', async () => {
    let invocations = 0;
    const fetch = vi.fn((signal: AbortSignal) => {
      invocations++;
      if (invocations === 1) {
        return new Promise<number>((_, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        });
      }
      return Promise.resolve(2);
    });

    const { result, rerender } = renderHook(
      ({ n }: { n: number }) => useAsyncResource({ fetch, initialPending: false }, [n]),
      { initialProps: { n: 1 } },
    );

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    rerender({ n: 2 });

    await waitFor(() => expect(result.current.data).toBe(2));
    expect(result.current.error).toBeNull();
  });

  it('polls until while() returns false and keeps prior data between polls', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce({ n: 1, done: false })
        .mockResolvedValueOnce({ n: 2, done: true });

      const { result } = renderHook(() =>
        useAsyncResource(
          {
            fetch,
            initialPending: false,
            poll: {
              intervalMs: 1_000,
              while: (data) => !data.done,
            },
          },
          [],
        ),
      );

      await vi.waitFor(() => expect(result.current.data?.n).toBe(1));
      expect(result.current.loading).toBe(false);
      expect(fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(result.current.data?.n).toBe(2));
      expect(fetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(2_000);
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
    }
  });

  it('backs off after poll errors then recovers', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, done: false })
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ ok: true, done: true });

      const { result } = renderHook(() =>
        useAsyncResource(
          {
            fetch,
            initialPending: false,
            poll: {
              intervalMs: 1_000,
              maxIntervalMs: 10_000,
              while: (data) => !data.done,
            },
          },
          [],
        ),
      );

      await vi.waitFor(() => expect(result.current.data?.ok).toBe(true));
      expect(fetch).toHaveBeenCalledTimes(1);

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(result.current.error?.message).toBe('network'));
      expect(result.current.data?.ok).toBe(true);
      expect(fetch).toHaveBeenCalledTimes(2);

      await vi.advanceTimersByTimeAsync(2_000);
      await vi.waitFor(() => expect(result.current.data?.done).toBe(true));
      expect(result.current.error).toBeNull();
      expect(fetch).toHaveBeenCalledTimes(3);
    } finally {
      vi.useRealTimers();
    }
  });
});
