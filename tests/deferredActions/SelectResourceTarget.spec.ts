import {expect} from 'chai';
import {SelectResourceTarget} from '../../src/server/deferredActions/SelectResourceTarget';
import {AddResourcesToCard} from '../../src/server/deferredActions/AddResourcesToCard';
import {Priority} from '../../src/server/deferredActions/Priority';
import {SelectCard} from '../../src/server/inputs/SelectCard';
import {ICard} from '../../src/server/cards/ICard';
import {VectorComputations} from '../../src/server/cards/turmoilRedux/VectorComputations';
import {PoliticalScience} from '../../src/server/cards/turmoilRedux/PoliticalScience';
import {Tardigrades} from '../../src/server/cards/base/Tardigrades';
import {CardResource} from '../../src/common/CardResource';
import {CardName} from '../../src/common/cards/CardName';
import {cast} from '../../src/common/utils/utils';
import {testGame} from '../TestGame';
import {TestPlayer} from '../TestPlayer';

/**
 * «CHOOSE THE CARD — THE NUMBER COMES LATER» (Turmoil Redux TR21 Arboretum):
 * the target pick of a reward whose amount a later cell decides. It asks, it
 * remembers, it never adds and it never knows a number.
 */
describe('SelectResourceTarget', () => {
  let player: TestPlayer;
  // Any card can be the cause; the step is the class's, never one card's.
  const cause = {kind: 'card' as const, card: CardName.SUPREME_EXPERTISE};
  const basis = {per: 'adjacent-city' as const};

  beforeEach(() => {
    [/* game */, player] = testGame(2);
  });

  it('is asked at PLAY_CARD_RESOURCE_CHOICE — ahead of the tile its card places', () => {
    expect(new SelectResourceTarget(player, CardResource.DATA, cause, basis).priority).eq(Priority.PLAY_CARD_RESOURCE_CHOICE);
    expect(Priority.PLAY_CARD_RESOURCE_CHOICE).lessThan(Priority.DEFAULT);
  });

  it('its candidates are AddResourcesToCard\'s own — the holders of the resource, nobody else', () => {
    const vc = new VectorComputations();
    const ps = new PoliticalScience();
    player.playedCards.push(vc, new Tardigrades(), ps);
    const step = new SelectResourceTarget(player, CardResource.DATA, cause, basis);
    expect(step.getCards()).deep.eq(new AddResourcesToCard(player, CardResource.DATA).getCards());
    expect(step.getCards().map((c) => c.name)).deep.eq([vc.name, ps.name]);
  });

  it('a SINGLE holder is still asked (no auto-select), with the basis and no amount; the answer is remembered', () => {
    const vc = new VectorComputations();
    player.playedCards.push(vc);
    const step = new SelectResourceTarget(player, CardResource.DATA, cause, basis, 'Pick');
    let landed: ICard | undefined;
    step.andThen((card) => {
      landed = card;
    });
    const prompt = cast(step.execute(), SelectCard);
    expect(prompt.cards).deep.eq([vc]);
    expect(prompt.title).eq('Pick');
    expect(prompt.resourceGainPrompt).deep.eq({cardResource: 'data', amountBasis: basis});
    expect(prompt.choiceContext).deep.eq({source: cause, mode: 'reward'});
    expect(step.chosen).is.undefined;
    prompt.cb([vc]);
    expect(step.chosen).eq(vc);
    expect(landed).eq(vc);
    expect(vc.resourceCount, 'the pick adds nothing').eq(0);
  });

  it('no holder: nothing is asked, nothing is chosen, the continuation still runs', () => {
    const step = new SelectResourceTarget(player, CardResource.DATA, cause, basis);
    let called = false;
    step.andThen((card) => {
      called = true;
      expect(card).is.undefined;
    });
    expect(step.execute()).is.undefined;
    expect(called).is.true;
    expect(step.chosen).is.undefined;
    expect(step.previewSelectCard()).is.undefined;
  });

  it('the read-only twin is the live prompt\'s model', () => {
    player.playedCards.push(new VectorComputations(), new PoliticalScience());
    const step = new SelectResourceTarget(player, CardResource.DATA, cause, basis);
    const preview = step.previewSelectCard();
    const live = cast(step.execute(), SelectCard).toModel(player);
    expect(preview).deep.eq(live);
    expect(preview?.resourceGainPrompt?.amount).is.undefined;
  });
});
