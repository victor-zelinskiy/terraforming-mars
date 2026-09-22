import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardResourceDistributionMeta} from '@/common/models/PlayerInputModel';
import {
  pourRemaining, spreadBlocked, spreadCardReading, spreadComplete, spreadFromPicks, spreadOn, spreadRemaining, SpreadState, spreadToPicks,
  spreadTotal, spreadVictoryPointsShift, stepSpread,
} from '@/client/console/cardResourceDistribution';
import {cardResourceDistributionResponse} from '@/client/console/taskResponses';

/*
 * THE LAYOUT of a card-resource distribution — the pure half of the card-target chassis's layout mode
 * (the shared `AddResourcesToCards` step: Cloud Development's floaters). What is pinned: the layout OPENS
 * EMPTY and never pre-fills; a counter never goes below 0 nor above what is left (LB on zero and RB with
 * nothing left are no-ops — the SAME state comes back); RT pours the rest; the commit's reason names the
 * remaining count; the focused card reads the server's VP entry for exactly its amount; the whole
 * layout's VP shift adds up; an INCOMPLETE layout yields NO response at all — the third of the three
 * locks (the bar, the handler, the builder) an incomplete layout can never pass.
 */
const HABS = CardName.FLOATING_HABS;
const DIRIGIBLES = CardName.DIRIGIBLES;
const LANTERNS = CardName.JOVIAN_LANTERNS;

function card(name: CardName, resources?: number): CardModel {
  return {name, ...(resources === undefined ? {} : {resources})} as CardModel;
}

/** Three floaters over three holders; Floating Habs and Jovian Lanterns score 1 VP per 2 floaters (the server's table, per k). */
const META: CardResourceDistributionMeta = {
  amount: 3,
  cardResource: 'floater',
  cards: [card(HABS, 1), card(DIRIGIBLES), card(LANTERNS, 0)],
  vpByAmount: {
    [HABS]: [{from: 0, to: 1}, {from: 0, to: 1}, {from: 0, to: 2}],
    [LANTERNS]: [{from: 0, to: 0}, {from: 0, to: 1}, {from: 0, to: 1}],
  },
};

describe('cardResourceDistribution — the layout of a spread payout', () => {
  it('opens empty: nothing placed, everything left, the commit withheld with the remaining count named', () => {
    const empty: SpreadState = {};
    expect(spreadTotal(empty)).eq(0);
    expect(spreadRemaining(3, empty)).eq(3);
    expect(spreadComplete(3, empty)).is.false;
    expect(spreadBlocked(3, empty)).deep.eq({key: 'Left to place: ${0}', params: ['3']});
    expect(cardResourceDistributionResponse([HABS, DIRIGIBLES, LANTERNS], empty, 3), 'an empty layout is nothing to send').is.undefined;
  });

  it('RB adds one, LB takes one back, both bounded: never below zero, never past what is left — a bound press returns the SAME state', () => {
    let state: SpreadState = {};
    const atZero = stepSpread(state, HABS, -1, 3);
    expect(atZero, 'LB on zero is a no-op').eq(state);
    state = stepSpread(state, HABS, 1, 3);
    expect(spreadOn(state, HABS)).eq(1);
    state = stepSpread(state, DIRIGIBLES, 1, 3);
    state = stepSpread(state, DIRIGIBLES, 1, 3);
    expect(state).deep.eq({[HABS]: 1, [DIRIGIBLES]: 2});
    expect(spreadRemaining(3, state)).eq(0);
    const full = stepSpread(state, LANTERNS, 1, 3);
    expect(full, 'RB with nothing left is a no-op').eq(state);
    state = stepSpread(state, DIRIGIBLES, -1, 3);
    expect(state).deep.eq({[HABS]: 1, [DIRIGIBLES]: 1});
    state = stepSpread(state, HABS, -1, 3);
    expect(state, 'a card taken back to zero leaves the layout').deep.eq({[DIRIGIBLES]: 1});
  });

  it('RT pours everything left onto the focused card — and nothing with nothing left', () => {
    let state: SpreadState = stepSpread({}, HABS, 1, 3);
    state = pourRemaining(state, LANTERNS, 3);
    expect(state).deep.eq({[HABS]: 1, [LANTERNS]: 2});
    expect(spreadComplete(3, state)).is.true;
    expect(spreadBlocked(3, state)).is.undefined;
    expect(pourRemaining(state, DIRIGIBLES, 3), 'nothing left to pour').eq(state);
    // A step past the amount is impossible by construction: the sum can never exceed N.
    expect(spreadTotal(stepSpread(state, DIRIGIBLES, 5, 3))).eq(3);
  });

  it('the focused card reads the server\'s VP entry for EXACTLY its amount — stepped points read per k, never a scaled delta', () => {
    const empty = spreadCardReading(META, {}, HABS);
    expect(empty).deep.eq({card: HABS, placed: 0, resources: {from: 1, to: 1}, vp: {from: 0, to: 0}});
    const one = spreadCardReading(META, {[HABS]: 1}, HABS);
    expect(one?.resources).deep.eq({from: 1, to: 2});
    expect(one?.vp, 'k = 1: the first entry').deep.eq({from: 0, to: 1});
    const three = spreadCardReading(META, {[HABS]: 3}, HABS);
    expect(three?.vp, 'k = 3: the third entry').deep.eq({from: 0, to: 2});
    const lanterns = spreadCardReading(META, {[LANTERNS]: 1}, LANTERNS);
    expect(lanterns?.vp, 'one floater on a per-2 card moves nothing — and says so').deep.eq({from: 0, to: 0});
    const dirigibles = spreadCardReading(META, {[DIRIGIBLES]: 2}, DIRIGIBLES);
    expect(dirigibles?.resources, 'a card with no counter yet reads from 0').deep.eq({from: 0, to: 2});
    expect(dirigibles?.vp, 'a card whose points never respond has no VP reading').is.undefined;
    expect(spreadCardReading(META, {}, CardName.FISH), 'not a candidate').is.undefined;
  });

  it('the whole layout\'s VP shift adds each placed card\'s own entry', () => {
    expect(spreadVictoryPointsShift(META, {})).eq(0);
    expect(spreadVictoryPointsShift(META, {[HABS]: 1, [LANTERNS]: 2})).eq(2);
    expect(spreadVictoryPointsShift(META, {[DIRIGIBLES]: 3})).eq(0);
    expect(spreadVictoryPointsShift(META, {[HABS]: 3})).eq(2);
  });

  it('the response is built ONLY from a complete layout, in the server\'s own card order', () => {
    const order = [HABS, DIRIGIBLES, LANTERNS];
    expect(cardResourceDistributionResponse(order, {[HABS]: 1}, 3), 'below N').is.undefined;
    expect(cardResourceDistributionResponse(order, {[HABS]: 2, [LANTERNS]: 2}, 3), 'above N').is.undefined;
    expect(cardResourceDistributionResponse(order, {}, 0), 'nothing to place at all').is.undefined;
    expect(cardResourceDistributionResponse(order, {[LANTERNS]: 2, [HABS]: 1}, 3)).deep.eq({
      type: 'and', responses: [{type: 'amount', amount: 1}, {type: 'amount', amount: 0}, {type: 'amount', amount: 2}],
    });
  });

  it('travels through the picks store as repeated names and comes back as the same counters — unknown names dropped, the bound kept', () => {
    const state: SpreadState = {[HABS]: 2, [LANTERNS]: 1};
    const picks = spreadToPicks(state);
    expect([...picks].sort()).deep.eq([HABS, HABS, LANTERNS].sort());
    expect(spreadFromPicks(picks, META)).deep.eq(state);
    expect(spreadFromPicks([HABS, CardName.FISH, HABS, HABS, HABS], META), 'a foreign name is dropped, the amount is the bound').deep.eq({[HABS]: 3});
    expect(spreadFromPicks([], META)).deep.eq({});
  });
});
