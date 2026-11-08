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
  isGambleTender,
  isTenderId,
  tenderDef,
} from '../../src/common/campaign/tenders';
import {
  advanceBots,
  applyBid,
  biddingHoldings,
  biddingOrder,
  biddingPickerCount,
  dealTenderOffer,
  missionTenderDeck,
  openBidding,
} from '../../src/server/campaign/tenderBidding';
import {tenderApplicable, TenderApplicabilityContext} from '../../src/server/campaign/tenderWindows';
import {MissionStanding} from '../../src/common/campaign/CampaignTypes';

const ALL = (_id: TenderId) => true;
const standing = (seat: number, place: number): MissionStanding =>
  ({seat, place, score: 0, megaCredits: 0, corporations: [], tiedWith: []});

describe('the «Тендеры» catalog', () => {
  it('every id has a row, a printed name and a unique bot priority; the removed kinds are no tenders', () => {
    const priorities = new Set<number>();
    for (const id of TENDER_IDS) {
      const def = TENDER_CATALOG[id];
      expect(def.id, id).eq(id);
      expect(TENDER_NAME_KEY[id], `${id} needs a printed name`).to.be.a('string').and.not.empty;
      expect(priorities.has(def.botPriority), `${id} shares a bot priority`).is.false;
      priorities.add(def.botPriority);
      expect(['legacy', 'start']).includes(def.window);
    }
    expect(TENDER_IDS).includes('gamblePreludes').and.includes('gambleProjects').and.includes('gambleCorporations').and.includes('targetedRequest');
    expect(isGambleTender('gamblePreludes') && isGambleTender('gambleCorporations')).is.true;
    expect(isGambleTender('openCall')).is.false;
    // The undivided «Авантюра» and «Дополнительный пролог» are gone (the owner, 2026-11-08 — neither ever shipped).
    expect(isTenderId('gamble')).is.false;
    expect(isTenderId('additionalPrelude')).is.false;
    expect(isTenderId('preferentialMerger'), 'a removed kind is no tender').is.false;
    expect(tenderDef('programExtension').window).eq('legacy');
  });

  it('THE DENIAL ORDER follows the impact estimate (§18.6): the decisive first, the three gambles LAST (the owner, 2026-11-08)', () => {
    const byPriority = [...TENDER_IDS].sort((a, b) => tenderDef(a).botPriority - tenderDef(b).botPriority);
    expect(byPriority.slice(0, 2), 'the two decisives lead').deep.eq(['programExtension', 'targetedRequest']);
    expect(byPriority.slice(-3), 'the gambles close').deep.eq(['gamblePreludes', 'gambleProjects', 'gambleCorporations']);
    expect(tenderDef('broadPortfolio').botPriority, '«Широкий портфель» outranks «Пересмотр проектов»').lessThan(tenderDef('projectReview').botPriority);
    const tiers = Object.fromEntries(TENDER_IDS.map((id) => [id, tenderDef(id).tier]));
    expect(tiers.targetedRequest, 'three cards of one tag under a known lineage swing a finale (the owner, 2026-11-08)').eq('decisive');
    expect(tiers.researchSubsidy, 'the first of the notables (the owner: «скорее весомая»)').eq('notable');
    expect(byPriority[2]).eq('researchSubsidy');
    expect(tiers.broadPortfolio).eq('notable');
    expect(tiers.projectReview).eq('minor');
    // The tiers are monotone along the denial order: no minor outranks a notable, no notable a decisive.
    const rank = {decisive: 0, notable: 1, minor: 2, gamble: 3};
    for (let i = 1; i < byPriority.length; i++) {
      expect(rank[tenderDef(byPriority[i]).tier], `${byPriority[i]} after ${byPriority[i - 1]}`).gte(rank[tenderDef(byPriority[i - 1]).tier]);
    }
  });

  it('the bot\'s denial order is the catalog\'s: the decisive first, the minor last', () => {
    const open: Array<BiddingOfferCard> = [
      {instance: 'a', id: 'broadPortfolio'},
      {instance: 'b', id: 'programExtension'},
      {instance: 'c', id: 'restructuring'},
    ];
    expect(botTenderPick(open)?.id).eq('programExtension');
    // «Широкий портфель» outranks «Реструктуризация» since the owner's review of 2026-11-08 (§18.6).
    expect(botTenderPick(open.filter((c) => c.id !== 'programExtension'))?.id).eq('broadPortfolio');
    expect(botTenderPick([{instance: 'd', id: 'gambleProjects'}, {instance: 'e', id: 'projectReview'}])?.id, 'a gamble is the last the bot takes').eq('projectReview');
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
      {id: 'gamblePreludes', status: 'held'},
    ], 'extendedLegacy')).eq(2);
  });
});

describe('the mission deck (the owner, 2026-11-08: one card of every kind, shuffled anew for every mission)', () => {
  it('holds ONE card of every applicable dealt kind, shuffled reproducibly by the seed; a kind the campaign cannot use is not in it', () => {
    const a = missionTenderDeck(ALL, new SeededRandom(0.25));
    const b = missionTenderDeck(ALL, new SeededRandom(0.25));
    expect(a).deep.eq(b);
    expect(a).has.length(TENDER_IDS.length);
    expect(new Set(a).size, 'one card of every kind — never two').eq(a.length);
    for (const id of TENDER_IDS) {
      expect(a).includes(id);
    }
    expect(a, 'a different seed shuffles differently').not.deep.eq(missionTenderDeck(ALL, new SeededRandom(0.75)));
    const noPreludes = missionTenderDeck((id) => !TENDER_CATALOG[id].needsPreludes, new SeededRandom(0.25));
    expect(noPreludes.some((id) => TENDER_CATALOG[id].needsPreludes)).is.false;
    expect(noPreludes.length).lessThan(a.length);
  });

  it('a deal is RANDOM off the top of the fresh deck: distinct kinds (one card each), two minors are an honest table, instances by slot', () => {
    const offer = dealTenderOffer(4, 1, ALL, new SeededRandom(0.5));
    expect(offer).has.length(4);
    expect(new Set(offer.map((c) => c.id)).size, 'one card per kind — no kind twice on one table').eq(4);
    expect(offer.map((c) => c.instance)).deep.eq(['t1-0', 't1-1', 't1-2', 't1-3']);
    // A deal of nothing but the weakest tiers is honest — no tier but the decisive is steered.
    const weakOnly = (id: TenderId) => tenderDef(id).tier === 'minor' || tenderDef(id).tier === 'gamble';
    const weak = dealTenderOffer(2, 0, weakOnly, new SeededRandom(0.5)).map((c) => tenderDef(c.id).tier);
    expect(weak).has.length(2);
    expect(weak.every((t) => t === 'minor' || t === 'gamble')).is.true;
  });

  it('AT MOST ONE DECISIVE per table: the second decisive is set aside and the next card takes its place — whatever the seed', () => {
    // The owner, 2026-11-07: «Продление программы» and «Дополнительный пролог» never lie on one table.
    const decisiveOrNotable = (id: TenderId) => tenderDef(id).tier === 'decisive' || tenderDef(id).tier === 'notable';
    for (const seed of [0.05, 0.3, 0.62, 0.9, 0.17, 0.44]) {
      for (const size of [2, 4, 5]) {
        const table = dealTenderOffer(size, 0, decisiveOrNotable, new SeededRandom(seed));
        const decisive = table.filter((c) => tenderDef(c.id).tier === 'decisive').length;
        expect(decisive, `seed ${seed} size ${size}`).lte(1);
        expect(table, `seed ${seed} size ${size} — the set-aside decisive is replaced`).has.length(size);
      }
    }
    // Both decisives in a two-card deck: one dealt, the other set aside — an honest short table.
    const decisiveOnly = (id: TenderId) => tenderDef(id).tier === 'decisive';
    const two = dealTenderOffer(2, 0, decisiveOnly, new SeededRandom(0.5));
    expect(two).has.length(1);
    expect(tenderDef(two[0].id).tier).eq('decisive');
  });

  it('the deck is the MISSION\'s: the next mission shuffles afresh — the same kind may come again; nothing applicable → an empty table', () => {
    const first = dealTenderOffer(2, 0, ALL, new SeededRandom(0.31));
    const second = dealTenderOffer(2, 1, ALL, new SeededRandom(0.31));
    expect(second.map((c) => c.id), 'the same seed deals the same kinds again — no cursor carries over').deep.eq(first.map((c) => c.id));
    expect(second.map((c) => c.instance)).deep.eq(['t1-0', 't1-1']);
    expect(dealTenderOffer(3, 0, () => false, new SeededRandom(0.1))).is.empty;
    // A deck shorter than the table deals what it has.
    const onlyOpenCall = (id: TenderId) => id === 'openCall';
    expect(dealTenderOffer(3, 0, onlyOpenCall, new SeededRandom(0.1)).map((c) => c.id)).deep.eq(['openCall']);
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
    const offer: Array<BiddingOfferCard> = [{instance: 'a', id: 'gamblePreludes'}, {instance: 'b', id: 'restructuring'}, {instance: 'c', id: 'openCall'}];
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
    let bidding = openBidding(0, offer('gamblePreludes', 'restructuring'), [2, 0, 1], []);
    expect(bidding.done).is.false;
    expect(biddingTurnSeat(bidding)).eq(2);
    expect(() => applyBid(bidding, 0, 't0-0'), 'out of turn').throws(/not this seat's turn/);
    expect(() => applyBid(bidding, 2, 'nope'), 'not on the table').throws(/not on the table/);
    bidding = applyBid(bidding, 2, 't0-1');
    expect(biddingTurnSeat(bidding)).eq(0);
    expect(biddingOpenCards(bidding).map((c) => c.id)).deep.eq(['gamblePreludes']);
    bidding = applyBid(bidding, 0, 't0-0');
    expect(bidding.done).is.true;
    expect(biddingTurnSeat(bidding)).is.undefined;
    expect(() => applyBid(bidding, 1, 't0-0')).throws(/over/);
    const holdings = biddingHoldings(bidding);
    expect(holdings.map((h) => [h.seat, h.holding.id, h.holding.place])).deep.eq([[0, 'gamblePreludes', 2], [2, 'restructuring', 1]]);
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
    const bidding = openBidding(0, offer('broadPortfolio', 'researchSubsidy', 'preludeReview'), [3, 0, 1, 2], []);
    const after = advanceBots(bidding, (seat) => seat === 3);
    expect(after.offer.find((c) => c.id === 'researchSubsidy')?.takenBy, '«Субсидия» heads the notables — denied before the portfolio and the review').eq(3);
    expect(biddingTurnSeat(after)).eq(0);
    // Two bots in a row pick in a row.
    const twoBots = advanceBots(openBidding(0, offer('broadPortfolio', 'researchSubsidy', 'preludeReview'), [3, 4, 0, 1], []), (s) => s >= 3);
    expect(twoBots.offer.filter((c) => c.takenBy !== undefined)).has.length(2);
    expect(biddingTurnSeat(twoBots)).eq(0);
  });

  it('an empty offer is done at once', () => {
    expect(openBidding(0, [], [0, 1], []).done).is.true;
  });
});

describe('applicability', () => {
  const ctx = (overrides: Partial<TenderApplicabilityContext> = {}): TenderApplicabilityContext => ({
    preludes: true, humans: 2, missionCount: 4, preludePool: 35, startingPreludes: 4, corporationPool: 40,
    finaleDraftsCorporation: false, startingCorporations: 2, ...overrides,
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

  it('«Авантюра: корпорации» exists only where the finale DRAFTS a corporation (the three-mission route), with a pool for the draft, its redeal and a restructuring', () => {
    expect(tenderApplicable(tenderDef('gambleCorporations'), ctx({missionCount: 4, finaleDraftsCorporation: false}))).is.false;
    // 2 humans × 2 bans + 2 + 2 × 2 × 2 (the draft and its redeal) + 2 × 2 (restructuring) = 18.
    expect(tenderApplicable(tenderDef('gambleCorporations'), ctx({missionCount: 3, finaleDraftsCorporation: true, corporationPool: 18}))).is.true;
    expect(tenderApplicable(tenderDef('gambleCorporations'), ctx({missionCount: 3, finaleDraftsCorporation: true, corporationPool: 17}))).is.false;
    // The other two gambles need nothing beyond their pool's expansion.
    expect(tenderApplicable(tenderDef('gamblePreludes'), ctx({preludes: false}))).is.false;
    expect(tenderApplicable(tenderDef('gambleProjects'), ctx({preludes: false}))).is.true;
  });
});
