import { useMemo, type CSSProperties } from 'react';
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ChartDataTable from './ChartDataTable';
import { obsidianTeamChartPairsRegistryPrimary } from '../../utils/mlbTeamColors';
import { chartCartesianTick } from '../../utils/rechartsAxis';

export type TeamWinRow = { abbrev: string; wins: number; teamId: number };

type TeamWinsBarChartProps = {
  data: TeamWinRow[];
  height?: number;
};

/** Vertical bar chart: wins by team abbreviation (standings slice). */
export default function TeamWinsBarChart({ data, height = 320 }: TeamWinsBarChartProps) {
  const surfaceHex = useChartSurfaceHex();
  const pairs = useMemo(
    () =>
      obsidianTeamChartPairsRegistryPrimary(
        data.map((r) => r.teamId),
        surfaceHex,
      ),
    [data, surfaceHex],
  );

  const labelColors = useMemo(() => pairs.map((p) => p.label), [pairs]);

  const a11yRows = useMemo(() => data.map((row) => [row.abbrev, String(row.wins)]), [data]);

  return (
    <div className="team-wins-bar chart-frame" style={{ width: '100%', minHeight: height }}>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart data={data} margin={{ top: 22, right: 10, left: 4, bottom: 30 }}>
            <CartesianGrid strokeDasharray="3 4" stroke="var(--chart-grid-faint)" />
            <XAxis
              dataKey="abbrev"
              tick={(props: Record<string, unknown>) => {
                const x = Number(props.x);
                const y = Number(props.y);
                const payload = props.payload as { value?: string };
                const index = props.index as number;
                const fill = labelColors[index] ?? '#c8d8e8';
                return (
                  <text
                    x={x}
                    y={y}
                    dy={14}
                    textAnchor="middle"
                    fill={fill}
                    fontSize={11}
                    fontFamily="var(--mono)"
                  >
                    {payload?.value}
                  </text>
                );
              }}
              axisLine={{ stroke: 'var(--chart-grid-faint)' }}
              tickLine={false}
              height={36}
            />
            <YAxis allowDecimals={false} tick={chartCartesianTick} />
            <Tooltip cursor={{ fill: 'var(--accent-bg)' }} content={TeamWinsTooltip} />
            <Bar dataKey="wins" radius={[4, 4, 0, 0]} name="Wins">
              {data.map((row, i) => (
                <Cell key={row.teamId} fill={pairs[i]?.ink ?? '#334155'} />
              ))}
              <LabelList
                dataKey="wins"
                position="top"
                content={(labelProps) => {
                  const p = labelProps as {
                    x?: number | string;
                    y?: number | string;
                    width?: number | string;
                    index?: number;
                    value?: number | string;
                  };
                  const x = Number(p.x ?? 0);
                  const y = Number(p.y ?? 0);
                  const width = Number(p.width ?? 0);
                  const index = p.index ?? 0;
                  const fill = labelColors[index] ?? '#c8d8e8';
                  return (
                    <text
                      x={x + width / 2}
                      y={y - 4}
                      textAnchor="middle"
                      fill={fill}
                      fontSize={10}
                      fontFamily="var(--mono)"
                    >
                      {p.value}
                    </text>
                  );
                }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ChartDataTable caption="Wins by team." columns={['Team', 'Wins']} rows={a11yRows} />
    </div>
  );
}

const tooltipBox: CSSProperties = {
  background: 'var(--bg)',
  border: '1px solid var(--border)',
  borderRadius: '0.35rem',
  padding: '0.45rem 0.6rem',
  fontSize: '0.82rem',
  boxShadow: 'var(--shadow)',
  color: 'var(--text-h)',
};

function TeamWinsTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: ReadonlyArray<{ payload?: unknown; value?: unknown }>;
}) {
  if (!active || !payload?.length) return null;
  const row = payload[0]?.payload as TeamWinRow | undefined;
  const wins = payload[0]?.value;
  if (!row) return null;
  return (
    <div style={tooltipBox}>
      <div style={{ fontWeight: 600 }}>{row.abbrev}</div>
      <div
        style={{
          marginTop: '0.2rem',
          color: 'var(--text)',
          fontFamily: 'var(--mono)',
        }}
      >
        Wins: {typeof wins === 'number' ? wins : typeof wins === 'string' ? wins : row.wins}
      </div>
    </div>
  );
}
