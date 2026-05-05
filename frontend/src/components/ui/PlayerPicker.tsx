import { useEffect, useId, useState } from 'react';
import { fetchPlayersSearch } from '../../api/client';
import { isAbortError } from '../../hooks/useAsyncResource';
import type { PlayerSearchHit } from '../../types/api.compat';

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
  const [hits, setHits] = useState<PlayerSearchHit[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 2) {
      let c = false;
      const z = setTimeout(() => {
        if (!c) {
          setHits([]);
          setSearchError(null);
        }
      }, 0);
      return () => {
        c = true;
        clearTimeout(z);
      };
    }

    let cancelled = false;
    let searchAbort: AbortController | null = null;
    const timer = setTimeout(() => {
      if (cancelled) return;
      searchAbort = new AbortController();
      setSearching(true);
      setSearchError(null);
      fetchPlayersSearch({ names: t }, searchAbort.signal)
        .then((res) => {
          if (!cancelled) setHits(res.people ?? []);
        })
        .catch((e) => {
          if (cancelled || isAbortError(e)) return;
          setSearchError(e instanceof Error ? e.message : String(e));
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 320);

    return () => {
      cancelled = true;
      clearTimeout(timer);
      searchAbort?.abort();
    };
  }, [q]);

  return (
    <div className="player-picker">
      <span className="player-picker__label">{label}</span>
      {selected ? (
        <div className="player-picker__selected">
          <span className="player-picker__name">{selected.fullName}</span>
          <span className="player-picker__id muted small">ID {selected.id}</span>
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
          {searchError ? (
            <p className="error small" role="alert">
              {searchError}
            </p>
          ) : null}
          {searching ? <p className="muted small">Searching…</p> : null}
          {!searching && q.trim().length >= 2 && hits.length === 0 && !searchError ? (
            <p className="muted small">No matches.</p>
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
                      setHits([]);
                    }}
                  >
                    <span className="player-picker__hit-name">{p.fullName}</span>
                    <span className="muted small">
                      {p.position ? `${p.position}` : ''}
                      {p.primaryNumber ? ` · #${p.primaryNumber}` : ''}
                      {!p.active ? ' · inactive' : ''}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </>
      )}
    </div>
  );
}
