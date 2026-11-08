import {expect} from 'chai';
import {SeededRandom} from '../../src/common/utils/Random';
import {
  BiddingOfferCard,
  TENDER_CATALOG,
  TENDER_IDS,
  TENDER_NAME_KEY,
  TenderId,
  biddingOfferSize,
  biddingPickers,
  biddingOpenCards,
  biddingTurnSeat,
  botTenderPick,
  effectiveTenderOffer,
  heldTenderCount,
  isTenderId,
  tenderDef,
} from '../../src/common/campaign/tenders';
import {
  advanceBots,
  applyBid,
  biddingHoldings,
  biddingOrder,
  biddingPickerCount,
  buildTenderRegister,
  dealTenderOffer,
  openBidding,
  printTenderRegister,
} from '../../src/server/campaign/tenderBidding';
import {tenderApplicable, TenderApplicabilityContext} from '../../src/server/campaign/tenderWindows';
import {MissionStanding} from '../../src/common/campaign/CampaignTypes';

const ALL = (_id: TenderId) => true;
const standing = (seat: number, place: number): MissionStanding =>
  ({seat, place, score: 0, megaCredits: 0, corporations: [], tiedWith: []});

describe('the «Тендеры» catalog', () => {
  it('every id has a row, a printed name, a unique bot priority and at least one copy', () => {
    const priorities = new Set<number>();
    for (const id of TENDER_IDS) {
      const def = TENDER_CATALOG[id];
      expect(def.id, id).eq(id);
      expect(TENDER_NAME_KEY[id], `${id} needs a printed name`).to.be.a('string').and.not.empty;
      expect(def.copies, `${id} copies`).greaterThan(0);
      expect(priorities.has(def.botPriority), `${id} shares a bot priority`).is.false;
      priorities.add(def.botPriority);
      expect(['legacy', 'start']).includes(def.window);
    }
    expect(isTenderId('gamble')).is.true;
    expect(isTenderId('preferentialMerger'), 'a removed kind is no tender').is.false;
    expect(tenderDef('programExtension').window).eq('legacy');
  });

  it('the bot\'s denial order is the catalog\'s: the decisive first, the minor last', () => {
    const open: Array<BiddingOfferCard> = [
      {instance: 'a', id: 'broadPortfolio'},
      {instance: 'b', id: 'programExtension'},
      {instance: 'c', id: 'restructuring'},
    ];
    expect(botTenderPick(open)?.id).eq('programExtension');
    expect(botTenderPick(open.filter((c) => c.id !== 'programExtension'))?.id).eq('restructuring');
    expect(botTenderPick([])).is.undefined;
  });

  it('the offer size is seats − 1, and TWO on a two-seat table (D2)', () => {
    expect(biddingOfferSize(2)).eq(2);
    expect(biddingOfferSize(3)).eq(2);
    expect(biddingOfferSize(5)).eq(4);
    expect(biddingPickers(2)).eq(1);
    expect(biddingPickers(3)).eq(2);
  });

  it('the OFFER RULE (the owner, 2026-11-08): «all» deals one per seat and every seat picks; «minus two» deals seats − 2 and needs a third seat', () => {
    expect(biddingOfferSize(2, 'all')).eq(2);
    expect(biddingPickers(2, 'all')).eq(2);
    expect(biddingOfferSize(4, 'all')).eq(4);
    expect(biddingPickers(4, 'all')).eq(4);
    expect(biddingOfferSize(3, 'minusTwo')).eq(1);
    expect(biddingPickers(3, 'minusTwo')).eq(1);
    expect(biddingOfferSize(5, 'minusTwo')).eq(3);
    // A two-seat table reads «minus two» as the default (two cards, one picker) — never an empty table.
    expect(effectiveTenderOffer('minusTwo', 2)).eq('minusOne');
    expect(biddingOfferSize(2, 'minusTwo')).eq(2);
    expect(biddingPickers(2, 'minusTwo')).eq(1);
    expect(effectiveTenderOffer('minusTwo', 3)).eq('minusTwo');
    expect(effectiveTenderOffer('all', 2)).eq('all');
  });

  it('heldTenderCount counts only HELD copies of the kind', () => {
    expect(heldTenderCount([
      {id: 'extendedLegacy', status: 'held'},
      {id: 'extendedLegacy', status: 'executed'},
      {id: 'extendedLegacy', status: 'held'},
      {id: 'gamble', status: 'held'},
    ], 'extendedLegacy')).eq(2);
  });
});

describe('the Register', () => {
  it('prints every copy of every applicable kind, shuffled reproducibly by the seed', () => {
    const a = printTenderRegister(ALL, new SeededRandom(0.25));
    const b = printTenderRegister(ALL, new SeededRandom(0.25));
    expect(a).deep.eq(b);
    const total = TENDER_IDS.reduce((sum, id) => sum + TENDER_CATALOG[id].copies, 0);
    expect(a).has.length(total);
    for (const id of TENDER_IDS) {
      expect(a.filter((x) => x === id)).has.length(TENDER_CATALOG[id].copies);
    }
    const noPreludes = printTenderRegister((id) => !TENDER_CATALOG[id].needsPreludes, new SeededRandom(0.25));
    expect(noPreludes.some((id) => TENDER_CATALOG[id].needsPreludes)).is.false;
  });

  it('a deal is RANDOM: it takes the top cards as they lie — two copies of one kind may share a table (the owner, 2026-11-08)', () => {
    const register = {order: ['gamble', 'gamble', 'restructuring', 'openCall'] as Array<TenderId>, drawn: 0};
    const dealt = dealTenderOffer(register, 2, 1, ALL, new SeededRandom(0.5));
    expect(dealt.offer.map((c) => c.id)).deep.eq(['gamble', 'gamble']);
    expect(dealt.offer.map((c) => c.instance)).deep.eq(['t1-0', 't1-1']);
    // Nothing went under the Register; the cursor sits past the two dealt.
    expect(dealt.register.order).deep.eq(['gamble', 'gamble', 'restructuring', 'openCall']);
    expect(dealt.register.drawn).eq(2);
    // The next deal continues from the cursor.
    const next = dealTenderOffer(dealt.register, 2, 2, ALL, new SeededRandom(0.5));
    expect(next.offer.map((c) => c.id)).deep.eq(['restructuring', 'openCall']);
    expect(next.register.drawn).eq(4);
    // Two minors side by side are an honest table too — no tier is steered but the decisive.
    const minors = {order: ['researchSubsidy', 'broadPortfolio', 'openCall'] as Array<TenderId>, drawn: 0};
    expect(dealTenderOffer(minors, 2, 0, ALL, new SeededRandom(0.5)).offer.map((c) => c.id)).deep.eq(['researchSubsidy', 'broadPortfolio']);
  });

  it('AT MOST ONE DECISIVE per offer: the second decisive goes under the Register and is dealt at a later table', () => {
    // The owner, 2026-11-07: «Продление программы» and «Дополнительный пролог» never lie on one table.
    const register = {order: ['programExtension', 'additionalPrelude', 'restructuring', 'openCall'] as Array<TenderId>, drawn: 0};
    const dealt = dealTenderOffer(register, 2, 1, ALL, new SeededRandom(0.5));
    expect(dealt.offer.map((c) => c.id)).deep.eq(['programExtension', 'restructuring']);
    expect(dealt.register.order).deep.eq(['programExtension', 'restructuring', 'openCall', 'additionalPrelude']);
    // The next table gets the deferred decisive — a player can still collect both across two missions.
    const next = dealTenderOffer(dealt.register, 2, 2, ALL, new SeededRandom(0.5));
    expect(next.offer.map((c) => c.id)).deep.eq(['openCall', 'additionalPrelude']);
    // A full Register never deals two decisives together, whatever the shuffle.
    for (const seed of [0.05, 0.3, 0.62, 0.9]) {
      const full = buildTenderRegister(ALL, new SeededRandom(seed));
      let reg = full;
      for (let slot = 0; slot < 5; slot++) {
        const table = dealTenderOffer(reg, 4, slot, ALL, new SeededRandom(seed));
        const decisive = table.offer.filter((c) => tenderDef(c.id).tier === 'decisive').length;
        expect(decisive, `seed ${seed} slot ${slot}`).lte(1);
        reg = table.register;
      }
    }
  });

  it('an exhausted Register appends a second printing; a kind that is never applicable leaves it', () => {
    const register = {order: ['openCall'] as Array<TenderId>, drawn: 0};
    const applicable = (id: TenderId) => id !== 'openCall';
    const dealt = dealTenderOffer(register, 2, 0, applicable, new SeededRandom(0.1));
    expect(dealt.offer).has.length(2);
    expect(dealt.offer.some((c) => c.id === 'openCall')).is.false;
    expect(dealt.register.order.includes('openCall')).is.false;
    expect(dealt.register.order.length).greaterThan(2);
  });

  it('nothing applicable at all → an honest short offer, never a loop', () => {
    const dealt = dealTenderOffer({order: [], drawn: 0}, 3, 0, () => false, new SeededRandom(0.1));
    expect(dealt.offer).is.empty;
  });

  it('buildTenderRegister starts the cursor at zero', () => {
    const register = buildTenderRegister(ALL, new SeededRandom(0.9));
    expect(register.drawn).eq(0);
    expect(register.order.length).greaterThan(0);
  });
});

describe('the pick order', () => {
  it('follows the places; a full tie is a seeded LOT that is recorded', () => {
    const standings = [standing(0, 1), standing(1, 2), standing(2, 2), standing(3, 4)];
    const a = biddingOrder(standings, new SeededRandom(0.33));
    const b = biddingOrder(standings, new SeededRandom(0.33));
    expect(a).deep.eq(b);
    expect(a.order[0]).eq(0);
    expect(a.order[3]).eq(3);
    expect(a.order.slice(1, 3).sort()).deep.eq([1, 2]);
    expect(a.lots).has.length(1);
    expect([...a.lots[0].seats].sort()).deep.eq([1, 2]);
    expect(a.lots[0].order).deep.eq(a.order.slice(1, 3));
  });

  it('without a tie there is no lot', () => {
    const {order, lots} = biddingOrder([standing(2, 1), standing(0, 2), standing(1, 3)], new SeededRandom(0.1));
    expect(order).deep.eq([2, 0, 1]);
    expect(lots).is.empty;
  });

  it('every seat but the last picks — unless the record names its own picker count', () => {
    expect(biddingPickerCount({order: [0, 1, 2]})).eq(2);
    expect(biddingPickerCount({order: [0, 1]})).eq(1);
    expect(biddingPickerCount({order: []})).eq(0);
    expect(biddingPickerCount({order: [0, 1, 2], pickers: 3})).eq(3);
    expect(biddingPickerCount({order: [0, 1, 2], pickers: 1})).eq(1);
  });

  it('«all»: three seats, three cards — every seat takes one, the last takes what is left; «minus two»: one card, one picker', () => {
    const offer: Array<BiddingOfferCard> = [{instance: 'a', id: 'gamble'}, {instance: 'b', id: 'restructuring'}, {instance: 'c', id: 'openCall'}];
    let b = openBidding(0, offer, [0, 1, 2], [], biddingPickers(3, 'all'));
    expect(b.pickers).eq(3);
    b = applyBid(b, 0, 'b');
    b = applyBid(b, 1, 'c');
    expect(b.done, 'the last seat still picks').is.false;
    expect(biddingTurnSeat(b)).eq(2);
    b = applyBid(b, 2, 'a');
    expect(b.done).is.true;
    expect(b.offer.every((c) => c.takenBy !== undefined), 'nothing withdrawn — everyone holds one').is.true;
    expect(biddingHoldings(b).map((h) => h.seat).sort()).deep.eq([0, 1, 2]);

    const one = openBidding(0, offer.slice(0, 1), [0, 1, 2], [], biddingPickers(3, 'minusTwo'));
    expect(one.pickers).eq(1);
    const taken = applyBid(one, 0, 'a');
    expect(taken.done, 'one picker — the table closes on the first pick').is.true;
    expect(biddingHoldings(taken).map((h) => h.seat)).deep.eq([0]);
  });
});

describe('the bidding', () => {
  const offer = (...ids: Array<TenderId>): Array<BiddingOfferCard> => ids.map((id, i) => ({instance: `t0-${i}`, id}));

  it('three seats, two cards: the first picks any, the second takes the last, the third gets nothing', () => {
    let bidding = openBidding(0, offer('gamble', 'restructuring'), [2, 0, 1], []);
    expect(bidding.done).is.false;
    expect(biddingTurnSeat(bidding)).eq(2);
    expect(() => applyBid(bidding, 0, 't0-0'), 'out of turn').throws(/not this seat's turn/);
    expect(() => applyBid(bidding, 2, 'nope'), 'not on the table').throws(/not on the table/);
    bidding = applyBid(bidding, 2, 't0-1');
    expect(biddingTurnSeat(bidding)).eq(0);
    expect(biddingOpenCards(bidding).map((c) => c.id)).deep.eq(['gamble']);
    bidding = applyBid(bidding, 0, 't0-0');
    expect(bidding.done).is.true;
    expect(biddingTurnSeat(bidding)).is.undefined;
    expect(() => applyBid(bidding, 1, 't0-0')).throws(/over/);
    const holdings = biddingHoldings(bidding);
    expect(holdings.map((h) => [h.seat, h.holding.id, h.holding.place])).deep.eq([[0, 'gamble', 2], [2, 'restructuring', 1]]);
    expect(holdings.every((h) => h.holding.status === 'held' && h.holding.wonAtSlot === 0)).is.true;
  });

  it('two seats, two cards: the winner picks one, the other card is WITHDRAWN, the loser gets nothing', () => {
    let bidding = openBidding(1, offer('openCall', 'projectReview'), [1, 0], []);
    bidding = applyBid(bidding, 1, 't0-1');
    expect(bidding.done).is.true;
    expect(bidding.offer.find((c) => c.instance === 't0-0')?.withdrawn).is.true;
    expect(biddingHoldings(bidding)).has.length(1);
    expect(biddingHoldings(bidding)[0].seat).eq(1);
  });

  it('the bot picks the moment its turn comes — by the denial order — and the humans\' turns stand', () => {
    const bidding = openBidding(0, offer('broadPortfolio', 'additionalPrelude', 'preludeReview'), [3, 0, 1, 2], []);
    const after = advanceBots(bidding, (seat) => seat === 3);
    expect(after.offer.find((c) => c.id === 'additionalPrelude')?.takenBy).eq(3);
    expect(biddingTurnSeat(after)).eq(0);
    // Two bots in a row pick in a row.
    const twoBots = advanceBots(openBidding(0, offer('broadPortfolio', 'additionalPrelude', 'preludeReview'), [3, 4, 0, 1], []), (s) => s >= 3);
    expect(twoBots.offer.filter((c) => c.takenBy !== undefined)).has.length(2);
    expect(biddingTurnSeat(twoBots)).eq(0);
  });

  it('an empty offer is done at once', () => {
    expect(openBidding(0, [], [0, 1], []).done).is.true;
  });
});

describe('applicability', () => {
  const ctx = (overrides: Partial<TenderApplicabilityContext> = {}): TenderApplicabilityContext => ({
    preludes: true, humans: 2, missionCount: 4, preludePool: 35, startingPreludes: 4, corporationPool: 40, ...overrides,
  });

  it('a prelude tender needs the Prelude expansion', () => {
    expect(tenderApplicable(tenderDef('openCall'), ctx({preludes: false}))).is.false;
    expect(tenderApplicable(tenderDef('projectReview'), ctx({preludes: false}))).is.true;
  });

  it('the widening tenders need the pools to cover the worst case', () => {
    // 5 humans × (4 + 2 + 1) = 35 — exactly the base Prelude pool.
    expect(tenderApplicable(tenderDef('openCall'), ctx({humans: 5, preludePool: 35}))).is.true;
    expect(tenderApplicable(tenderDef('programExtension'), ctx({humans: 5, preludePool: 34}))).is.false;
    expect(tenderApplicable(tenderDef('restructuring'), ctx({humans: 2, missionCount: 4, corporationPool: 12}))).is.true;
    expect(tenderApplicable(tenderDef('restructuring'), ctx({humans: 2, missionCount: 4, corporationPool: 11}))).is.false;
  });
});
