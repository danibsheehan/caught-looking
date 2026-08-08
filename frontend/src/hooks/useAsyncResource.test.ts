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
      type PollPayload = { n: number; done: boolean };
      const fetch = vi
        .fn()
        .mockResolvedValueOnce({ n: 1, done: false })
        .mockResolvedValueOnce({ n: 2, done: true });

      const { result } = renderHook(() =>
        useAsyncResource<PollPayload>(
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
      type PollPayload = { ok: boolean; done: boolean };
      const fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, done: false })
        .mockRejectedValueOnce(new Error('network'))
        .mockResolvedValueOnce({ ok: true, done: true });

      const { result } = renderHook(() =>
        useAsyncResource<PollPayload>(
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

  it('skips poll fetches while the tab is hidden and refreshes on visible', async () => {
    vi.useFakeTimers();
    let visibility: 'visible' | 'hidden' | 'prerender' = 'visible';
    const visibilityDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });

    try {
      type PollPayload = { n: number; done: boolean };
      let seq = 0;
      const fetch = vi.fn().mockImplementation(async () => {
        seq += 1;
        return { n: seq, done: false };
      });

      const { result } = renderHook(() =>
        useAsyncResource<PollPayload>(
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
      expect(fetch).toHaveBeenCalledTimes(1);

      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));

      await vi.advanceTimersByTimeAsync(3_000);
      expect(fetch).toHaveBeenCalledTimes(1);

      visibility = 'visible';
      document.dispatchEvent(new Event('visibilitychange'));

      await vi.waitFor(() => expect(result.current.data?.n).toBe(2));
      expect(fetch).toHaveBeenCalledTimes(2);
    } finally {
      if (visibilityDesc) {
        Object.defineProperty(Document.prototype, 'visibilityState', visibilityDesc);
      } else {
        Reflect.deleteProperty(document, 'visibilityState');
      }
      vi.useRealTimers();
    }
  });

  it('sets updatedAt on success and reload refetches without clearing data', async () => {
    vi.useFakeTimers();
    try {
      const fetch = vi.fn().mockResolvedValueOnce({ n: 1 }).mockResolvedValueOnce({ n: 2 });

      const { result } = renderHook(() =>
        useAsyncResource(
          {
            fetch,
            initialPending: false,
            clearDataBeforeFetch: true,
          },
          [],
        ),
      );

      await vi.waitFor(() => expect(result.current.data).toEqual({ n: 1 }));
      expect(result.current.updatedAt).toEqual(expect.any(Number));
      const firstUpdatedAt = result.current.updatedAt!;

      vi.setSystemTime(firstUpdatedAt + 5_000);
      result.current.reload();

      await vi.waitFor(() => expect(result.current.data).toEqual({ n: 2 }));
      expect(fetch).toHaveBeenCalledTimes(2);
      expect(result.current.updatedAt).toBeGreaterThan(firstUpdatedAt);
      expect(result.current.error).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it('keeps prior error visible while a poll retry is in flight', async () => {
    vi.useFakeTimers();
    try {
      type PollPayload = { ok: boolean; done: boolean };
      let resolveRetry!: (value: PollPayload) => void;
      const fetch = vi
        .fn()
        .mockResolvedValueOnce({ ok: true, done: false })
        .mockRejectedValueOnce(new Error('network'))
        .mockImplementationOnce(
          () =>
            new Promise<PollPayload>((resolve) => {
              resolveRetry = resolve;
            }),
        );

      const { result } = renderHook(() =>
        useAsyncResource<PollPayload>(
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

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(result.current.error?.message).toBe('network'));
      expect(result.current.data?.ok).toBe(true);

      await vi.advanceTimersByTimeAsync(2_000);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(3));
      expect(result.current.error?.message).toBe('network');
      expect(result.current.data?.ok).toBe(true);

      resolveRetry({ ok: true, done: true });
      await vi.waitFor(() => expect(result.current.error).toBeNull());
      expect(result.current.data?.done).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it('still polls when hidden if pauseWhenHidden is false', async () => {
    vi.useFakeTimers();
    let visibility: 'visible' | 'hidden' | 'prerender' = 'visible';
    const visibilityDesc = Object.getOwnPropertyDescriptor(Document.prototype, 'visibilityState');
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => visibility,
    });

    try {
      type PollPayload = { n: number; done: boolean };
      const fetch = vi
        .fn()
        .mockResolvedValueOnce({ n: 1, done: false })
        .mockResolvedValueOnce({ n: 2, done: false });

      renderHook(() =>
        useAsyncResource<PollPayload>(
          {
            fetch,
            initialPending: false,
            poll: {
              intervalMs: 1_000,
              pauseWhenHidden: false,
              while: (data) => !data.done,
            },
          },
          [],
        ),
      );

      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));

      visibility = 'hidden';
      document.dispatchEvent(new Event('visibilitychange'));

      await vi.advanceTimersByTimeAsync(1_000);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    } finally {
      if (visibilityDesc) {
        Object.defineProperty(Document.prototype, 'visibilityState', visibilityDesc);
      } else {
        Reflect.deleteProperty(document, 'visibilityState');
      }
      vi.useRealTimers();
    }
  });
});
