/**
 * Statcast Search CSV `hc_x` / `hc_y` are **not** raw field feet: they use MLB’s search-grid
 * coordinates (roughly 0–250 across the field; `hc_y` increases toward the backstop). The
 * community-standard mapping to plan-view feet aligned with our spray outline (plate at
 * {@link SPRAY_HOME} in `parkSprayOutline.ts`) is:
 * @see https://baseballsavant.mlb.com/csv-docs — raw columns
 * @see common plotting notes (e.g. pybaseball / baseball-field-viz): 2.5× scale, plate ~(125.42, 198.27)
 */
export const STATCAST_HC_X_PLATE = 125.42
export const STATCAST_HC_Y_PLATE = 198.27
export const STATCAST_HC_TO_FT = 2.5

/** Our diagram’s plate center in field-foot space (`SPRAY_HOME`). */
export const FIELD_PLATE_X = 125
export const FIELD_PLATE_Y = 4

/**
 * Maps Savant `hc_x` / `hc_y` into the same field-foot coordinate system as `buildSprayFenceGeometry`.
 */
export function statcastHcToFieldFeet(hcX: number, hcY: number): { x: number; y: number } {
  return {
    x: FIELD_PLATE_X + STATCAST_HC_TO_FT * (hcX - STATCAST_HC_X_PLATE),
    y: FIELD_PLATE_Y + STATCAST_HC_TO_FT * (STATCAST_HC_Y_PLATE - hcY),
  }
}
