import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {draftBuyVerb, draftReadingOf, draftWalletOf} from '@/client/console/draft/draftReadingModel';

function model(name: CardName, extra: Partial<CardModel> = {}): CardModel {
  return {name, resources: undefined, calculatedCost: undefined, ...extra} as unknown as CardModel;
}

describe('draftReadingModel — the packet showcase\'s reading (T10 · CE)', () => {
  it('the row never repeats the face: the reading is the name and the verdict, nothing the card already prints', () => {
    // Cost (already discounted on the face), tags, VP and its condition stand
    // on the card right above the row. The first cut listed them all here as
    // icon «facts» — the owner, 2026-10-23: «слишком много лишней инфы».
    const reading = draftReadingOf(model(CardName.ALGAE, {calculatedCost: 8}));
    expect(Object.keys(reading)).to.have.members(['name', 'availability']);
    expect(reading.name).eq(CardName.ALGAE);
  });

  it('the verdict speaks the hand\'s language — only printed requirements (money will change by the time it is played)', () => {
    const money = draftReadingOf(model(CardName.ALGAE, {unplayableReasons: [{type: 'megacredits', message: 'Need ${0} more M€', params: ['3']}]}));
    expect(money.availability, 'a money shortfall says nothing in the draft').is.undefined;
    const req = draftReadingOf(model(CardName.ALGAE, {unplayableReasons: [{type: 'globalParameter', message: 'Requires ${0}% oxygen', params: ['5'], requirement: true, requirementKey: 'req:Oxygen'}]}));
    expect(req.availability?.severity).eq('pending');
    const gone = draftReadingOf(model(CardName.ALGAE, {unplayableReasons: [{type: 'globalParameter', message: 'max', requirement: true, unattainable: true}]}));
    expect(gone.availability?.severity).eq('missed');
  });

  it('the wallet: N × price = −total · on hand → after, affordable by the server\'s numbers', () => {
    expect(draftWalletOf(2, 3, 40)).deep.eq({count: 2, perCard: 3, total: 6, onHand: 40, after: 34, affordable: true, priceHint: ''});
    expect(draftWalletOf(0, 3, 40)).deep.include({total: 0, after: 40, affordable: true});
    expect(draftWalletOf(4, 3, 10)).deep.include({total: 12, after: -2, affordable: false});
    // A non-default price carries who set it — the «× N»'s hint, never a line of its own.
    expect(draftWalletOf(4, 1, 10, 'Card purchase price: 1 M€ · TerraLabs Research')).deep.include({total: 4, after: 6, priceHint: 'Card purchase price: 1 M€ · TerraLabs Research'});
  });

  it('the purchase\'s verb counts what it buys — «Купить 0» when nothing is chosen', () => {
    expect(draftBuyVerb(0)).deep.eq({key: 'Buy ${0}', params: ['0']});
    expect(draftBuyVerb(2)).deep.eq({key: 'Buy ${0}', params: ['2']});
  });
});
