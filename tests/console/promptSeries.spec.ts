import {expect} from 'chai';
import {
  choiceContinuesSeries, choiceSeriesCount, choiceSeriesKeyOf, choiceSeriesOf, seriesVisitStands,
} from '../../src/client/console/promptSeries';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';

/**
 * PC04 · GS — A CARD'S QUESTION PER TAG IS A SERIES (`console/promptSeries.ts`): read off the server's
 * `choiceContext.series`, never the title; the visit stands on answer k while the server asks that very question or the
 * NEXT of the same series, and nothing else.
 */
function ask(index: number | undefined, of: number, promptId: number, card: CardName = CardName.ECOTEC): PlayerInputModel {
  return {
    type: 'or', title: 'Select one option', buttonLabel: 'Confirm', options: [], initialIdx: undefined, promptId,
    choiceContext: {source: {kind: 'corporation', card}, mode: 'effect-choice', ...(index !== undefined ? {series: {index, of}} : {})},
  } as unknown as PlayerInputModel;
}

describe('promptSeries — a question per tag is a series', () => {
  it('reads the server\'s place; a lone question, a malformed one and no prompt read none', () => {
    expect(choiceSeriesOf(ask(2, 3, 10))).deep.eq({index: 2, of: 3});
    expect(choiceSeriesOf(ask(undefined, 1, 10))).is.undefined;
    expect(choiceSeriesOf(ask(1, 1, 10))).is.undefined;
    expect(choiceSeriesOf(ask(4, 3, 10))).is.undefined;
    expect(choiceSeriesOf(undefined)).is.undefined;
  });

  it('the next of the same giver continues; the same index, another giver, another length do not', () => {
    const k1 = choiceSeriesKeyOf(ask(1, 3, 10));
    expect(choiceContinuesSeries(k1, ask(2, 3, 11))).is.true;
    expect(choiceContinuesSeries(k1, ask(1, 3, 11)), 're-asked').is.false;
    expect(choiceContinuesSeries(k1, ask(2, 3, 11, CardName.VIRAL_ENHANCERS)), 'another giver').is.false;
    expect(choiceContinuesSeries(k1, ask(2, 2, 11)), 'another length').is.false;
    expect(choiceContinuesSeries(k1, ask(undefined, 1, 11)), 'a lone question').is.false;
  });

  it('the visit stands on the answered question in flight and on the next one — never past the series\' end', () => {
    const k1 = choiceSeriesKeyOf(ask(1, 3, 10));
    expect(seriesVisitStands(k1, ask(1, 3, 10)), 'the answer in flight').is.true;
    expect(seriesVisitStands(k1, ask(2, 3, 11)), 'the next one').is.true;
    expect(seriesVisitStands(k1, ask(3, 3, 12)), 'a jump').is.false;
    expect(seriesVisitStands(k1, undefined), 'nothing asked').is.false;
    const last = choiceSeriesKeyOf(ask(3, 3, 12));
    expect(seriesVisitStands(last, ask(3, 3, 12)), 'the last answer stands nothing').is.false;
  });

  it('the head\'s count is ONE key with its params', () => {
    expect(choiceSeriesCount({index: 2, of: 3})).deep.eq({key: 'Tag ${0} / ${1}', params: ['2', '3']});
  });
});
