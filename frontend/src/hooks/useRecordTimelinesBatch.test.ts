import { renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRecordTimelinesBatch } from '../api/client';
import type { RecordTimelinesBatchResponse } from '../types/api.compat';
import { useRecordTimelinesBatch } from './useRecordTimelinesBatch';

vi.mock('../api/client', () => ({
  fetchRecordTimelinesBatch: vi.fn(),
}));

const mockBatch: RecordTimelinesBatchResponse = {
  season: 2026,
  timelines: [],
};

describe('useRecordTimelinesBatch', () => {
  beforeEach(() => {
    vi.mocked(fetchRecordTimelinesBatch).mockReset();
  });

  it('does not fetch when season is null or no positive team ids', () => {
    renderHook(() => useRecordTimelinesBatch([121], null));
    expect(fetchRecordTimelinesBatch).not.toHaveBeenCalled();

    renderHook(() => useRecordTimelinesBatch([], 2026));
    expect(fetchRecordTimelinesBatch).not.toHaveBeenCalled();
  });

  it('dedupes orderedIds while preserving order', async () => {
    vi.mocked(fetchRecordTimelinesBatch).mockResolvedValue(mockBatch);

    const { result } = renderHook(() => useRecordTimelinesBatch([121, 121, 144, 121], 2026));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.orderedIds).toEqual([121, 144]);
    expect(fetchRecordTimelinesBatch).toHaveBeenCalledWith(
      {
        teamIds: [121, 144],
        season: 2026,
      },
      expect.any(AbortSignal),
    );
  });

  it('surfaces errors', async () => {
    vi.mocked(fetchRecordTimelinesBatch).mockRejectedValue(new Error('batch failed'));

    const { result } = renderHook(() => useRecordTimelinesBatch([121], 2026));

    await waitFor(() => expect(result.current.error?.message).toBe('batch failed'));
  });
});
