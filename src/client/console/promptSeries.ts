/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A CARD'S QUESTION PER TAG IS A SERIES, NEVER A REPEAT (PC04 Ecotec · ledger GS). One play asks the SAME question once
 * per unit — Ecotec and Viral Enhancers per bio tag, «1 plant or 1 microbe on ANY card» — and the server says which one
 * each is (`choiceContext.series {index, of}`, the grammar of P70's grant series — `parliament/grantSeries.ts` reads the
 * vote's). Read off that marker, never the title, never a count of equal prompts in a row:
 *  · the question's head counts «МЕТКА k / N» (`ConsolePromptHead` — in the place of the press's «РЕШЕНИЕ N», one count);
 *  · the live host stands ONE visit through it: after answer k the surface does not leave while the table tells that
 *    answer — it waits, inert, and the next question of the SAME series arrives in place (the host's prompt handoff);
 *  · the composer's rows of one series read as a group.
 * Pure: no Vue, no DOM, no i18n — tested under the server runner.
 */
import {GrantSeries, PlayerInputModel} from '@/common/models/PlayerInputModel';

/** The standing question's place in its series — `undefined` for a lone question. */
export function choiceSeriesOf(wf: PlayerInputModel | undefined): GrantSeries | undefined {
  const series = wf?.choiceContext?.series;
  return series !== undefined && series.of > 1 && series.index >= 1 && series.index <= series.of ? series : undefined;
}

/** The decision a series member was — its place and WHO asks it (the giver, by the prompt's own source). */
export type ChoiceSeriesKey = {giver: string, series: GrantSeries, promptId: number | undefined};

function giverOf(wf: PlayerInputModel): string | undefined {
  const source = wf.choiceContext?.source;
  if (source === undefined) {
    return undefined;
  }
  return source.kind === 'card' || source.kind === 'corporation' ? `${source.kind}:${source.card}` : undefined;
}

/** The series key of the standing question — what the host remembers at the answer, past the prompt that said it. */
export function choiceSeriesKeyOf(wf: PlayerInputModel | undefined): ChoiceSeriesKey | undefined {
  const series = choiceSeriesOf(wf);
  const giver = wf === undefined ? undefined : giverOf(wf);
  return series === undefined || giver === undefined ? undefined : {giver, series, promptId: wf?.promptId};
}

/**
 * Does `next` CONTINUE the series whose decision `answered` was? The same giver, the same length, the NEXT index — a
 * re-asked decision (the same index) is not a continuation, and neither is another giver's question or a lone one.
 */
export function choiceContinuesSeries(answered: ChoiceSeriesKey | undefined, next: PlayerInputModel | undefined): boolean {
  const key = choiceSeriesKeyOf(next);
  return answered !== undefined && key !== undefined && key.giver === answered.giver &&
    key.series.of === answered.series.of && key.series.index === answered.series.index + 1;
}

/**
 * IS THE VISIT STILL THE SERIES'? After answer k (`answered`, not the last) the host stands while the server's prompt
 * is that very question (the answer in flight) or the NEXT one of the series not yet admitted; anything else — another
 * question, the series' end, no prompt — ends the visit.
 */
export function seriesVisitStands(answered: ChoiceSeriesKey | undefined, live: PlayerInputModel | undefined): boolean {
  if (answered === undefined || answered.series.index >= answered.series.of || live === undefined) {
    return false;
  }
  if (answered.promptId !== undefined && live.promptId === answered.promptId) {
    return true;
  }
  return choiceContinuesSeries(answered, live);
}

/** The head's count — the i18n key and its params («Метка 2 / 3»). */
export function choiceSeriesCount(series: GrantSeries): {key: string, params: ReadonlyArray<string>} {
  return {key: 'Tag ${0} / ${1}', params: [String(series.index), String(series.of)]};
}
