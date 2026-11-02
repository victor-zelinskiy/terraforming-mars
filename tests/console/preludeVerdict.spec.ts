import {expect} from 'chai';
import {initialVerdictFocus, PRELUDE_PRICE_TARGET_SELECTOR, preludePriceBill, preludePriceCapsuleSelector, preludeVerdictOf, preludeVerdictRows, stepVerdictFocus} from '@/client/console/deckPick/preludeVerdict';
import {DeckPickPromptMeta} from '@/common/models/PlayerInputModel';
import {CardResource} from '@/common/CardResource';
import {CardName} from '@/common/cards/CardName';

/*
 * P45 Board of Directors · ledger ET — THE VERDICT AFTER THE REVEAL: one drawn prelude, two outcome rows, read off the
 * server's marker (`price`, `min 0`, `max`), never a title.
 */
describe('preludeVerdict', () => {
  const price = {
    megacredits: 12,
    resourcesHere: {card: CardName.BOARD_OF_DIRECTORS, resource: CardResource.DIRECTOR, count: 1, have: 4},
    affordable: true,
  };
  const meta = (over: Partial<DeckPickPromptMeta>): DeckPickPromptMeta =>
    ({revealed: 1, min: 0, max: 1, origin: 'prelude', mode: 'play', price, ...over} as DeckPickPromptMeta);

  it('the grammar is on only for a PLAY pick with a price and min 0 — P91 and the keep family keep theirs', () => {
    expect(preludeVerdictOf(meta({}))).deep.eq(price);
    expect(preludeVerdictOf(meta({price: undefined})), 'P91 WG Project').is.undefined;
    expect(preludeVerdictOf(meta({min: 1})), 'a forced pick is not a verdict').is.undefined;
    expect(preludeVerdictOf(meta({mode: 'keep'}))).is.undefined;
    expect(preludeVerdictOf(undefined)).is.undefined;
  });

  it('affordable: the play row carries M€ and directors current → resulting; the discard row changes nothing', () => {
    const rows = preludeVerdictRows(price, {megacredits: 40, max: 1, burns: false});
    expect(rows.map((r) => r.key)).deep.eq(['play', 'discard']);
    expect(rows[0].available).is.true;
    expect(rows[0].chips).deep.eq([
      {kind: 'megacredits', from: 40, to: 28},
      {kind: 'card-resource', resource: CardResource.DIRECTOR, from: 4, to: 3},
    ]);
    expect(rows[1].chips).deep.eq([]);
    expect(rows[1].sole).is.false;
    expect(initialVerdictFocus(rows), 'the cursor opens on the play').eq(0);
  });

  it('a burn is honest: −12 and +15 on one chip, the label says it burns', () => {
    const rows = preludeVerdictRows(price, {megacredits: 40, max: 1, burns: true});
    expect(rows[0].burns).is.true;
    expect(rows[0].label).eq('Play: it burns');
    expect(rows[0].chips[0]).deep.eq({kind: 'megacredits', from: 40, to: 43});
  });

  it('max 0: the play is REFUSED with its magnitude, the discard is the sole outcome — marked, not auto-answered', () => {
    const rows = preludeVerdictRows({...price, affordable: false, deficit: 5}, {megacredits: 7, max: 0, burns: false});
    expect(rows[0].available).is.false;
    expect(rows[0].reason).deep.eq({key: 'Need ${0} more M€', params: ['5']});
    expect(rows[0].chips, 'a refused row promises nothing').deep.eq([]);
    expect(rows[1].sole).is.true;
    expect(rows[1].available).is.true;
    expect(initialVerdictFocus(rows), 'the cursor opens on the one outcome there is').eq(1);
  });

  it('the PRICE leaves first as the hero’s bill: one M€ token of 12, the prelude’s own stock gains its known moves', () => {
    const bill = preludePriceBill(price, [
      {channel: 'stock', resource: 'megacredits', amount: 30},
      {channel: 'production', resource: 'megacredits', amount: 2, direction: 'loss'},
    ]);
    expect(bill.targetSelector).eq(PRELUDE_PRICE_TARGET_SELECTOR);
    expect(bill.reward.cause).deep.eq([
      {channel: 'stock', resource: 'megacredits', amount: 12, direction: 'loss'},
      // PL-1561: the director leaves the SOURCE card's capsule (born there, absorbed at its printed icon).
      {channel: 'card-resource', resource: 'director', amount: 1, direction: 'loss', targetCard: CardName.BOARD_OF_DIRECTORS},
    ]);
    expect(bill.reward.known).deep.eq({'stock:megacredits': 30});
    expect(bill.capsuleSelector).eq(preludePriceCapsuleSelector(CardName.BOARD_OF_DIRECTORS));
    expect(bill.capsuleSelector).contains('[data-zoom-slot="Board of Directors"] .pcard__res');
  });

  it('PL-1562: a price PAID otherwise (Helion’s heat) leaves the rows it was paid from', () => {
    const bill = preludePriceBill(price, [], {megacredits: 0, heat: 12, steel: 0, titanium: 0, microbes: 0});
    expect(bill.reward.cause.filter((s) => s.channel === 'stock')).deep.eq([{channel: 'stock', resource: 'heat', amount: 12, direction: 'loss'}]);
    const mixed = preludePriceBill(price, [], {megacredits: 5, heat: 7});
    expect(mixed.reward.cause.filter((s) => s.channel === 'stock').map((s) => `${s.resource}:${s.amount}`)).deep.eq(['megacredits:5', 'heat:7']);
  });

  it('the d-pad walks the two rows without wrapping', () => {
    const rows = preludeVerdictRows(price, {megacredits: 40, max: 1, burns: false});
    expect(stepVerdictFocus(rows, 0, 1)).eq(1);
    expect(stepVerdictFocus(rows, 1, 1)).eq(1);
    expect(stepVerdictFocus(rows, 1, -1)).eq(0);
    expect(stepVerdictFocus(rows, 0, -1)).eq(0);
  });
});
