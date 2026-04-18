import { useMemo, useState } from 'react'

/**
 * MLB IP string to outs (e.g. 9.0 → 27, 0.1 → 1).
 * @param {string} ip
 */
function ipToOuts(ip) {
  const s = String(ip).trim()
  if (!s) return 0
  const [w, frac = '0'] = s.split('.')
  const whole = parseInt(w, 10) || 0
  const t = parseInt(frac, 10) || 0
  let extra = 0
  if (t === 1) extra = 1
  else if (t === 2) extra = 2
  return whole * 3 + extra
}

/**
 * @template T
 * @param {T[]} rows
 * @param {'asc' | 'desc'} dir
 * @param {(row: T) => number | string} valueOf
 */
function sortedCopy(rows, dir, valueOf) {
  const out = [...rows]
  out.sort((a, b) => {
    const va = valueOf(a)
    const vb = valueOf(b)
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va
    }
    const sa = String(va ?? '')
    const sb = String(vb ?? '')
    const c = sa.localeCompare(sb, undefined, { sensitivity: 'base' })
    return dir === 'asc' ? c : -c
  })
  return out
}

/**
 * @param {{ label: string, sortKey: string, activeKey: string | null, activeDir: 'asc' | 'desc', onSort: (k: string) => void }} props
 */
function SortTh({ label, sortKey, activeKey, activeDir, onSort }) {
  const active = activeKey === sortKey
  return (
    <th scope="col">
      <button
        type="button"
        className="box-sort-btn"
        onClick={() => onSort(sortKey)}
      >
        {label}
        {active ? (activeDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  )
}

/**
 * @param {import('../../types/api').TeamBoxSide} side
 */
function TeamTotalsCard({ side }) {
  const t = side.totals
  return (
    <div className="game-team-totals">
      <h3 className="game-team-name">{side.teamName}</h3>
      <dl className="game-totals-dl">
        <div>
          <dt>R</dt>
          <dd>{t.runs}</dd>
        </div>
        <div>
          <dt>H</dt>
          <dd>{t.hits}</dd>
        </div>
        <div>
          <dt>E</dt>
          <dd>{t.errors}</dd>
        </div>
        <div>
          <dt>LOB</dt>
          <dd>{t.leftOnBase ?? '—'}</dd>
        </div>
        <div>
          <dt>2B</dt>
          <dd>{t.doubles ?? '—'}</dd>
        </div>
        <div>
          <dt>3B</dt>
          <dd>{t.triples ?? '—'}</dd>
        </div>
        <div>
          <dt>HR</dt>
          <dd>{t.homeRuns ?? '—'}</dd>
        </div>
      </dl>
    </div>
  )
}

/**
 * @param {{ data: import('../../types/api').GameBoxscoreResponse }} props
 */
export default function GameBoxscorePanel({ data }) {
  const [batAway, setBatAway] = useState(
    /** @type {{ key: string, dir: 'asc' | 'desc' } | null} */ (null),
  )
  const [batHome, setBatHome] = useState(
    /** @type {{ key: string, dir: 'asc' | 'desc' } | null} */ (null),
  )
  const [pitAway, setPitAway] = useState(
    /** @type {{ key: string, dir: 'asc' | 'desc' } | null} */ (null),
  )
  const [pitHome, setPitHome] = useState(
    /** @type {{ key: string, dir: 'asc' | 'desc' } | null} */ (null),
  )

  const batAwayRows = useMemo(() => {
    if (!batAway) return data.away.batting
    const k = batAway.key
    return sortedCopy(data.away.batting, batAway.dir, (row) =>
      /** @type {Record<string, number | string>} */ (row)[k],
    )
  }, [data.away.batting, batAway])

  const batHomeRows = useMemo(() => {
    if (!batHome) return data.home.batting
    const k = batHome.key
    return sortedCopy(data.home.batting, batHome.dir, (row) =>
      /** @type {Record<string, number | string>} */ (row)[k],
    )
  }, [data.home.batting, batHome])

  const pitAwayRows = useMemo(() => {
    if (!pitAway) return data.away.pitching
    if (pitAway.key === 'ip') {
      return sortedCopy(data.away.pitching, pitAway.dir, (row) => ipToOuts(row.ip))
    }
    const k = pitAway.key
    return sortedCopy(data.away.pitching, pitAway.dir, (row) =>
      /** @type {Record<string, number | string>} */ (row)[k],
    )
  }, [data.away.pitching, pitAway])

  const pitHomeRows = useMemo(() => {
    if (!pitHome) return data.home.pitching
    if (pitHome.key === 'ip') {
      return sortedCopy(data.home.pitching, pitHome.dir, (row) => ipToOuts(row.ip))
    }
    const k = pitHome.key
    return sortedCopy(data.home.pitching, pitHome.dir, (row) =>
      /** @type {Record<string, number | string>} */ (row)[k],
    )
  }, [data.home.pitching, pitHome])

  /** @param {'awayBat' | 'homeBat' | 'awayPit' | 'homePit'} which @param {string} key */
  function toggleSort(which, key) {
    const map = {
      awayBat: [batAway, setBatAway],
      homeBat: [batHome, setBatHome],
      awayPit: [pitAway, setPitAway],
      homePit: [pitHome, setPitHome],
    }
    const [, set] = map[which]
    set((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' }
      if (prev.dir === 'desc') return { key, dir: 'asc' }
      return null
    })
  }

  return (
    <div className="game-boxscore-panel">
      <h2 className="game-boxscore-heading">Team totals</h2>
      <div className="game-totals-grid">
        <div className="panel game-totals-card">
          <TeamTotalsCard side={data.away} />
        </div>
        <div className="panel game-totals-card">
          <TeamTotalsCard side={data.home} />
        </div>
      </div>

      <h2 className="game-boxscore-heading">Pitching</h2>
      <div className="game-pitch-grid">
        <div className="panel">
          <h3 className="game-team-name">{data.away.teamName}</h3>
          <div className="box-table-wrap">
            <table className="game-data-table">
              <thead>
                <tr>
                  <SortTh
                    label="Pitcher"
                    sortKey="name"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="IP"
                    sortKey="ip"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="ER"
                    sortKey="er"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={pitAway?.key ?? null}
                    activeDir={pitAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayPit', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {pitAwayRows.map((p) => (
                  <tr key={p.playerId}>
                    <td>{p.name}</td>
                    <td>{p.ip}</td>
                    <td>{p.h}</td>
                    <td>{p.r}</td>
                    <td>{p.er}</td>
                    <td>{p.bb}</td>
                    <td>{p.so}</td>
                    <td>{p.hr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h3 className="game-team-name">{data.home.teamName}</h3>
          <div className="box-table-wrap">
            <table className="game-data-table">
              <thead>
                <tr>
                  <SortTh
                    label="Pitcher"
                    sortKey="name"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="IP"
                    sortKey="ip"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="ER"
                    sortKey="er"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={pitHome?.key ?? null}
                    activeDir={pitHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homePit', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {pitHomeRows.map((p) => (
                  <tr key={p.playerId}>
                    <td>{p.name}</td>
                    <td>{p.ip}</td>
                    <td>{p.h}</td>
                    <td>{p.r}</td>
                    <td>{p.er}</td>
                    <td>{p.bb}</td>
                    <td>{p.so}</td>
                    <td>{p.hr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <h2 className="game-boxscore-heading">Batting</h2>
      <div className="game-bat-grid">
        <div className="panel">
          <h3 className="game-team-name">{data.away.teamName}</h3>
          <div className="box-table-wrap">
            <table className="game-data-table">
              <thead>
                <tr>
                  <SortTh
                    label="Batter"
                    sortKey="name"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="Pos"
                    sortKey="pos"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="AB"
                    sortKey="ab"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="2B"
                    sortKey="doubles"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="3B"
                    sortKey="triples"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="RBI"
                    sortKey="rbi"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={batAway?.key ?? null}
                    activeDir={batAway?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('awayBat', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {batAwayRows.map((b) => (
                  <tr key={b.playerId}>
                    <td>{b.name}</td>
                    <td>{b.pos}</td>
                    <td>{b.ab}</td>
                    <td>{b.r}</td>
                    <td>{b.h}</td>
                    <td>{b.doubles}</td>
                    <td>{b.triples}</td>
                    <td>{b.hr}</td>
                    <td>{b.rbi}</td>
                    <td>{b.bb}</td>
                    <td>{b.so}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="panel">
          <h3 className="game-team-name">{data.home.teamName}</h3>
          <div className="box-table-wrap">
            <table className="game-data-table">
              <thead>
                <tr>
                  <SortTh
                    label="Batter"
                    sortKey="name"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="Pos"
                    sortKey="pos"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="AB"
                    sortKey="ab"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="R"
                    sortKey="r"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="H"
                    sortKey="h"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="2B"
                    sortKey="doubles"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="3B"
                    sortKey="triples"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="HR"
                    sortKey="hr"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="RBI"
                    sortKey="rbi"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="BB"
                    sortKey="bb"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                  <SortTh
                    label="SO"
                    sortKey="so"
                    activeKey={batHome?.key ?? null}
                    activeDir={batHome?.dir ?? 'desc'}
                    onSort={(k) => toggleSort('homeBat', k)}
                  />
                </tr>
              </thead>
              <tbody>
                {batHomeRows.map((b) => (
                  <tr key={b.playerId}>
                    <td>{b.name}</td>
                    <td>{b.pos}</td>
                    <td>{b.ab}</td>
                    <td>{b.r}</td>
                    <td>{b.h}</td>
                    <td>{b.doubles}</td>
                    <td>{b.triples}</td>
                    <td>{b.hr}</td>
                    <td>{b.rbi}</td>
                    <td>{b.bb}</td>
                    <td>{b.so}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
