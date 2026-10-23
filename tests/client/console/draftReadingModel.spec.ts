import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Tag} from '@/common/cards/Tag';
import {CardModel} from '@/common/models/CardModel';
import {ClientCard} from '@/common/cards/ClientCard';
import {draftBuyVerb, draftReadingOf, draftWalletOf} from '@/client/console/draft/draftReadingModel';

function model(name: CardName, extra: Partial<CardModel> = {}): CardModel {
  return {name, resources: undefined, calculatedCost: undefined, ...extra} as unknown as CardModel;
}
function client(extra: Partial<ClientCard>): ClientCard {
  return {name: 'x', tags: [], type: CardType.AUTOMATED, cost: 10, ...extra} as unknown as ClientCard;
}

describe('draftReadingModel — the packet showcase\'s reading (T10 · CE)', () => {
  it('the play cost is the server\'s; the printed one stands beside it only when a discount moved it', () => {
    expect(draftReadingOf(model(CardName.ALGAE), client({cost: 10})).cost).eq(10);
    expect(draftReadingOf(model(CardName.ALGAE), client({cost: 10})).printedCost).is.undefined;
    const discounted = draftReadingOf(model(CardName.ALGAE, {calculatedCost: 8}), client({cost: 10}));
    expect([discounted.cost, discounted.printedCost]).deep.eq([8, 10]);
  });

  it('an event wears the event tag (it is not in the printed tags), a printed tag list is kept in order', () => {
    expect(draftReadingOf(model(CardName.PUBLIC_CELEBRATIONS), client({type: CardType.EVENT, tags: []})).tags).deep.eq([Tag.EVENT]);
    expect(draftReadingOf(model(CardName.ASTEROID), client({type: CardType.EVENT, tags: [Tag.SPACE]})).tags).deep.eq([Tag.SPACE, Tag.EVENT]);
    expect(draftReadingOf(model(CardName.ALGAE), client({tags: [Tag.PLANT]})).tags).deep.eq([Tag.PLANT]);
  });

  it('VP: a number, «special» for a counted / bespoke rule, nothing for none or zero', () => {
    expect(draftReadingOf(model(CardName.PUBLIC_CELEBRATIONS), client({victoryPoints: 2})).vp).deep.eq({kind: 'number', value: 2});
    expect(draftReadingOf(model(CardName.ALGAE), client({victoryPoints: 'special'})).vp).deep.eq({kind: 'special'});
    expect(draftReadingOf(model(CardName.ALGAE), client({})).vp).is.undefined;
    expect(draftReadingOf(model(CardName.ALGAE), client({victoryPoints: 0})).vp).is.undefined;
  });

  it('the verdict speaks the hand\'s language — only printed requirements (money will change by the time it is played)', () => {
    const money = draftReadingOf(model(CardName.ALGAE, {unplayableReasons: [{type: 'megacredits', message: 'Need ${0} more M€', params: ['3']}]}), client({}));
    expect(money.availability, 'a money shortfall says nothing in the draft').is.undefined;
    const req = draftReadingOf(model(CardName.ALGAE, {unplayableReasons: [{type: 'globalParameter', message: 'Requires ${0}% oxygen', params: ['5'], requirement: true, requirementKey: 'req:Oxygen'}]}), client({}));
    expect(req.availability?.severity).eq('pending');
    const gone = draftReadingOf(model(CardName.ALGAE, {unplayableReasons: [{type: 'globalParameter', message: 'max', requirement: true, unattainable: true}]}), client({}));
    expect(gone.availability?.severity).eq('missed');
  });

  it('the wallet: N × price = −total · on hand → after, affordable by the server\'s numbers', () => {
    expect(draftWalletOf(2, 3, 40)).deep.eq({count: 2, perCard: 3, total: 6, onHand: 40, after: 34, affordable: true});
    expect(draftWalletOf(0, 3, 40)).deep.include({total: 0, after: 40, affordable: true});
    expect(draftWalletOf(4, 3, 10)).deep.include({total: 12, after: -2, affordable: false});
  });

  it('the purchase\'s verb counts what it buys — «Купить 0» when nothing is chosen', () => {
    expect(draftBuyVerb(0)).deep.eq({key: 'Buy ${0}', params: ['0']});
    expect(draftBuyVerb(2)).deep.eq({key: 'Buy ${0}', params: ['2']});
  });
});
