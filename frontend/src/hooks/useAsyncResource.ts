import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type DependencyList,
} from 'react'

export function normalizeAsyncError(e: unknown): Error {
  return e instanceof Error ? e : new Error(String(e))
}

export type AsyncResourceResult<T> = {
  data: T | null
  error: Error | null
  loading: boolean
}

export type UseAsyncResourceInput<T> = {
  /** When false, no request runs; see `resetOnDisable` for `data` / `error` handling. */
  enabled?: boolean
  fetch: () => Promise<T>
  /**
   * When true (default), `loading` is true on first mount while enabled until the first request settles.
   * When false, `loading` is only true while a request is in flight.
   */
  initialPending?: boolean
  /**
   * When `enabled` becomes false: if true (default), clear `data` and `error`.
   * If false, keep the last successful `data` (matches prior early-return chart effects).
   */
  resetOnDisable?: boolean
  /**
   * When true, clear `data` at the start of each fetch (e.g. route param changed).
   * Default false so in-flight refetches can keep showing the previous payload.
   */
  clearDataBeforeFetch?: boolean
}

/**
 * Shared async API loading: cancellation, {@link normalizeAsyncError}, and
 * `startTransition` for loading/error resets (replaces ad hoc `setTimeout(0)` + setState).
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
  } = input

  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const resetOnDisableRef = useRef(resetOnDisable)
  resetOnDisableRef.current = resetOnDisable

  const clearDataBeforeFetchRef = useRef(clearDataBeforeFetch)
  clearDataBeforeFetchRef.current = clearDataBeforeFetch

  const active = enabled

  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<Error | null>(null)
  const [loading, setLoading] = useState(() => active && initialPending)

  useEffect(() => {
    if (!active) {
      startTransition(() => {
        setLoading(false)
        setError(null)
        if (resetOnDisableRef.current) {
          setData(null)
        }
      })
      return
    }

    let cancelled = false

    startTransition(() => {
      setLoading(true)
      setError(null)
      if (clearDataBeforeFetchRef.current) {
        setData(null)
      }
    })

    fetchRef.current()
      .then((json) => {
        if (!cancelled) setData(json)
      })
      .catch((e) => {
        if (!cancelled) setError(normalizeAsyncError(e))
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
    // `deps` is the caller’s full dependency list (same contract as `useEffect(fn, deps)`).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, ...deps])

  return { data, error, loading }
}
