import {MarsBotTrackRole, TrackAction, TrackDefinition} from '../../../common/automa/AutomaTypes';

/**
 * THE LAW OF THE SIX BOARDS — what every official MarsBot board shares (docs/claude/marsbot-fan-map-checklist.md §A),
 * as CHECKABLE invariants over a mat's seven Martian tracks. One module, read by the specs of the ten static boards
 * and by the random-set generator, which may only return a mat this function calls lawful.
 *
 * A list of violations, never a boolean — the generator's repairs, the report and a red spec all want to know WHICH
 * rule broke.
 */

/** The printed role order every board shares — what `tag_N` icons, «topmost if tied» and the Venus row lean on. */
export const MAT_ROLE_ORDER: ReadonlyArray<MarsBotTrackRole> = ['building', 'space', 'event', 'science', 'power', 'earth', 'bio'];

/** The TR printed on a track's LAST space (cell 18), per role — the pairs science / bio may swap together (Vastitas Nova). */
const END_TR: Record<string, ReadonlyArray<number>> = {
  building: [5], space: [6], event: [5], science: [7, 5], power: [8], earth: [7], bio: [6, 8],
};

/** The law's track: 19 cells (0–18). An EXTENDED track (Amazonis Planitia) is this body plus a late reserve. */
export const MAT_BODY_LENGTH = 19;

/** A track in the EXTENDED format — longer than the body, its `maxPosition` its own last cell. */
export function isExtendedTrack(track: TrackDefinition): boolean {
  return track.layout.length > MAT_BODY_LENGTH && track.maxPosition === track.layout.length - 1;
}

const bodies = new WeakMap<TrackDefinition, TrackDefinition>();

/**
 * The law's 19-cell BODY of a track — the track itself when it is not extended (the printed boards). ONE object per
 * printed track (memoized): the generator's assembly cache and its «replaced» report compare rows by IDENTITY.
 */
export function matBody(track: TrackDefinition): TrackDefinition {
  if (!isExtendedTrack(track)) {
    return track;
  }
  const cached = bodies.get(track);
  if (cached !== undefined) {
    return cached;
  }
  const {maxPosition: _max, ...rest} = track;
  const body: TrackDefinition = {...rest, layout: track.layout.slice(0, MAT_BODY_LENGTH)};
  bodies.set(track, body);
  return body;
}

/** The late reserve of an extended track (cells 19…), empty for a printed one. */
export function matTail(track: TrackDefinition): ReadonlyArray<TrackAction | undefined> {
  return isExtendedTrack(track) ? track.layout.slice(MAT_BODY_LENGTH) : [];
}

/**
 * THE LAW OF THE LATE RESERVE (Amazonis Planitia — docs/claude/amazonis-planitia-marsbot.md): every row's reserve has
 * the same length, no cell is empty, it opens with an «advance» (the push into the reserve) and ends on a TR of the
 * ends' pattern; it carries terraforming and TR only — never a milestone / award / token / colony cell (those belong
 * to the body, where the human's thresholds are); its totals stay in the designed bands.
 */
export function tailViolations(tracks: ReadonlyArray<TrackDefinition>): Array<string> {
  const violations: Array<string> = [];
  const tails = tracks.map(matTail);
  const length = tails[0]?.length ?? 0;
  if (length === 0) {
    return ['no reserve'];
  }
  const counts: Record<string, number> = {};
  let tr = 0;
  tails.forEach((tail, i) => {
    const role = tracks[i].role;
    if (tail.length !== length) {
      violations.push(`${role}: reserve of ${tail.length} cells (${length} on the first row)`);
    }
    if (tail[0] !== 'advance') {
      violations.push(`${role}: the reserve opens with ${tail[0]}`);
    }
    const end = tail[tail.length - 1];
    if (end === undefined || !/^tr[5-8]$/.test(end)) {
      violations.push(`${role}: the reserve ends on ${end}`);
    }
    tail.forEach((action, k) => {
      if (action === undefined) {
        violations.push(`${role}: reserve cell ${MAT_BODY_LENGTH + k} is empty`);
        return;
      }
      if (action === 'milestone' || action === 'award' || action.startsWith('colony') || isTokenCell(action) || action.startsWith('tag_')) {
        violations.push(`${role}: ${action} in the reserve`);
      }
      if (/^tr\d$/.test(action)) {
        tr += Number(action.substring(2));
        counts.tr = (counts.tr ?? 0) + 1;
      } else {
        counts[action] = (counts[action] ?? 0) + 1;
      }
    });
  });
  const bands: Array<[string, number, number]> = [
    ['ocean', 3, 5], ['greenery', 5, 7], ['city', 1, 3], ['temperature', 6, 8], ['temperature2', 1, 3], ['advance', 7, 9],
  ];
  for (const [key, min, max] of bands) {
    const n = counts[key] ?? 0;
    if (n < min || n > max) {
      violations.push(`reserve ${key} ${n} outside ${min}…${max}`);
    }
  }
  if (tr < 60 || tr > 80) {
    violations.push(`reserve ΣTR ${tr} outside 60…80`);
  }
  return violations;
}

export function isTokenCell(action: TrackAction | undefined): boolean {
  return action !== undefined && action.startsWith('token');
}

/**
 * Cell counts of one mat. Cells 1…18 of each track, plus the seven START cells (0) in `empty` — the checklist's §A
 * statistic («37–39 empty») counts the starts, and so does the law.
 */
export function matCounts(tracks: ReadonlyArray<TrackDefinition>): Record<string, number> {
  const counts: Record<string, number> = {empty: tracks.length};
  let tr = 0;
  for (const track of tracks) {
    for (let i = 1; i < track.layout.length; i++) {
      const action = track.layout[i];
      let key: string;
      if (action === undefined) {
        key = 'empty';
      } else if (/^tr\d$/.test(action)) {
        key = 'tr';
        tr += Number(action.substring(2));
      } else if (action.startsWith('tag_')) {
        key = 'tag';
      } else if (isTokenCell(action)) {
        key = 'token';
      } else {
        key = action;
      }
      counts[key] = (counts[key] ?? 0) + 1;
    }
  }
  counts.trSum = tr;
  return counts;
}

/**
 * Every rule of the law the mat breaks (empty = lawful). `tracks` = the seven Martian tracks in role order (the Venus
 * row is a separate board and is not part of the law).
 */
export function matViolations(tracks: ReadonlyArray<TrackDefinition>): Array<string> {
  // The EXTENDED format: the law judges the body, the reserve has a law of its own; a mix of formats is no mat.
  if (tracks.some(isExtendedTrack)) {
    if (!tracks.every(isExtendedTrack)) {
      return [`mixed formats: ${tracks.map((t) => `${t.role} ${t.layout.length}`).join(', ')}`];
    }
    return [...matViolations(tracks.map(matBody)), ...tailViolations(tracks)];
  }
  const violations: Array<string> = [];
  const roles = tracks.map((t) => t.role);
  if (roles.join(',') !== MAT_ROLE_ORDER.join(',')) {
    violations.push(`role order ${roles.join(',')}`);
    return violations;
  }
  for (const track of tracks) {
    if (track.layout.length !== 19) {
      violations.push(`${track.role}: ${track.layout.length} cells`);
    }
    if (track.layout[0] !== undefined) {
      violations.push(`${track.role}: cell 0 prints ${track.layout[0]}`);
    }
    const end = track.layout[18];
    const endTr = end !== undefined && /^tr\d$/.test(end) ? Number(end.substring(2)) : undefined;
    if (endTr === undefined || !END_TR[track.role].includes(endTr)) {
      violations.push(`${track.role}: ends on ${end}`);
    }
  }
  // Vastitas Nova's pair: science ends tr5 exactly when bio ends tr8 — the ends move WITH the permutation.
  const scienceEnd = tracks[3].layout[18];
  const bioEnd = tracks[6].layout[18];
  if ((scienceEnd === 'tr5') !== (bioEnd === 'tr8')) {
    violations.push(`science ends ${scienceEnd} but bio ends ${bioEnd}`);
  }
  const c = matCounts(tracks);
  const exact: Array<[string, number]> = [
    ['ocean', 10], ['temperature', 13], ['temperature2', 1], ['greenery', 15], ['city', 10], ['milestone', 4], ['award', 4],
  ];
  for (const [key, n] of exact) {
    if ((c[key] ?? 0) !== n) {
      violations.push(`${key} ${c[key] ?? 0} ≠ ${n}`);
    }
  }
  const advance = c.advance ?? 0;
  if (advance < 14 || advance > 16) {
    violations.push(`advance ${advance} outside 14…16`);
  }
  // The NAMED exception: a token cell (decision R8) and a «colony for 5 M€» cell (the A&M module's Pioneer /
  // Constructor cube in printed form — Amazonis prints three) may each take an empty cell's place.
  const exceptions = (c.token ?? 0) + (c.colony5 ?? 0);
  const empties = c.empty ?? 0;
  if (empties < 37 - exceptions || empties > 39) {
    violations.push(`empty ${empties} outside ${37 - exceptions}…39 (${exceptions} token / colony cells)`);
  }
  if (c.trSum < 78 || c.trSum > 84) {
    violations.push(`ΣTR ${c.trSum} outside 78…84`);
  }
  if ((c.tag ?? 0) > 3) {
    violations.push(`${c.tag} cross-track tag icons (> 3)`);
  }
  // The expansion icons: the v1.16 kind (one venus, one floater, two floater2) or Tharsis' old kind (venus ×2, venus2 ×2).
  const icons = [c.venus ?? 0, c.venus2 ?? 0, c.floater ?? 0, c.floater2 ?? 0].join(',');
  if (icons !== '1,0,1,2' && icons !== '2,2,0,0') {
    violations.push(`expansion icons venus/venus2/floater/floater2 = ${icons}`);
  }
  return violations;
}
