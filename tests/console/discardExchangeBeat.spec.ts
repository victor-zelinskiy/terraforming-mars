import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {Tag} from '@/common/cards/Tag';
import {PartyName} from '@/common/turmoil/PartyName';
import {discardExchangeRailKey, discardExchangeSpecs} from '@/client/console/parliament/discardExchangeBeat';
import {composesInCardComposer} from '@/client/console/consoleCardActions';

/*
 * «ОДИН ФРЕЙМВОРК» — a party discard's payout is a WAVE off the printed icon, never a panel computed as
 * `megacredits − mcBefore`: one token per paying printed tag, at the prompt's own rate. The views decide the rest.
 */
describe('discardExchangeBeat', () => {
  const REDS = {icon: 'megacredits', amount: 2, perTag: [Tag.PLANT, Tag.MICROBE, Tag.ANIMAL]};
  const tags: Partial<Record<string, ReadonlyArray<Tag>>> = {
    Trees: [Tag.PLANT],
    Tardigrades: [Tag.MICROBE],
    Livestock: [Tag.ANIMAL],
    'Space Elevator': [Tag.SPACE, Tag.BUILDING],
    'Ecology Experts': [Tag.PLANT, Tag.MICROBE],
  };
  const tagsOf = (card: CardName) => tags[card] ?? [];

  it('one token per paying printed tag, each the rate\'s amount — a card with two paying tags pays twice', () => {
    const specs = discardExchangeSpecs(['Trees', 'Ecology Experts'] as Array<CardName>, REDS, tagsOf);
    expect(specs).to.deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 2},
      {channel: 'stock', resource: 'megacredits', amount: 2},
    ]);
  });

  it('no paying tag, no token (the server names the skip); no per-tag rate, nothing to read', () => {
    expect(discardExchangeSpecs(['Space Elevator'] as Array<CardName>, REDS, tagsOf)).to.deep.eq([]);
    expect(discardExchangeSpecs(['Trees'] as Array<CardName>, {icon: 'megacredits', amount: 3}, tagsOf)).to.deep.eq([]);
  });

  it('the rail key is the source\'s; the one-framework set holds the Reds (С2)', () => {
    expect(discardExchangeRailKey('PARTY_Reds')).to.eq('discard-exchange:PARTY_Reds');
    expect(composesInCardComposer(PartyName.REDS, undefined)).is.true;
    expect(composesInCardComposer(PartyName.REDS, 'RDX_X'), 'a law is the law\'s, not the party\'s').is.false;
  });
});
