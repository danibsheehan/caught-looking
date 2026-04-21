/**
 * Approximate outfield fence distances (feet) at LF line, CF, RF line for spray-chart scaling.
 * Sources: typical MLB / club published dimensions (rounded). Used only to scale the decorative
 * fair-territory outline per venue — hit dots use Savant grid coords converted to field feet in the chart.
 */
export type FieldDimensionsFt = {
  lf: number
  rf: number
  cf: number
}

/** League-average template reference (same as scaling baseline in parkSprayOutline.ts). */
export const DEFAULT_FIELD_DIMS: FieldDimensionsFt = { lf: 330, rf: 330, cf: 400 }

/** MLB Stats API venue id → published line distances (ft). */
export const VENUE_FIELD_DIMENSIONS_FT: Record<number, FieldDimensionsFt> = {
  15: { lf: 330, cf: 413, rf: 335 }, // Chase Field
  2529: { lf: 330, cf: 403, rf: 330 }, // Sutter Health Park (Athletics)
  4705: { lf: 335, cf: 400, rf: 325 }, // Truist Park
  2: { lf: 333, cf: 410, rf: 318 }, // Camden Yards
  3: { lf: 310, cf: 390, rf: 302 }, // Fenway (poles / CF — simplified)
  17: { lf: 355, cf: 400, rf: 353 }, // Wrigley
  4: { lf: 330, cf: 400, rf: 335 }, // Rate Field
  2602: { lf: 328, cf: 404, rf: 325 }, // GABP
  5: { lf: 325, cf: 405, rf: 325 }, // Progressive Field
  19: { lf: 347, cf: 415, rf: 350 }, // Coors Field
  2394: { lf: 345, cf: 420, rf: 330 }, // Comerica Park
  2392: { lf: 315, cf: 409, rf: 326 }, // Daikin Park (Houston)
  7: { lf: 330, cf: 410, rf: 330 }, // Kauffman
  1: { lf: 347, cf: 396, rf: 350 }, // Angel Stadium
  22: { lf: 330, cf: 395, rf: 330 }, // Dodger Stadium
  4169: { lf: 344, cf: 407, rf: 335 }, // loanDepot park
  32: { lf: 344, cf: 400, rf: 345 }, // American Family Field
  3312: { lf: 328, cf: 404, rf: 300 }, // Target Field
  3289: { lf: 335, cf: 408, rf: 330 }, // Citi Field
  3313: { lf: 318, cf: 408, rf: 314 }, // Yankee Stadium
  2681: { lf: 329, cf: 401, rf: 330 }, // Citizens Bank Park
  31: { lf: 325, cf: 399, rf: 320 }, // PNC Park
  2680: { lf: 336, cf: 396, rf: 322 }, // Petco Park
  2395: { lf: 339, cf: 399, rf: 309 }, // Oracle Park
  680: { lf: 331, cf: 405, rf: 326 }, // T-Mobile Park
  2889: { lf: 336, cf: 400, rf: 335 }, // Busch Stadium
  12: { lf: 315, cf: 404, rf: 322 }, // Tropicana Field
  5325: { lf: 329, cf: 407, rf: 326 }, // Globe Life Field
  14: { lf: 328, cf: 404, rf: 328 }, // Rogers Centre
  3309: { lf: 337, cf: 402, rf: 335 }, // Nationals Park
}

export function getFieldDimensionsForVenue(venueId: number | undefined): FieldDimensionsFt {
  if (venueId == null || venueId <= 0) return DEFAULT_FIELD_DIMS
  return VENUE_FIELD_DIMENSIONS_FT[venueId] ?? DEFAULT_FIELD_DIMS
}
