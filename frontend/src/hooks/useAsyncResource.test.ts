import { renderHook, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useAsyncResource } from './useAsyncResource'

describe('useAsyncResource', () => {
  it('resolves data and clears loading', async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: true })

    const { result } = renderHook(() =>
      useAsyncResource({ fetch, initialPending: true }, []),
    )

    expect(result.current.loading).toBe(true)

    await waitFor(() => expect(result.current.loading).toBe(false))

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual({ ok: true })
    expect(result.current.error).toBeNull()
  })

  it('normalizes non-Error rejections', async () => {
    const fetch = vi.fn().mockRejectedValue('boom')

    const { result } = renderHook(() =>
      useAsyncResource({ fetch, initialPending: false }, []),
    )

    await waitFor(() => expect(result.current.error?.message).toBe('boom'))
    expect(result.current.data).toBeNull()
  })

  it('does not fetch when disabled', () => {
    const fetch = vi.fn().mockResolvedValue(1)

    const { result } = renderHook(() =>
      useAsyncResource({ enabled: false, fetch }, []),
    )

    expect(fetch).not.toHaveBeenCalled()
    expect(result.current.loading).toBe(false)
    expect(result.current.data).toBeNull()
  })

  it('keeps data when disabled if resetOnDisable is false', async () => {
    const fetch = vi.fn().mockResolvedValueOnce(42).mockResolvedValueOnce(99)

    const { result, rerender } = renderHook(
      ({ enabled }: { enabled: boolean }) =>
        useAsyncResource(
          { enabled, fetch, initialPending: false, resetOnDisable: false },
          [enabled],
        ),
      { initialProps: { enabled: true } },
    )

    await waitFor(() => expect(result.current.data).toBe(42))

    rerender({ enabled: false })

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.data).toBe(42)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

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
    )

    await waitFor(() => expect(result.current.data?.v).toBe(1))

    rerender({ key: 2 })

    await waitFor(() => expect(result.current.data?.v).toBe(2))
    expect(result.current.error).toBeNull()
  })

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
    )

    await waitFor(() => expect(result.current.data).toBe(1))

    rerender({ n: 2 })

    await waitFor(() => expect(result.current.data).toBe(2))
  })
})
