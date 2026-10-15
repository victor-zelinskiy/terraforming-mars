/*
 * THE SCORE CELL'S NAMED CAUSE — one line per share the cell could not show
 * arriving (TR55, docs/claude/console/score-cell.md): «+1 ПО · Капитолий»,
 * «−3 ПО · Награда «Землевладелец»: место 1 → 2». Pure; every word goes
 * through the ONE reading renderer (PL-160) — never a hand-built template.
 */
import {VpSource} from '@/common/game/vpAttribution';
import {readingText} from '@/client/console/readingText';
import {VpReasonLine} from '@/client/console/scoreCell/vpShareLedger';

/** How many causes the cell names at once; the rest is «ещё N». */
export const VP_REASON_MAX_LINES = 2;

export type VpReasonView = {
  /** «+2» / «−3» — the sign of what happened, the true minus. */
  points: string;
  loss: boolean;
  /** WHAT moved the score, in the player's words. */
  label: string;
};

/** «1st» → «1» — the server's place words, read as a number (the ordinal suffix is the locale's business). */
function placeNumber(place: string | undefined): string | undefined {
  if (place === undefined) {
    return undefined;
  }
  const digit = /^(\d+)/.exec(place);
  return digit?.[1];
}

/** The cause's words. */
export function vpSourceLabel(source: VpSource): string {
  switch (source.kind) {
  case 'card':
    return readingText({label: source.card});
  case 'city':
    return readingText({label: 'Your city: adjacent greeneries'});
  case 'greenery':
    return readingText({label: 'Greenery tiles'});
  case 'milestone':
    return readingText({label: 'Milestone «${0}»', params: [readingText({label: source.name})]});
  case 'award': {
    const name = readingText({label: source.name});
    const was = placeNumber(source.place?.before);
    const now = placeNumber(source.place?.after);
    if (was !== undefined && now !== undefined) {
      return readingText({label: 'Award «${0}»: place ${1} → ${2}', params: [name, was, now]});
    }
    if (now !== undefined) {
      return readingText({label: 'Award «${0}»: place ${1}', params: [name, now]});
    }
    if (was !== undefined) {
      return readingText({label: 'Award «${0}»: place ${1} lost', params: [name, was]});
    }
    return readingText({label: 'Award «${0}»', params: [name]});
  }
  case 'rating':
    return readingText({label: 'Terraforming Rating'});
  case 'other':
    return source.key === 'Colony VP' ? readingText({label: 'Colony VP'}) : readingText({label: 'Victory points'});
  }
}

/** One line of the cell's named cause. */
export function vpReasonView(line: VpReasonLine): VpReasonView {
  const loss = line.points < 0;
  return {
    points: `${loss ? '−' : '+'}${Math.abs(line.points)}`,
    loss,
    label: vpSourceLabel(line.source),
  };
}

/** The lines the cell shows (at most `VP_REASON_MAX_LINES`) and how many more it does not. */
export function vpReasonViews(lines: ReadonlyArray<VpReasonLine>): {lines: Array<VpReasonView>, more: number} {
  return {
    lines: lines.slice(0, VP_REASON_MAX_LINES).map(vpReasonView),
    more: Math.max(0, lines.length - VP_REASON_MAX_LINES),
  };
}
