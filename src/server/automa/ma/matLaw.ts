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
