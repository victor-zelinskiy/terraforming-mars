import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {
  grantContinuesSeries, grantSeriesCountText, grantSeriesKeyOf, grantSeriesOf, grantSeriesShown,
} from '@/client/console/parliament/grantSeries';

/**
 * P70 Colonial Envoys — A SERIES OF GRANTS IS ONE VISIT: the pure core the vote mode asks after a decision's cube has
 * landed («is the prompt standing now the NEXT decision of the same series?») and the crumb asks for its count.
 */
describe('grantSeries', () => {
  function grant(index: number | undefined, of: number, card: CardName = CardName.COLONIAL_ENVOYS): PlayerInputModel {
    return {
      type: 'party', title: 'Add 1 delegate to a resolution', buttonLabel: 'Add', parties: [],
      votePrompt: {source: 'grant', cost: 0, count: 1, printed: 1, ...(index === undefined ? {} : {series: {index, of}})},
      choiceContext: {source: {kind: 'card', card}, mode: 'reward'},
    } as unknown as PlayerInputModel;
  }

  it('reads the server marker off a grant — never off anything else', () => {
    expect(grantSeriesOf(grant(2, 3))).deep.eq({index: 2, of: 3});
    expect(grantSeriesOf(grant(undefined, 1)), 'a lone grant').is.undefined;
    const vote = {...grant(1, 3), votePrompt: {source: 'reserve', cost: 0, series: {index: 1, of: 3}}} as unknown as PlayerInputModel;
    expect(grantSeriesOf(vote), 'the action\'s vote is no grant').is.undefined;
    expect(grantSeriesOf(undefined)).is.undefined;
  });

  it('the next decision of the same giver continues the series', () => {
    expect(grantContinuesSeries(grantSeriesKeyOf(grant(1, 3)), grant(2, 3))).is.true;
    expect(grantContinuesSeries(grantSeriesKeyOf(grant(2, 3)), grant(3, 3))).is.true;
  });

  it('…and nothing else does: the same decision re-asked, a skipped index, another giver, another length, a lone grant, no prompt', () => {
    const answered = grantSeriesKeyOf(grant(1, 3));
    expect(grantContinuesSeries(answered, grant(1, 3)), 're-asked').is.false;
    expect(grantContinuesSeries(answered, grant(3, 3)), 'skipped').is.false;
    expect(grantContinuesSeries(answered, grant(2, 3, CardName.RISE_TO_POWER)), 'another giver').is.false;
    expect(grantContinuesSeries(answered, grant(2, 4)), 'another length').is.false;
    expect(grantContinuesSeries(answered, grant(undefined, 1)), 'a lone grant').is.false;
    expect(grantContinuesSeries(answered, undefined), 'nothing asked — the series is over').is.false;
    expect(grantContinuesSeries(undefined, grant(2, 3)), 'no decision answered').is.false;
  });

  it('the crumb counts the decision ON ITS WAY first, the standing one after — it only moves forward', () => {
    expect(grantSeriesShown(grantSeriesKeyOf(grant(1, 3)), grant(2, 3)), 'cube 1 still flying').deep.eq({index: 1, of: 3});
    expect(grantSeriesShown(undefined, grant(2, 3)), 'back in the selection').deep.eq({index: 2, of: 3});
    expect(grantSeriesShown(undefined, grant(undefined, 1))).is.undefined;
    expect(grantSeriesCountText({index: 2, of: 3})).eq('2 / 3');
  });
});
