import {expect} from 'chai';
import {cardGrantCardOf, cardGrantOwedTo} from '../../src/client/console/cardGrantHost';
import {PlayerInputModel} from '../../src/common/models/PlayerInputModel';
import {CardName} from '../../src/common/cards/CardName';

/**
 * T03 · CF — a CARD's live delegate grant is a step of the play that raised it: read off the server's markers
 * (`votePrompt.source === 'grant'` + `choiceContext.source = {kind: 'card', card}`), never a title.
 */
function party(over: Partial<PlayerInputModel>): PlayerInputModel {
  return {type: 'party', title: 'Add 2 delegates to a resolution', buttonLabel: 'Add', ...over} as PlayerInputModel;
}

describe('cardGrantHost', () => {
  const grant = party({
    votePrompt: {source: 'grant', cost: 0, count: 2, printed: 2} as PlayerInputModel['votePrompt'],
    choiceContext: {source: {kind: 'card', card: CardName.CULTURAL_METROPOLIS}, mode: 'reward'} as PlayerInputModel['choiceContext'],
  });

  it('names the card that gives a live grant', () => {
    expect(cardGrantCardOf(grant)).eq(CardName.CULTURAL_METROPOLIS);
  });

  it('a colony\'s grant, the viewer\'s own vote and a chairman pick are not a card\'s grant', () => {
    expect(cardGrantCardOf(party({...grant, choiceContext: {source: {kind: 'colony', name: 'Venus'}, mode: 'reward'} as PlayerInputModel['choiceContext']}))).is.undefined;
    expect(cardGrantCardOf(party({...grant, votePrompt: {source: 'action', cost: 0, count: 1, printed: 1} as unknown as PlayerInputModel['votePrompt']}))).is.undefined;
    expect(cardGrantCardOf(party({}))).is.undefined;
    expect(cardGrantCardOf(undefined)).is.undefined;
  });

  it('is owed to the flow that carries the card, and only to it', () => {
    expect(cardGrantOwedTo(grant, ['', CardName.CULTURAL_METROPOLIS])).is.true;
    expect(cardGrantOwedTo(grant, [CardName.PR_OFFICE])).is.false;
    expect(cardGrantOwedTo(grant, [])).is.false;
  });
});
