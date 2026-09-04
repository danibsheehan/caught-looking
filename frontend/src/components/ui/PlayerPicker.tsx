import { useId, useState } from 'react';
import { fetchPlayersSearch } from '../../api/client';
import { useAsyncResource } from '../../hooks/useAsyncResource';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import type { PlayerSearchHit, PlayersSearchResponse } from '../../types/api.compat';

export type PlayerPick = { id: number; fullName: string };

type PlayerPickerProps = {
  label: string;
  selected: PlayerPick | null;
  onChange: (p: PlayerPick | null) => void;
  disabled?: boolean;
};

/** Search MLB players by name (via Go `/players/search`) and pick one row. */
export default function PlayerPicker({ label, selected, onChange, disabled }: PlayerPickerProps) {
  const baseId = useId();
  const inputId = `${baseId}-q`;
  const listId = `${baseId}-list`;

  const [q, setQ] = useState('');
  const trimmed = q.trim();
  const debouncedTrimmed = useDebouncedValue(q, 320).trim();
  // `showResults` uses the raw (non-debounced) query so shrinking below 2 chars clears the
  // list instantly; the fetch itself still waits on `debouncedTrimmed` to avoid spamming the API.
  const showResults = trimmed.length >= 2;
  const searchEnabled = showResults && debouncedTrimmed.length >= 2;

  const { data, error, loading } = useAsyncResource<PlayersSearchResponse>(
    {
      enabled: searchEnabled,
      initialPending: false,
      clearDataBeforeFetch: true,
      fetch: (signal) => fetchPlayersSearch({ names: debouncedTrimmed }, signal),
    },
    [searchEnabled, debouncedTrimmed],
  );

  const hits: PlayerSearchHit[] = showResults ? (data?.people ?? []) : [];
  const searchError = showResults ? (error?.message ?? null) : null;
  const searching = showResults && loading;

  return (
    <div className="player-picker">
      <span className="player-picker__label">{label}</span>
      {selected ? (
        <div className="player-picker__selected">
          <span className="player-picker__name">{selected.fullName}</span>
          <span className="text text--muted text--small player-picker__id">ID {selected.id}</span>
          <button
            type="button"
            className="player-picker__change"
            onClick={() => onChange(null)}
            disabled={disabled}
          >
            Change
          </button>
        </div>
      ) : (
        <>
          <input
            id={inputId}
            className="player-picker__input player-picker__input--wide"
            type="search"
            autoComplete="off"
            placeholder="Type last name or full name…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            disabled={disabled}
            aria-controls={listId}
            aria-autocomplete="list"
          />
          <div aria-live="polite" aria-atomic="true">
            {searchError ? (
              <p className="text text--error text--small" role="alert">
                {searchError}
              </p>
            ) : null}
            {searching ? <p className="text text--muted text--small">Searching…</p> : null}
            {!searching && q.trim().length >= 2 && hits.length === 0 && !searchError ? (
              <p className="text text--muted text--small">No matches.</p>
            ) : null}
            {hits.length > 0 ? (
              <ul id={listId} className="player-picker__results" role="listbox">
                {hits.map((p) => (
                  <li key={p.id} role="none">
                    <button
                      type="button"
                      className="player-picker__hit"
                      disabled={disabled}
                      onClick={() => {
                        onChange({ id: p.id, fullName: p.fullName });
                        setQ('');
                      }}
                    >
                      <span className="player-picker__hit-name">{p.fullName}</span>
                      <span className="text text--muted text--small">
                        {p.position ? `${p.position}` : ''}
                        {p.primaryNumber ? ` · #${p.primaryNumber}` : ''}
                        {!p.active ? ' · inactive' : ''}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}
