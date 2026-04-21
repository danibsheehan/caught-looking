import { FIELD_PLATE_X, FIELD_PLATE_Y } from './statcastHitCoordinates'

/** Plain-language hint for where the ball landed on the spray diagram (left–right from home). */
export function lateralTowardBases(fieldX: number, plateX = FIELD_PLATE_X): string {
  const delta = fieldX - plateX
  if (delta > 45) return 'toward the first-base side of the field'
  if (delta < -45) return 'toward the third-base side of the field'
  if (Math.abs(delta) <= 18) return 'up the middle of the field'
  return delta > 0 ? 'a bit toward first base' : 'a bit toward third base'
}

/** Straight-line distance on the 2D field map from home plate (approximate). */
export function mapDistanceFromHomeFt(fieldX: number, fieldY: number): number {
  return Math.round(Math.hypot(fieldX - FIELD_PLATE_X, fieldY - FIELD_PLATE_Y))
}

export function sprayPositionSummary(fieldX: number, fieldY: number): string {
  const ft = mapDistanceFromHomeFt(fieldX, fieldY)
  const lateral = lateralTowardBases(fieldX)
  return `About ${ft} ft from home on this chart · ${lateral}`
}

/** Turn Savant `events` snake_case into a short, readable label. */
export function formatStatcastEvent(raw?: string): string | undefined {
  if (!raw?.trim()) return undefined
  const s = raw.trim().toLowerCase()
  const map: Record<string, string> = {
    home_run: 'Home run',
    single: 'Single',
    double: 'Double',
    triple: 'Triple',
    field_out: 'Out',
    force_out: 'Force out',
    grounded_into_double_play: 'Ground into double play',
    sac_fly: 'Sacrifice fly',
    sac_bunt: 'Sacrifice bunt',
    fielders_choice: "Fielder's choice",
    hit_by_pitch: 'Hit by pitch',
    walk: 'Walk',
    intent_walk: 'Intentional walk',
    strikeout: 'Strikeout',
    strikeout_double_play: 'Strikeout (double play)',
  }
  if (map[s]) return map[s]
  return s
    .split('_')
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

export type StatcastChartTooltipRow =
  | { variant: 'title'; text: string }
  | { variant: 'step'; step: 1 | 2 | 3 | 4; title: string; body: string }

function formatVelocityBody(mph: number | undefined): string {
  if (mph == null || Number.isNaN(mph)) return '—'
  return `${mph.toFixed(1)} mph`
}

function formatAngleBody(deg: number | undefined): string {
  if (deg == null || Number.isNaN(deg)) return '—'
  return `${deg.toFixed(0)}°`
}

/** Spray chart: distance on map, then tracking metrics, then play result. */
export function buildSprayTooltipRows(p: {
  playerName: string
  fieldX: number
  fieldY: number
  launchSpeed?: number
  launchAngle?: number
  events?: string
}): StatcastChartTooltipRow[] {
  return [
    { variant: 'title', text: p.playerName },
    {
      variant: 'step',
      step: 1,
      title: 'Distance',
      body: `${mapDistanceFromHomeFt(p.fieldX, p.fieldY)} ft`,
    },
    { variant: 'step', step: 2, title: 'Velocity', body: formatVelocityBody(p.launchSpeed) },
    { variant: 'step', step: 3, title: 'Angle', body: formatAngleBody(p.launchAngle) },
    {
      variant: 'step',
      step: 4,
      title: 'Result',
      body: formatStatcastEvent(p.events) ?? '—',
    },
  ]
}

/** Pitch location (strike zone) chart: pitch type as title, velocity only. */
export function buildPitchZoneTooltipRows(p: {
  pitchName?: string
  pitchType?: string
  releaseSpeed?: number | null
}): StatcastChartTooltipRow[] {
  const name = p.pitchName?.trim()
  const pt = p.pitchType?.trim().toUpperCase()
  let title: string
  if (name && pt && name.toUpperCase() !== pt) {
    title = `${name} (${pt})`
  } else if (name) {
    title = name
  } else if (pt) {
    title = pt
  } else {
    title = 'Unknown'
  }
  return [
    { variant: 'title', text: title },
    {
      variant: 'step',
      step: 1,
      title: 'Velocity',
      body: formatVelocityBody(p.releaseSpeed ?? undefined),
    },
  ]
}

/** Launch-angle scatter: no field position — point users to the spray chart on the same page. */
export function buildScatterTooltipRows(p: {
  playerName: string
  launchSpeed: number
  launchAngle: number
  events?: string
}): StatcastChartTooltipRow[] {
  return [
    { variant: 'title', text: p.playerName },
    {
      variant: 'step',
      step: 1,
      title: 'On the field',
      body: 'Where the ball went is shown on the spray chart above.',
    },
    { variant: 'step', step: 2, title: 'Velocity', body: formatVelocityBody(p.launchSpeed) },
    { variant: 'step', step: 3, title: 'Angle', body: formatAngleBody(p.launchAngle) },
    {
      variant: 'step',
      step: 4,
      title: 'Result',
      body: formatStatcastEvent(p.events) ?? '—',
    },
  ]
}
