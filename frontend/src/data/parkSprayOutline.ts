import type { FieldDimensionsFt } from './mlbVenueFieldDimensions';
import { DEFAULT_FIELD_DIMS } from './mlbVenueFieldDimensions';

/**
 * Reference fair-territory template in field feet (same space as `statcastHcToFieldFeet`), matched to ~DEFAULT_FIELD_DIMS.
 */
export const SPRAY_HOME: [number, number] = [125, 4];
export const SPRAY_OF_CONTROL: [number, number] = [125, 402];

/** Standard 90 ft base paths; used directly in buildSprayFenceGeometry's 1B/2B/3B math. */
const BASE_PATH_FT = 90;
const SQRT2 = Math.SQRT2;

/** Regulation home plate (ft): 17" front edge, 8.5" sides from point, 12" slants (point → -u_cf). */
const PLATE_HALF_WIDTH_FT = 17 / 24;
const PLATE_TIP_BACK_FT = 8.5 / 12;
const PLATE_FRONT_AHEAD_FT = 8.5 / 12;
const PLATE_SLANT_FT = 12 / 12;

const REF = DEFAULT_FIELD_DIMS;
const HOME = SPRAY_HOME;

/**
 * Warps template coordinates so deeper / wider parks expand the decorative outline.
 * Hit scatter points use raw tracking coords; only the field art is scaled.
 */
export function scaleSprayOutlinePoint(
  xy: [number, number],
  dims: FieldDimensionsFt,
): [number, number] {
  const [x, y] = xy;
  const depthScale = dims.cf / REF.cf;
  const widthScale = (dims.lf + dims.rf) / 2 / ((REF.lf + REF.rf) / 2);
  const t = Math.min(1, Math.max(0, (y - HOME[1]) / 140));
  const w = 1 + (widthScale - 1) * t * 0.92;
  const d = 1 + (depthScale - 1) * t * 0.92;
  return [HOME[0] + (x - HOME[0]) * w, HOME[1] + (y - HOME[1]) * d];
}

/** Interpolates LCF/RCF depth from LF/CF/RF when only three fence distances are known. */
export const SPRAY_POWER_ALLEY_BLEND = 0.68;

function norm2(v: [number, number]): [number, number] {
  const h = Math.hypot(v[0], v[1]);
  if (h < 1e-9) return [0, 0];
  return [v[0] / h, v[1] / h];
}

function rotate2d(v: [number, number], rad: number): [number, number] {
  const c = Math.cos(rad);
  const s = Math.sin(rad);
  return [v[0] * c - v[1] * s, v[0] * s + v[1] * c];
}

/** Unit vector perpendicular to u_cf in the field plane (along the plate mouth). */
function widthAxisFromCf(uCf: [number, number]): [number, number] {
  return norm2([-uCf[1], uCf[0]]);
}

/**
 * Home plate pentagon: point toward catcher (-u_cf), 17" mouth toward pitcher (+u_cf).
 * `home` is the plate center (intersection of diagonals in plan view).
 */
export function buildHomePlateOutline(
  home: [number, number],
  uCf: [number, number],
): [number, number][] {
  const uW = widthAxisFromCf(uCf);
  const tip: [number, number] = [
    home[0] - PLATE_TIP_BACK_FT * uCf[0],
    home[1] - PLATE_TIP_BACK_FT * uCf[1],
  ];
  const frontL: [number, number] = [
    home[0] + PLATE_FRONT_AHEAD_FT * uCf[0] + PLATE_HALF_WIDTH_FT * uW[0],
    home[1] + PLATE_FRONT_AHEAD_FT * uCf[1] + PLATE_HALF_WIDTH_FT * uW[1],
  ];
  const frontR: [number, number] = [
    home[0] + PLATE_FRONT_AHEAD_FT * uCf[0] - PLATE_HALF_WIDTH_FT * uW[0],
    home[1] + PLATE_FRONT_AHEAD_FT * uCf[1] - PLATE_HALF_WIDTH_FT * uW[1],
  ];
  const dirL = norm2([frontL[0] - tip[0], frontL[1] - tip[1]]);
  const dirR = norm2([frontR[0] - tip[0], frontR[1] - tip[1]]);
  const innerL: [number, number] = [
    tip[0] + PLATE_SLANT_FT * dirL[0],
    tip[1] + PLATE_SLANT_FT * dirL[1],
  ];
  const innerR: [number, number] = [
    tip[0] + PLATE_SLANT_FT * dirR[0],
    tip[1] + PLATE_SLANT_FT * dirR[1],
  ];
  return [tip, innerL, frontL, frontR, innerR, tip];
}

export type SprayFenceGeometry = {
  home: [number, number];
  lf: [number, number];
  lcf: [number, number];
  cf: [number, number];
  rcf: [number, number];
  rf: [number, number];
  lcfFt: number;
  rcfFt: number;
  /** 90 ft bag positions (hc_x / hc_y, feet). */
  first: [number, number];
  second: [number, number];
  third: [number, number];
  /**
   * Inner infield grass (inset from bags toward diamond center), drawn on top of dirt.
   */
  infieldGrass: [number, number][];
  /** Skinned dirt: 90 ft base diamond (1B → 2B → 3B → plate); `infieldGrass` sits on top. */
  infieldDirtOuter: [number, number][];
  /** Pitching rubber / mound center (~60.5 ft from plate along u_cf). */
  moundCenter: [number, number];
  /** Home plate pentagon in field plane (point toward -u_cf). */
  plate: [number, number][];
};

/** Inset from diamond center toward each bag (inner grass polygon inside the dirt diamond). */
const INFIELD_GRASS_INSET = 0.64;
/** Regulation distance home → rubber along line to 2B (ft). */
const MOUND_FROM_HOME_FT = 60.5;

function buildInfieldArt(
  home: [number, number],
  first: [number, number],
  second: [number, number],
  third: [number, number],
  uCf: [number, number],
): {
  grass: [number, number][];
  dirtOuter: [number, number][];
  moundCenter: [number, number];
} {
  const cx = (home[0] + second[0]) / 2;
  const cy = (home[1] + second[1]) / 2;
  const t = INFIELD_GRASS_INSET;
  const grass: [number, number][] = [
    [cx + t * (first[0] - cx), cy + t * (first[1] - cy)],
    [cx + t * (second[0] - cx), cy + t * (second[1] - cy)],
    [cx + t * (third[0] - cx), cy + t * (third[1] - cy)],
    [cx + t * (home[0] - cx), cy + t * (home[1] - cy)],
  ];

  const dirtOuter: [number, number][] = [first, second, third, home];

  const moundCenter: [number, number] = [
    home[0] + MOUND_FROM_HOME_FT * uCf[0],
    home[1] + MOUND_FROM_HOME_FT * uCf[1],
  ];
  return { grass, dirtOuter, moundCenter };
}

/**
 * Five-vertex outfield (LF → LCF → CF → RCF → RF): straight chords, like a real park outline in
 * plan view. Foul poles sit on rays from home that are **perpendicular** (90° fair opening); CF
 * bearing comes from the scaled template; LF/RF are ±45° from CF in the plane. Corner distances
 * use published LF / CF / RF in feet (hc_x / hc_y treated as feet); alleys interpolated only.
 */
export function buildSprayFenceGeometry(dims: FieldDimensionsFt): SprayFenceGeometry {
  const home = scaleSprayOutlinePoint(SPRAY_HOME, dims);
  const cfTemplate = scaleSprayOutlinePoint(SPRAY_OF_CONTROL, dims);
  const uCf = norm2([cfTemplate[0] - home[0], cfTemplate[1] - home[1]]);

  const uLf = norm2(rotate2d(uCf, Math.PI / 4));
  const uRf = norm2(rotate2d(uCf, -Math.PI / 4));

  const uLcf = norm2([uLf[0] + uCf[0], uLf[1] + uCf[1]]);
  const uRcf = norm2([uCf[0] + uRf[0], uCf[1] + uRf[1]]);

  const lfD = Math.max(dims.lf, 1);
  const rfD = Math.max(dims.rf, 1);
  const cfD = Math.max(dims.cf, 1);
  const lcfFt = dims.lf + SPRAY_POWER_ALLEY_BLEND * (dims.cf - dims.lf);
  const rcfFt = dims.rf + SPRAY_POWER_ALLEY_BLEND * (dims.cf - dims.rf);

  const lf: [number, number] = [home[0] + lfD * uLf[0], home[1] + lfD * uLf[1]];
  const rf: [number, number] = [home[0] + rfD * uRf[0], home[1] + rfD * uRf[1]];
  const cf: [number, number] = [home[0] + cfD * uCf[0], home[1] + cfD * uCf[1]];
  const lcf: [number, number] = [home[0] + lcfFt * uLcf[0], home[1] + lcfFt * uLcf[1]];
  const rcf: [number, number] = [home[0] + rcfFt * uRcf[0], home[1] + rcfFt * uRcf[1]];

  // 1B / 3B sit on the ±45° rays from home (edges of the 90° fair wedge), not on the bisector of
  // (u_cf, u_rf) — that 22.5° error pinches the diamond and makes skinned dirt look too narrow.
  const first: [number, number] = [
    home[0] + BASE_PATH_FT * uRf[0],
    home[1] + BASE_PATH_FT * uRf[1],
  ];
  const third: [number, number] = [
    home[0] + BASE_PATH_FT * uLf[0],
    home[1] + BASE_PATH_FT * uLf[1],
  ];
  const second: [number, number] = [
    home[0] + BASE_PATH_FT * SQRT2 * uCf[0],
    home[1] + BASE_PATH_FT * SQRT2 * uCf[1],
  ];

  const {
    grass: infieldGrass,
    dirtOuter: infieldDirtOuter,
    moundCenter,
  } = buildInfieldArt(home, first, second, third, uCf);

  const plate = buildHomePlateOutline(home, uCf);

  return {
    home,
    lf,
    lcf,
    cf,
    rcf,
    rf,
    lcfFt,
    rcfFt,
    first,
    second,
    third,
    infieldGrass,
    infieldDirtOuter,
    moundCenter,
    plate,
  };
}

/**
 * Visual-only scale from home for outfield grass fill. Vertices sit slightly past published
 * LF / LCF / CF / RCF / RF so deep batted balls (often a few feet beyond the wall on HRs) still
 * land on the green turf graphic. Fence distance labels and the chord stroke use true distances.
 */
export const SPRAY_OUTFIELD_GRASS_BLEED = 1.12;

/** Push an outfield corner along its ray from home (same bearing, longer distance). */
export function expandSprayOutfieldCornerFromHome(
  home: [number, number],
  corner: [number, number],
  factor: number = SPRAY_OUTFIELD_GRASS_BLEED,
): [number, number] {
  return [home[0] + factor * (corner[0] - home[0]), home[1] + factor * (corner[1] - home[1])];
}
