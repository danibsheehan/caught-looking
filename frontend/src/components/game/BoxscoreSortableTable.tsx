import { useMemo, useState, type ReactNode } from 'react';

function sortedCopy<T>(rows: T[], dir: 'asc' | 'desc', valueOf: (row: T) => number | string): T[] {
  const out = [...rows];
  out.sort((a, b) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (typeof va === 'number' && typeof vb === 'number') {
      return dir === 'asc' ? va - vb : vb - va;
    }
    const sa = String(va ?? '');
    const sb = String(vb ?? '');
    const c = sa.localeCompare(sb, undefined, { sensitivity: 'base' });
    return dir === 'asc' ? c : -c;
  });
  return out;
}

type SortState = { key: string; dir: 'asc' | 'desc' } | null;

type SortThProps = {
  label: string;
  sortKey: string;
  activeKey: string | null;
  activeDir: 'asc' | 'desc';
  onSort: (k: string) => void;
};

function SortTh({ label, sortKey, activeKey, activeDir, onSort }: SortThProps) {
  const active = activeKey === sortKey;
  return (
    <th scope="col">
      <button type="button" className="game-boxscore__sort-btn" onClick={() => onSort(sortKey)}>
        {label}
        {active ? (activeDir === 'asc' ? ' ▲' : ' ▼') : ''}
      </button>
    </th>
  );
}

export type BoxscoreColumn<Row> = {
  label: string;
  /** Unique per table; also the sort toggle key. */
  sortKey: string;
  cell: (row: Row) => ReactNode;
  sortValue: (row: Row) => number | string;
};

/**
 * One box-score table (pitching or batting, for either team): sortable columns, desc → asc →
 * insertion-order cycle per header click (independent per table instance).
 */
export default function BoxscoreSortableTable<Row extends { playerId: number }>({
  columns,
  rows,
}: {
  columns: BoxscoreColumn<Row>[];
  rows: Row[];
}) {
  const [sort, setSort] = useState<SortState>(null);

  const sortedRows = useMemo(() => {
    if (!sort) return rows;
    const col = columns.find((c) => c.sortKey === sort.key);
    if (!col) return rows;
    return sortedCopy(rows, sort.dir, col.sortValue);
  }, [rows, sort, columns]);

  function toggleSort(key: string) {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: 'desc' };
      if (prev.dir === 'desc') return { key, dir: 'asc' };
      return null;
    });
  }

  return (
    <div className="game-boxscore__table-wrap">
      <table className="game-boxscore__table">
        <thead>
          <tr>
            {columns.map((col) => (
              <SortTh
                key={col.sortKey}
                label={col.label}
                sortKey={col.sortKey}
                activeKey={sort?.key ?? null}
                activeDir={sort?.dir ?? 'desc'}
                onSort={toggleSort}
              />
            ))}
          </tr>
        </thead>
        <tbody>
          {sortedRows.map((row) => (
            <tr key={row.playerId}>
              {columns.map((col) => (
                <td key={col.sortKey}>{col.cell(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
