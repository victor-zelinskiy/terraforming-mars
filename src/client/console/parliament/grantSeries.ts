/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A SERIES OF GRANTS — ONE VISIT (P70 Colonial Envoys: «add 1 delegate per colony — you may add them to different
 * resolutions»). The political facade asks each delegate as its OWN grant of one, and every grant says which one it
 * is (`votePrompt.series {index, of}` — the server's marker, never the title). Each delegate is its own decision and
 * its own A, but the Parliament the player stands in does not fold and unfold between them: after the cube of
 * decision k has landed, the vote mode returns to its selection IN PLACE when the prompt standing now is decision
 * k + 1 of the same giver, and the crumb counts «ГОЛОСОВАНИЕ · k / N».
 *
 * A series is NOT P72's pair (a grant of N to ONE resolution, one decision whose cubes fly as one phrase): nothing
 * is glued here — the decisions stay separate, only the surface stands.
 */
import {GrantSeries, PlayerInputModel} from '@/common/models/PlayerInputModel';

/** The decision a grant was — its place in the series and WHO gave it (a card, a colony). */
export type GrantSeriesKey = {giver: string, series: GrantSeries};

/** The standing grant's place in its series — `undefined` for a lone grant or for anything that is not a grant. */
export function grantSeriesOf(wf: PlayerInputModel | undefined): GrantSeries | undefined {
  return wf?.type === 'party' && wf.votePrompt?.source === 'grant' ? wf.votePrompt.series : undefined;
}

/** The giver as the prompt names it (`choiceContext.source`) — a card by its name, a colony by its tile. */
function giverOf(wf: PlayerInputModel): string | undefined {
  const source = wf.choiceContext?.source;
  if (source === undefined) {
    return undefined;
  }
  if (source.kind === 'card') {
    return `card:${source.card}`;
  }
  if (source.kind === 'colony') {
    return `colony:${source.name}`;
  }
  return source.kind;
}

/** The series key of the standing grant — what the vote mode remembers at the press, past the prompt that said it. */
export function grantSeriesKeyOf(wf: PlayerInputModel | undefined): GrantSeriesKey | undefined {
  const series = grantSeriesOf(wf);
  const giver = wf === undefined ? undefined : giverOf(wf);
  return series === undefined || giver === undefined ? undefined : {giver, series};
}

/**
 * Does `next` CONTINUE the series whose decision `answered` was? The same giver, the same length, the NEXT index — a
 * re-asked decision (the same index) is not a continuation, and neither is another giver's grant or a lone one.
 */
export function grantContinuesSeries(answered: GrantSeriesKey | undefined, next: PlayerInputModel | undefined): boolean {
  const key = grantSeriesKeyOf(next);
  return answered !== undefined && key !== undefined && key.giver === answered.giver &&
    key.series.of === answered.series.of && key.series.index === answered.series.index + 1;
}

/**
 * The decision the crumb COUNTS: while a decision's cube is on its way (`answered` — the snapshot of the press) the
 * tail still names THAT decision, though the server already asks the next one; once the mode is back in its
 * selection, the standing prompt's. The tail only ever moves forward, and only when the next decision is shown.
 */
export function grantSeriesShown(answered: GrantSeriesKey | undefined, live: PlayerInputModel | undefined): GrantSeries | undefined {
  return answered?.series ?? grantSeriesOf(live);
}

/** «k / N» — the count beside the stage word (digits only: the stage word stays the glossary's own key). */
export function grantSeriesCountText(series: GrantSeries): string {
  return `${series.index} / ${series.of}`;
}
