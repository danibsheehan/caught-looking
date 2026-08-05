import { startTransition, useEffect, useRef, useState, type DependencyList } from 'react';

export function normalizeAsyncError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e));
}

/** True when {@link fetch} was aborted (user navigated away or deps changed). */
export function isAbortError(e: unknown): boolean {
  if (e == null || typeof e !== 'object') return false;
  return (e as { name?: string }).name === 'AbortError';
}

export type AsyncResourceResult<T> = {
  data: T | null;
  error: Error | null;
  loading: boolean;
};

export type AsyncResourcePoll<T> = {
  /** Base delay between successful polls (e.g. live game TTL). */
  intervalMs: number;
  /** Cap for exponential backoff after errors (default 5 minutes). */
  maxIntervalMs?: number;
  /** Keep polling while this returns true for the latest successful payload. */
  while: (data: T) => boolean;
  /**
   * When true (default), skip firing polls while `document.visibilityState` is hidden;
   * resume with an immediate refresh when the tab becomes visible again.
   */
  pauseWhenHidden?: boolean;
};

export type UseAsyncResourceInput<T> = {
  /** When false, no request runs; see `resetOnDisable` for `data` / `error` handling. */
  enabled?: boolean;
  /** Passed to app `fetch*` helpers so in-flight work aborts on unmount or dependency change. */
  fetch: (signal: AbortSignal) => Promise<T>;
  /**
   * When true (default), `loading` is true on first mount while enabled until the first request settles.
   * When false, `loading` is only true while a request is in flight.
   */
  initialPending?: boolean;
  /**
   * When `enabled` becomes false: if true (default), clear `data` and `error`.
   * If false, keep the last successful `data` (matches prior early-return chart effects).
   */
  resetOnDisable?: boolean;
  /**
   * When true, clear `data` at the start of each fetch (e.g. route param changed).
   * Default false so in-flight refetches can keep showing the previous payload.
   * Background polls never clear data even when this is true (only the initial deps-driven fetch does).
   */
  clearDataBeforeFetch?: boolean;
  /** Optional live refresh loop (pause when settled / tab hidden; backoff on errors). */
  poll?: AsyncResourcePoll<T>;
};

/**
 * Shared async API loading: {@link AbortController} abort on cleanup, {@link normalizeAsyncError},
 * and `startTransition` for loading/error resets (replaces ad hoc `setTimeout(0)` + setState).
 */
export function useAsyncResource<T>(
  input: UseAsyncResourceInput<T>,
  deps: DependencyList,
): AsyncResourceResult<T> {
  const {
    enabled = true,
    fetch: fetchFn,
    initialPending = true,
    resetOnDisable = true,
    clearDataBeforeFetch = false,
    poll,
  } = input;

  const fetchRef = useRef(fetchFn);
  const resetOnDisableRef = useRef(resetOnDisable);
  const clearDataBeforeFetchRef = useRef(clearDataBeforeFetch);
  const pollRef = useRef(poll);
  const dataRef = useRef<T | null>(null);

  useEffect(() => {
    fetchRef.current = fetchFn;
    resetOnDisableRef.current = resetOnDisable;
    clearDataBeforeFetchRef.current = clearDataBeforeFetch;
    pollRef.current = poll;
  });

  const active = enabled;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(() => active && initialPending);
  /** Incremented on each cleanup so superseded fetches (e.g. mocks that ignore abort) do not clear `loading`. */
  const requestSeqRef = useRef(0);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (!active) {
      startTransition(() => {
        setLoading(false);
        setError(null);
        if (resetOnDisableRef.current) {
          setData(null);
          dataRef.current = null;
        }
      });
      return;
    }

    let cancelled = false;
    let timeoutId: ReturnType<typeof setTimeout> | undefined;
    let ac: AbortController | null = null;
    let delayMs = pollRef.current?.intervalMs ?? 0;
    let isPoll = false;

    const clearTimer = () => {
      if (timeoutId != null) {
        clearTimeout(timeoutId);
        timeoutId = undefined;
      }
    };

    const schedule = (ms: number) => {
      clearTimer();
      if (cancelled || !pollRef.current) return;
      timeoutId = setTimeout(() => {
        isPoll = true;
        void run();
      }, ms);
    };

    const run = async () => {
      if (cancelled) return;

      const pollCfg = pollRef.current;
      if (
        isPoll &&
        pollCfg &&
        pollCfg.pauseWhenHidden !== false &&
        typeof document !== 'undefined' &&
        document.visibilityState === 'hidden'
      ) {
        schedule(pollCfg.intervalMs);
        return;
      }

      const seq = ++requestSeqRef.current;
      ac?.abort();
      ac = new AbortController();
      const clearBefore = !isPoll && clearDataBeforeFetchRef.current;
      const showLoading = dataRef.current == null || clearBefore;

      startTransition(() => {
        setError(null);
        if (clearBefore) {
          setData(null);
          dataRef.current = null;
        }
        if (showLoading) {
          setLoading(true);
        }
      });

      try {
        const json = await fetchRef.current(ac.signal);
        if (cancelled || seq !== requestSeqRef.current) return;
        dataRef.current = json;
        setData(json);
        setError(null);
        delayMs = pollCfg?.intervalMs ?? delayMs;
        if (pollCfg?.while(json)) {
          schedule(pollCfg.intervalMs);
        } else {
          clearTimer();
        }
      } catch (e) {
        if (cancelled || isAbortError(e) || seq !== requestSeqRef.current) return;
        setError(normalizeAsyncError(e));
        const cfg = pollRef.current;
        if (cfg) {
          const max = cfg.maxIntervalMs ?? 5 * 60_000;
          const base = cfg.intervalMs;
          delayMs = Math.min(max, Math.max(base, delayMs * 2 || base * 2));
          schedule(delayMs);
        }
      } finally {
        if (seq === requestSeqRef.current) {
          setLoading(false);
        }
      }
    };

    const onVisibility = () => {
      if (cancelled || typeof document === 'undefined') return;
      if (document.visibilityState !== 'visible') return;
      const cfg = pollRef.current;
      const latest = dataRef.current;
      if (!cfg || latest == null || !cfg.while(latest)) return;
      clearTimer();
      isPoll = true;
      void run();
    };

    isPoll = false;
    void run();

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', onVisibility);
    }

    return () => {
      cancelled = true;
      clearTimer();
      requestSeqRef.current += 1;
      ac?.abort();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', onVisibility);
      }
    };
    // `deps` is the caller’s full dependency list (same contract as `useEffect(fn, deps)`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps]);

  return { data, error, loading };
}
