type ChartDataTableProps = {
  /** Accessible table caption (what the chart shows). */
  caption: string;
  columns: readonly string[];
  /** Cell values per row; length should match `columns`. */
  rows: readonly (readonly string[])[];
  /** e.g. "Showing 40 of 120 batted balls." */
  footnote?: string;
};

/**
 * Visually hidden data table for charts. Sighted users keep the graphic;
 * assistive tech gets a real table (or a capped/summary table for large sets).
 */
export default function ChartDataTable({ caption, columns, rows, footnote }: ChartDataTableProps) {
  if (rows.length === 0) {
    return null;
  }

  return (
    <div className="chart-data-table chart-data-table--visually-hidden">
      <table>
        <caption>{caption}</caption>
        <thead>
          <tr>
            {columns.map((col) => (
              <th key={col} scope="col">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {footnote ? <p className="chart-data-table__footnote">{footnote}</p> : null}
    </div>
  );
}
