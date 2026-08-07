export type StandingsUrlState = {
  teamId: number | '';
  /** MLB division id when no focus team is set. */
  divisionId: number | '';
};

export const DEFAULT_STANDINGS_URL: StandingsUrlState = {
  teamId: '',
  divisionId: '',
};

function parsePositiveInt(raw: string | null): number | '' {
  if (raw == null || raw.trim() === '') return '';
  const n = Number(raw);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) return '';
  return n;
}

/**
 * Parse standings shareable filters. When `team` is set it wins and `division` is ignored
 * (the focused club implies its division).
 */
export function parseStandingsSearchParams(sp: URLSearchParams): StandingsUrlState {
  const teamId = parsePositiveInt(sp.get('team'));
  if (teamId !== '') {
    return { teamId, divisionId: '' };
  }
  return { teamId: '', divisionId: parsePositiveInt(sp.get('division')) };
}

export function buildStandingsSearchParams(
  state: StandingsUrlState,
  prev: URLSearchParams = new URLSearchParams(),
): URLSearchParams {
  const next = new URLSearchParams(prev);
  if (state.teamId !== '') {
    next.set('team', String(state.teamId));
    next.delete('division');
  } else {
    next.delete('team');
    if (state.divisionId === '') next.delete('division');
    else next.set('division', String(state.divisionId));
  }
  return next;
}

/** True when the query string already matches the normalized standings URL state. */
export function standingsSearchParamsNormalized(sp: URLSearchParams): boolean {
  const built = buildStandingsSearchParams(parseStandingsSearchParams(sp), sp);
  return sp.get('team') === built.get('team') && sp.get('division') === built.get('division');
}
