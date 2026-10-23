import {expect} from 'chai';
import {DraftShowcaseInput, planDraftShowcase, SHELF_CEILING_OF_CARD, SHELF_SEAT_FLOOR_REM} from '../../src/client/console/draft/draftShowcaseLayout';

/**
 * T10 · CE — THE PACKET SHOWCASE'S PLANNER. Three profiles (the workspace body as the 4K TV, fhd and the Deck lay it
 * out), 1–4 cards on the stage × 0–4 on the shelf, both compositions: nothing leaves the body, the packet keeps its
 * size, the TV's shelf faces are large and the Deck's stay at the floor.
 */

const SLOT = {slotW: 320, slotH: 460};
const PROFILES = {
  tv4k: {bodyW: 3250, bodyH: 1840, readingH: 104, ui: 2, rowPadX: 120, rowPadY: 152, grown: true},
  fhd: {bodyW: 1625, bodyH: 920, readingH: 52, ui: 1, rowPadX: 60, rowPadY: 76, grown: true},
  deck: {bodyW: 1010, bodyH: 640, readingH: 52 * 0.67, ui: 0.67, rowPadX: 40, rowPadY: 51, grown: false},
} as const;

function input(profile: keyof typeof PROFILES, extra: Partial<DraftShowcaseInput>): DraftShowcaseInput {
  return {...PROFILES[profile], ...SLOT, stage: 'pick', cards: 4, seats: 4, composition: 'stack', ...extra};
}

describe('draftShowcaseLayout — the packet showcase planner (T10 · CE)', () => {
  for (const profile of Object.keys(PROFILES) as Array<keyof typeof PROFILES>) {
    for (const composition of ['stack', 'side'] as const) {
      for (let cards = 1; cards <= 4; cards++) {
        it(`${profile} · ${composition} · ${cards} card(s): the packet and the shelf share the body, nothing outside it`, () => {
          const o = input(profile, {cards, composition});
          const plan = planDraftShowcase(o);
          const stageH = o.bodyH - o.readingH;
          if (composition === 'stack') {
            expect(plan.cardH + o.rowPadY + plan.shelfBlock, 'the packet + the shelf band fit the stage height').lte(stageH + 1);
          } else {
            expect(plan.cardH + o.rowPadY, 'the packet fits the stage height').lte(stageH + 1);
            expect(plan.shelfBlock, 'the column leaves the packet room').lt(o.bodyW * 0.4);
          }
          expect(plan.seatH, 'a seat is at least the floor').gte(Math.floor(SHELF_SEAT_FLOOR_REM * 20 * o.ui) - 1);
          expect(plan.seatH, 'a seat never competes with the protagonist').lte(Math.max(plan.cardH * SHELF_CEILING_OF_CARD, SHELF_SEAT_FLOOR_REM * 20 * o.ui) + 1);
          expect(4 * plan.seatW, 'the shelf\'s row fits the body').lt(o.bodyW);
        });
      }
    }
  }

  it('the TV: the four-card packet is ≥ 45 % of the body\'s height and the shelf faces are large (≥ 180 px)', () => {
    const plan = planDraftShowcase(input('tv4k', {}));
    expect(plan.cardH / PROFILES.tv4k.bodyH).gte(0.45);
    expect(plan.seatH).gte(180);
  });

  it('the Deck keeps the shelf at its floor (the base contract does not grow)', () => {
    const plan = planDraftShowcase(input('deck', {}));
    expect(plan.seatH).eq(Math.floor(SHELF_SEAT_FLOOR_REM * 20 * PROFILES.deck.ui));
  });

  it('the WAIT: the SAME rack comes forward by a transform — on the TV its faces reach ≥ 40 % of the body, on the Deck it stays in place', () => {
    const pick = planDraftShowcase(input('tv4k', {}));
    const tv = planDraftShowcase(input('tv4k', {stage: 'wait', cards: 0}));
    expect([tv.seatH, tv.seatW], 'the rack never resizes between stages').deep.eq([pick.seatH, pick.seatW]);
    expect(tv.cardH).eq(0);
    expect(tv.seatH * tv.waitScale / PROFILES.tv4k.bodyH).gte(0.4);
    expect(4 * tv.seatW * tv.waitScale, 'the forward rack fits the body').lt(PROFILES.tv4k.bodyW);
    expect(planDraftShowcase(input('deck', {stage: 'wait', cards: 0})).waitScale).eq(1);
  });

  it('the rack is CONSTANT across the draft\'s rounds (4 → 3 → 2 cards): a shorter packet grows its cards into the same box', () => {
    const plans = [4, 3, 2].map((cards) => planDraftShowcase(input('tv4k', {cards})));
    expect(new Set(plans.map((p) => p.seatH)).size, 'one seat size').eq(1);
    expect(plans[1].cardH).gte(plans[0].cardH);
    expect(plans[2].cardH).gte(plans[1].cardH);
  });

  it('the buy (no shelf): the cards take the whole stage', () => {
    const plan = planDraftShowcase(input('tv4k', {stage: 'buy', seats: 0}));
    expect(plan.shelfBlock).eq(0);
    expect(plan.cardH).gt(planDraftShowcase(input('tv4k', {})).cardH * 0.99);
  });
});
