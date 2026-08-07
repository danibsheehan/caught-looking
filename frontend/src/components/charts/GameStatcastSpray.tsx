import { useId, useMemo, useState } from 'react';
import {
  getFieldDimensionsForVenue,
  type FieldDimensionsFt,
} from '../../data/mlbVenueFieldDimensions';
import {
  buildSprayFenceGeometry,
  expandSprayOutfieldCornerFromHome,
} from '../../data/parkSprayOutline';
import type { StatcastBattedBall } from '../../types/api.compat';
import { useChartSurfaceHex } from '../../hooks/useChartSurfaceHex';
import { inningHalfBucket } from '../../utils/inningHalf';
import { gameStatcastHalfTeamFills } from '../../utils/gameChartColors';
import { chartA11yBattingSide, chartA11yFootnote, chartA11ySlice } from '../../utils/chartA11yRows';
import { buildSprayTooltipRows, type StatcastChartTooltipRow } from '../../utils/statcastDisplay';
import { statcastHcToFieldFeet } from '../../utils/statcastHitCoordinates';
import ChartDataTable from './ChartDataTable';
import StatcastMetricTooltipContent from './StatcastMetricTooltipContent';
import { STATCAST_SPRAY_DOT_R, statcastSprayDiamondPath } from '../../utils/statcastMarkerGeometry';

type SprayPoint = {
  /** Field-foot x (third → first), after Statcast grid → feet conversion. */
  hcX: number;
  /** Field-foot y (depth toward OF), after conversion. */
  hcY: number;
  rawHcX: number;
  rawHcY: number;
  playerName: string;
  events?: string;
  inningHalf?: string;
  launchSpeed?: number;
  launchAngle?: number;
};

type GameStatcastSprayProps = {
  battedBalls: StatcastBattedBall[];
  venueId?: number;
  venueName?: string;
  awayTeamId?: number;
  homeTeamId?: number;
};

/** ViewBox size (px); larger than v1 so the field reads bigger in the game panel. */
const W = 620;
const H = 548;
const PAD = { l: 40, r: 40, t: 22, b: 48 };
/** Inset inside the plot rect before fitting; keeps field art off the chart border. */
const PLOT_INSET_PX = 24;
/**
 * Even with isotropic scale, width-tied fits can use 100% of the plot width, so the fair wedge
 * (and infield) read flush to the sides. Cap how much horizontal span the data may occupy so
 * there is always visible margin (similar to Savant’s field diagrams).
 */
const MAX_FIELD_WIDTH_FRAC = 0.78;

function toSprayPoints(rows: StatcastBattedBall[]): SprayPoint[] {
  const out: SprayPoint[] = [];
  for (const r of rows) {
    if (r.hcX == null || r.hcY == null) continue;
    const { x, y } = statcastHcToFieldFeet(r.hcX, r.hcY);
    out.push({
      hcX: x,
      hcY: y,
      rawHcX: r.hcX,
      rawHcY: r.hcY,
      playerName: r.playerName,
      events: r.events,
      inningHalf: r.inningHalf,
      launchSpeed: r.launchSpeed ?? undefined,
      launchAngle: r.launchAngle ?? undefined,
    });
  }
  return out;
}

const EXTENT_PAD_X = 0.06;
const EXTENT_PAD_Y = 0.05;

function extentWithPadding(
  vals: number[],
  padRatio: number,
  fallback: [number, number],
): [number, number] {
  if (vals.length === 0) return fallback;
  let lo = Math.min(...vals);
  let hi = Math.max(...vals);
  if (lo === hi) {
    lo -= 1;
    hi += 1;
  }
  const span = hi - lo;
  const pad = Math.max(span * padRatio, 8);
  return [lo - pad, hi + pad];
}

function pathFromPoints(
  sx: (x: number) => number,
  sy: (y: number) => number,
  pts: [number, number][],
  close: boolean,
): string {
  if (pts.length === 0) return '';
  const [x0, y0] = pts[0];
  let d = `M ${sx(x0).toFixed(2)} ${sy(y0).toFixed(2)}`;
  for (let i = 1; i < pts.length; i++) {
    const [x, y] = pts[i];
    d += ` L ${sx(x).toFixed(2)} ${sy(y).toFixed(2)}`;
  }
  if (close) d += ' Z';
  return d;
}

export default function GameStatcastSpray({
  battedBalls,
  venueId,
  venueName,
  awayTeamId,
  homeTeamId,
}: GameStatcastSprayProps) {
  const surfaceHex = useChartSurfaceHex();
  const gid = useId();
  const [tip, setTip] = useState<{
    px: number;
    py: number;
    rows: StatcastChartTooltipRow[];
  } | null>(null);

  const points = useMemo(() => toSprayPoints(battedBalls), [battedBalls]);

  const fieldDims: FieldDimensionsFt = useMemo(
    () => getFieldDimensionsForVenue(venueId),
    [venueId],
  );

  const scaledField = useMemo(() => {
    const d = fieldDims;
    const fence = buildSprayFenceGeometry(d);
    return {
      fence,
      plate: fence.plate,
    };
  }, [fieldDims]);

  const { sx, sy, pxPerFt } = useMemo(() => {
    const { fence } = scaledField;
    const { home, lf, lcf, cf, rcf, rf } = fence;
    const ex = (p: [number, number]) => expandSprayOutfieldCornerFromHome(home, p);
    const outlineFlat: [number, number][] = [
      home,
      lf,
      lcf,
      cf,
      rcf,
      rf,
      ex(lf),
      ex(lcf),
      ex(cf),
      ex(rcf),
      ex(rf),
      ...fence.infieldGrass,
      ...fence.infieldDirtOuter,
      fence.moundCenter,
      ...scaledField.plate,
    ];
    const xs = [...outlineFlat.map((p) => p[0]), ...points.map((p) => p.hcX)];
    const ys = [...outlineFlat.map((p) => p[1]), ...points.map((p) => p.hcY)];
    const [x0, x1] = extentWithPadding(xs, EXTENT_PAD_X, [35, 215]);
    const [y0, y1] = extentWithPadding(ys, EXTENT_PAD_Y, [-28, 430]);
    const dataW = x1 - x0;
    const dataH = y1 - y0;
    const plotW = W - PAD.l - PAD.r;
    const plotH = H - PAD.t - PAD.b;
    const innerW = Math.max(1, plotW - 2 * PLOT_INSET_PX);
    const innerH = Math.max(1, plotH - 2 * PLOT_INSET_PX);
    // Same ft→px on both axes; also cap width usage so the infield is never edge-to-edge.
    const scale = Math.min(innerH / dataH, innerW / dataW, (MAX_FIELD_WIDTH_FRAC * innerW) / dataW);
    const drawW = dataW * scale;
    const drawH = dataH * scale;
    const originX = PAD.l + PLOT_INSET_PX + (innerW - drawW) / 2;
    const originY = PAD.t + PLOT_INSET_PX + (innerH - drawH) / 2;
    const [hx0] = scaledField.fence.home;
    const pxPerFt = Math.abs(originX + (hx0 + 1 - x0) * scale - (originX + (hx0 - x0) * scale));
    return {
      sx: (hx: number) => originX + (hx - x0) * scale,
      sy: (hy: number) => originY + (y1 - hy) * scale,
      pxPerFt,
    };
  }, [points, scaledField]);

  const {
    topHalf: topColor,
    bottomHalf: bottomColor,
    other: otherColor,
  } = useMemo(
    () => gameStatcastHalfTeamFills(awayTeamId, homeTeamId, surfaceHex),
    [awayTeamId, homeTeamId, surfaceHex],
  );

  /** Expanded outfield paint (beyond true fence); underlay so the bleed ring reads as non-play. */
  const fairGrassBeyondD = useMemo(() => {
    const { home, lf, lcf, cf, rcf, rf } = scaledField.fence;
    const [hx, hy] = home;
    const e = (p: [number, number]) => expandSprayOutfieldCornerFromHome(home, p);
    const lfE = e(lf);
    const lcfE = e(lcf);
    const cfE = e(cf);
    const rcfE = e(rcf);
    const rfE = e(rf);
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(lfE[0]).toFixed(2)} ${sy(lfE[1]).toFixed(2)} L ${sx(lcfE[0]).toFixed(2)} ${sy(lcfE[1]).toFixed(2)} L ${sx(cfE[0]).toFixed(2)} ${sy(cfE[1]).toFixed(2)} L ${sx(rcfE[0]).toFixed(2)} ${sy(rcfE[1]).toFixed(2)} L ${sx(rfE[0]).toFixed(2)} ${sy(rfE[1]).toFixed(2)} Z`;
  }, [sx, sy, scaledField]);

  /** Fair territory up to published fence (in play). */
  const fairGrassInnerD = useMemo(() => {
    const { home, lf, lcf, cf, rcf, rf } = scaledField.fence;
    const [hx, hy] = home;
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(lf[0]).toFixed(2)} ${sy(lf[1]).toFixed(2)} L ${sx(lcf[0]).toFixed(2)} ${sy(lcf[1]).toFixed(2)} L ${sx(cf[0]).toFixed(2)} ${sy(cf[1]).toFixed(2)} L ${sx(rcf[0]).toFixed(2)} ${sy(rcf[1]).toFixed(2)} L ${sx(rf[0]).toFixed(2)} ${sy(rf[1]).toFixed(2)} Z`;
  }, [sx, sy, scaledField]);

  /** Published fence chord at true LF–RF distances (stroke only). */
  const fairFenceChordD = useMemo(() => {
    const { lf, lcf, cf, rcf, rf } = scaledField.fence;
    return `M ${sx(lf[0]).toFixed(2)} ${sy(lf[1]).toFixed(2)} L ${sx(lcf[0]).toFixed(2)} ${sy(lcf[1]).toFixed(2)} L ${sx(cf[0]).toFixed(2)} ${sy(cf[1]).toFixed(2)} L ${sx(rcf[0]).toFixed(2)} ${sy(rcf[1]).toFixed(2)} L ${sx(rf[0]).toFixed(2)} ${sy(rf[1]).toFixed(2)}`;
  }, [sx, sy, scaledField]);

  const fenceLabels = useMemo(() => {
    const { fence } = scaledField;
    const { home, lf, lcf, cf, rcf, rf } = fence;
    const nudge = (p: [number, number]): [number, number] => {
      const dx = p[0] - home[0];
      const dy = p[1] - home[1];
      const len = Math.hypot(dx, dy);
      if (len < 1e-6) return p;
      const s = 11 / len;
      return [p[0] + dx * s, p[1] + dy * s];
    };
    return [
      { key: 'lf', text: `${fieldDims.lf}`, pt: nudge(lf) },
      { key: 'lcf', text: `${Math.round(fence.lcfFt)}`, pt: nudge(lcf) },
      { key: 'cf', text: `${fieldDims.cf}`, pt: nudge(cf) },
      { key: 'rcf', text: `${Math.round(fence.rcfFt)}`, pt: nudge(rcf) },
      { key: 'rf', text: `${fieldDims.rf}`, pt: nudge(rf) },
    ];
  }, [scaledField, fieldDims]);

  /** In-play fair grass gradient: plate → true CF. */
  const grassLinear = useMemo(() => {
    const { home, cf } = scaledField.fence;
    const [hx, hy] = home;
    const [cx, cy] = cf;
    return {
      x1: sx(hx),
      y1: sy(hy),
      x2: sx(cx),
      y2: sy(cy),
    };
  }, [sx, sy, scaledField]);

  /** Muted gradient for the band past the fence (visual bleed / beyond play). */
  const grassBeyondLinear = useMemo(() => {
    const { home, cf } = scaledField.fence;
    const [hx, hy] = home;
    const [cx, cy] = expandSprayOutfieldCornerFromHome(home, cf);
    return {
      x1: sx(hx),
      y1: sy(hy),
      x2: sx(cx),
      y2: sy(cy),
    };
  }, [sx, sy, scaledField]);

  const dirtPathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.fence.infieldDirtOuter, true),
    [sx, sy, scaledField.fence.infieldDirtOuter],
  );

  const infieldGrassPathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.fence.infieldGrass, true),
    [sx, sy, scaledField.fence.infieldGrass],
  );

  const uCfPlan = useMemo((): [number, number] => {
    const { home, cf } = scaledField.fence;
    const dx = cf[0] - home[0];
    const dy = cf[1] - home[1];
    const h = Math.hypot(dx, dy);
    if (h < 1e-9) return [0, 1];
    return [dx / h, dy / h];
  }, [scaledField.fence]);

  const moundRubberD = useMemo(() => {
    const m = scaledField.fence.moundCenter;
    const [ux, uy] = uCfPlan;
    const wx = -uy;
    const wy = ux;
    const half = 3.25;
    const a: [number, number] = [m[0] - wx * half, m[1] - wy * half];
    const b: [number, number] = [m[0] + wx * half, m[1] + wy * half];
    return `M ${sx(a[0]).toFixed(2)} ${sy(a[1]).toFixed(2)} L ${sx(b[0]).toFixed(2)} ${sy(b[1]).toFixed(2)}`;
  }, [sx, sy, scaledField.fence.moundCenter, uCfPlan]);
  const platePathD = useMemo(
    () => pathFromPoints(sx, sy, scaledField.plate, true),
    [sx, sy, scaledField.plate],
  );

  const foulLeftD = useMemo(() => {
    const [hx, hy] = scaledField.fence.home;
    const [lx, ly] = scaledField.fence.lf;
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(lx).toFixed(2)} ${sy(ly).toFixed(2)}`;
  }, [sx, sy, scaledField.fence]);

  const foulRightD = useMemo(() => {
    const [hx, hy] = scaledField.fence.home;
    const [rx, ry] = scaledField.fence.rf;
    return `M ${sx(hx).toFixed(2)} ${sy(hy).toFixed(2)} L ${sx(rx).toFixed(2)} ${sy(ry).toFixed(2)}`;
  }, [sx, sy, scaledField.fence]);

  if (!points.length) {
    return (
      <p className="text text--muted game-statcast-spray__empty">
        No field-location data for this game, so the spray chart cannot be shown.
      </p>
    );
  }

  const a11ySlice = chartA11ySlice(points);
  const a11yRows = a11ySlice.rows.map((p) => [
    p.playerName,
    p.events?.trim() || '—',
    chartA11yBattingSide(p.inningHalf),
    p.launchSpeed != null ? String(p.launchSpeed) : '—',
    p.launchAngle != null ? String(p.launchAngle) : '—',
  ]);

  return (
    <div className="game-statcast-spray">
      <p className="text text--muted text--small game-statcast-spray__caption">
        {venueName ? (
          <>
            Outline matches <strong>{venueName}</strong>&apos;s published left, center, and right
            field distances ({fieldDims.lf} / {fieldDims.cf} / {fieldDims.rf} ft); power alleys are
            approximate. Each marker is a batted ball — team colors for away (circles) vs home
            (diamonds), brightened for this dark field. Brighter green is fair territory inside the
            fence, duller green beyond the wall. Fouls and pop-ups behind the plate may sit outside
            the outline.
          </>
        ) : (
          <>
            Outline uses generic outfield distances (venue unknown). Each marker uses away/home team
            colors (circles vs diamonds). Brighter green is in play inside the fence, duller green
            beyond the wall. Fouls and unusual paths may sit outside the diagram.
          </>
        )}
      </p>
      <svg
        className="game-statcast-spray__svg"
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        height={H}
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={`${gid}-chart-bg`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--spray-chart-bg-a)" />
            <stop offset="100%" stopColor="var(--spray-chart-bg-b)" />
          </linearGradient>
          <linearGradient
            id={`${gid}-grass`}
            gradientUnits="userSpaceOnUse"
            x1={grassLinear.x1}
            y1={grassLinear.y1}
            x2={grassLinear.x2}
            y2={grassLinear.y2}
          >
            <stop offset="0%" stopColor="var(--spray-grass-a)" />
            <stop offset="52%" stopColor="var(--spray-grass-mid)" />
            <stop offset="100%" stopColor="var(--spray-grass-b)" />
          </linearGradient>
          <linearGradient
            id={`${gid}-grass-beyond`}
            gradientUnits="userSpaceOnUse"
            x1={grassBeyondLinear.x1}
            y1={grassBeyondLinear.y1}
            x2={grassBeyondLinear.x2}
            y2={grassBeyondLinear.y2}
          >
            <stop offset="0%" stopColor="var(--spray-grass-beyond-a)" />
            <stop offset="100%" stopColor="var(--spray-grass-beyond-b)" />
          </linearGradient>
          <linearGradient id={`${gid}-dirt`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--spray-dirt-a)" />
            <stop offset="100%" stopColor="var(--spray-dirt-b)" />
          </linearGradient>
        </defs>

        <rect width={W} height={H} fill={`url(#${gid}-chart-bg)`} rx={6} />

        <path d={fairGrassBeyondD} fill={`url(#${gid}-grass-beyond)`} stroke="none" />
        <path d={fairGrassInnerD} fill={`url(#${gid}-grass)`} stroke="none" />
        <path
          d={fairFenceChordD}
          fill="none"
          stroke="var(--spray-fence-line)"
          strokeWidth={1.1}
          strokeLinejoin="miter"
          strokeMiterlimit={2.2}
        />
        <path
          d={dirtPathD}
          fill={`url(#${gid}-dirt)`}
          stroke="var(--spray-dirt-line)"
          strokeWidth={0.85}
          strokeLinejoin="miter"
          strokeMiterlimit={2.2}
          opacity={0.94}
        />
        <path d={infieldGrassPathD} fill={`url(#${gid}-grass)`} stroke="none" opacity={0.98} />
        <circle
          cx={sx(scaledField.fence.moundCenter[0])}
          cy={sy(scaledField.fence.moundCenter[1])}
          r={6.25 * pxPerFt}
          fill="var(--spray-dirt-a)"
          stroke="var(--spray-dirt-line)"
          strokeWidth={0.9}
          opacity={0.96}
        />
        <path
          d={moundRubberD}
          fill="none"
          stroke="var(--spray-plate-line)"
          strokeWidth={1.1}
          strokeLinecap="round"
          opacity={0.9}
        />

        <path
          d={foulLeftD}
          fill="none"
          stroke="var(--spray-foul-line)"
          strokeWidth={1.35}
          strokeLinecap="round"
          opacity={0.95}
        />
        <path
          d={foulRightD}
          fill="none"
          stroke="var(--spray-foul-line)"
          strokeWidth={1.35}
          strokeLinecap="round"
          opacity={0.95}
        />

        <path
          d={platePathD}
          fill="var(--spray-plate)"
          stroke="var(--spray-plate-line)"
          strokeWidth={0.9}
          strokeLinejoin="round"
        />

        {fenceLabels.map(({ key, text, pt }) => (
          <text
            key={key}
            className="game-statcast-spray__fence-ft"
            x={sx(pt[0])}
            y={sy(pt[1])}
            textAnchor="middle"
            dominantBaseline="middle"
            fill="var(--spray-fence-label)"
            fontSize={8.5}
            fontWeight={500}
            style={{ pointerEvents: 'none' }}
            aria-hidden
          >
            {text}
          </text>
        ))}

        {points.map((p, i) => {
          let fill = otherColor;
          let half: 'top' | 'bottom' | 'other' = 'other';
          switch (inningHalfBucket(p.inningHalf)) {
            case 'top':
              fill = topColor;
              half = 'top';
              break;
            case 'bottom':
              fill = bottomColor;
              half = 'bottom';
              break;
            default:
              break;
          }
          const cx = sx(p.hcX);
          const cy = sy(p.hcY);
          const rows = buildSprayTooltipRows({
            playerName: p.playerName,
            fieldX: p.hcX,
            fieldY: p.hcY,
            launchSpeed: p.launchSpeed,
            launchAngle: p.launchAngle,
            events: p.events,
          });
          const r = STATCAST_SPRAY_DOT_R;
          const common = {
            fill,
            stroke: 'var(--spray-bip-ring)',
            strokeWidth: 1.5,
            style: { cursor: 'default' as const },
            onMouseEnter: () => setTip({ px: cx, py: cy, rows }),
            onMouseLeave: () => setTip(null),
          };
          return half === 'bottom' ? (
            <path
              key={`${p.rawHcX}-${p.rawHcY}-${i}`}
              d={statcastSprayDiamondPath(cx, cy, r)}
              {...common}
            />
          ) : (
            <circle key={`${p.rawHcX}-${p.rawHcY}-${i}`} cx={cx} cy={cy} r={r} {...common} />
          );
        })}

        <text
          x={W / 2}
          y={H - 12}
          textAnchor="middle"
          fill="var(--text)"
          fontSize={11}
          opacity={0.92}
        >
          Along the infield: third-base side ↔ first-base side · Up on this diagram = farther from
          home
        </text>
      </svg>

      <ChartDataTable
        caption={
          venueName
            ? `Spray chart of batted ball field locations at ${venueName}.`
            : 'Spray chart of batted ball field locations.'
        }
        columns={['Batter', 'Result', 'Side', 'Exit velo (mph)', 'Launch angle (°)']}
        rows={a11yRows}
        footnote={chartA11yFootnote('batted balls', a11ySlice)}
      />

      {tip ? (
        <div
          className="game-statcast-spray__tooltip statcast-metric-tooltip"
          style={{
            position: 'absolute',
            left: `${(tip.px / W) * 100}%`,
            top: `${(tip.py / H) * 100}%`,
            transform: 'translate(-50%, calc(-100% - 10px))',
          }}
        >
          <StatcastMetricTooltipContent rows={tip.rows} />
        </div>
      ) : null}

      <ul className="text text--muted text--small game-statcast-spray__legend" aria-hidden="true">
        <li>
          <span
            className="game-statcast-spray__swatch game-statcast-spray__swatch--circle"
            style={{ background: topColor }}
          />
          Away batting (circles)
        </li>
        <li>
          <span
            className="game-statcast-spray__swatch game-statcast-spray__swatch--diamond"
            style={{ background: bottomColor }}
          />
          Home batting (diamonds)
        </li>
      </ul>
    </div>
  );
}
