import { useEffect, useId, useState } from 'react'
import { fetchPlayersSearch } from '../../api/client.js'

/**
 * @typedef {{ id: number, fullName: string }} PlayerPick
 */

/**
 * Search MLB players by name (via Go `/players/search`) and pick one row.
 * @param {{
 *   label: string,
 *   selected: PlayerPick | null,
 *   onChange: (p: PlayerPick | null) => void,
 *   disabled?: boolean,
 * }} props
 */
export default function PlayerPicker({ label, selected, onChange, disabled }) {
  const baseId = useId()
  const inputId = `${baseId}-q`
  const listId = `${baseId}-list`

  const [q, setQ] = useState('')
  const [hits, setHits] = useState(
    /** @type {import('../../types/api').PlayerSearchHit[]} */ ([]),
  )
  const [searchError, setSearchError] = useState(
    /** @type {string | null} */ (null),
  )
  const [searching, setSearching] = useState(false)

  useEffect(() => {
    const t = q.trim()
    if (t.length < 2) {
      let c = false
      const z = setTimeout(() => {
        if (!c) {
          setHits([])
          setSearchError(null)
        }
      }, 0)
      return () => {
        c = true
        clearTimeout(z)
      }
    }

    let cancelled = false
    const timer = setTimeout(() => {
      setSearching(true)
      setSearchError(null)
      fetchPlayersSearch({ names: t })
        .then((res) => {
          if (!cancelled) setHits(res.people ?? [])
        })
        .catch((e) => {
          if (!cancelled)
            setSearchError(e instanceof Error ? e.message : String(e))
        })
        .finally(() => {
          if (!cancelled) setSearching(false)
        })
    }, 320)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [q])

  return (
    <div className="player-picker">
      <span className="field-label">{label}</span>
      {selected ? (
        <div className="player-picker-selected">
          <span className="player-picker-name">{selected.fullName}</span>
          <span className="player-picker-id muted small">ID {selected.id}</span>
          <button
            type="button"
            className="btn-text"
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
            className="field-input field-input-wide"
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
            <ul id={listId} className="player-picker-results" role="listbox">
              {hits.map((p) => (
                <li key={p.id} role="none">
                  <button
                    type="button"
                    className="player-picker-hit"
                    disabled={disabled}
                    onClick={() => {
                      onChange({ id: p.id, fullName: p.fullName })
                      setQ('')
                      setHits([])
                    }}
                  >
                    <span className="player-picker-hit-name">{p.fullName}</span>
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
  )
}
