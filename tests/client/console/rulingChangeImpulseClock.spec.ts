import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PartyName} from '@/common/turmoil/PartyName';
import {reconcileDrawnCards} from '@/client/components/drawnCards/drawnCardsState';
import {
  deliverRulingChangeDraws, IMPULSE_FLIGHT_MAX_MS, IMPULSE_WAIT_MS, resetRulingChangeDraw, rulingChangeDrawState,
} from '@/client/console/parliament/rulingChangeDraw';
import {allianceImpulseState, resetAllianceImpulse} from '@/client/console/parliament/allianceImpulse';
import {resetParliamentDraw} from '@/client/console/parliament/parliamentDraw';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';

/*
 * THE ENACTMENT'S TAIL WAITS FOR THE ALLIANCE'S IMPULSE TO LAND (FLAKE ZERO Ф4, class N). The order of the tail is the
 * seals → the impulse → the card: two objects never move at once. The tail's bound (1.6 s) ran from the TAIL's start
 * and also covered the spark's flight — on a slow renderer it ran out with the spark in the air and the card left the
 * deck under it. The bound is the impulse's START now; a spark in the air is waited for to its landing (a hard
 * ceiling over all of it).
 */
const ruling = {type: 'ruling-change' as const, cardName: CardName.THARSIS_ALLIANCE, party: PartyName.MARS};

async function microtasks(): Promise<void> {
  for (let i = 0; i < 10; i++) {
    await Promise.resolve();
  }
}

describe('rulingChangeDraw — the tail waits for the alliance\'s impulse to LAND, not for a clock (FLAKE ZERO Ф4)', () => {
  let clock: ManualFlowClock;
  let tail: Promise<void> | undefined;

  beforeEach(() => {
    clock = createManualClock(0);
    setFlowClock(clock);
    resetAllianceImpulse();
    resetRulingChangeDraw();
    resetParliamentDraw();
    // The change of power drew a card the tail owes the draw stage.
    reconcileDrawnCards([{id: 31, source: ruling, segments: [{source: ruling, count: 1}], cards: [{name: CardName.FISH} as CardModel]}]);
    allianceImpulseState.pending = new Set([PartyName.MARS]);
    // The chamber stands at rest with both seals seen — the spark is a tick away (its prospect is the chamber's word).
    allianceImpulseState.prospect = 'arming';
  });

  afterEach(async () => {
    // The batch goes (taken) — the tail's wait for the take ends, the tail finishes.
    allianceImpulseState.flying = 0;
    reconcileDrawnCards([]);
    clock.advance(IMPULSE_FLIGHT_MAX_MS * 2);
    await microtasks();
    await tail;
    resetRulingChangeDraw();
    resetAllianceImpulse();
    resetParliamentDraw();
    setFlowClock(undefined);
  });

  it('a spark IN THE AIR past the start bound keeps the card parked — it is handed over once the spark lands', async () => {
    allianceImpulseState.flying = 1;
    tail = deliverRulingChangeDraws();
    clock.advance(IMPULSE_WAIT_MS + 1000);
    await microtasks();
    expect(rulingChangeDrawState.handedOver, 'the spark is still flying: the card waits').is.false;
    // The spark lands (its touchdown takes the party off the owed list too).
    allianceImpulseState.flying = 0;
    allianceImpulseState.pending = new Set();
    clock.advance(100);
    await microtasks();
    expect(rulingChangeDrawState.handedOver, 'landed: the card goes to the draw stage').is.true;
  });

  it('an impulse that never STARTS lets the card go at the start bound, as before', async () => {
    tail = deliverRulingChangeDraws();
    clock.advance(IMPULSE_WAIT_MS - 100);
    await microtasks();
    expect(rulingChangeDrawState.handedOver).is.false;
    clock.advance(200);
    await microtasks();
    expect(rulingChangeDrawState.handedOver, 'the chamber never showed it — it stays owed to the next look').is.true;
  });

  /*
   * A CHAMBER THAT CANNOT SHOW IT IS WAITED FOR BY NOBODY (the box's game 1439: the fullscreen viewer covered the seals;
   * the tail waited 1.6 s for a start that could not come, and said a ceiling). Covered or not on screen at all: the
   * impulse stays owed to the next look, and the card goes on at once.
   */
  for (const prospect of ['covered', 'unmounted'] as const) {
    it(`the chamber ${prospect === 'covered' ? 'COVERED (a viewer over the seals)' : 'NOT ON SCREEN'}: the card goes on at once — no wait, no ceiling`, async () => {
      allianceImpulseState.prospect = prospect;
      const said: Array<string> = [];
      const warn = console.warn;
      console.warn = (...args: Array<unknown>) => said.push(args.map(String).join(' '));
      try {
        tail = deliverRulingChangeDraws();
        await microtasks();
        expect(rulingChangeDrawState.handedOver, 'handed over without a tick of the clock').is.true;
        expect(said.filter((line) => line.includes('alliance-impulse')), 'nothing said').to.deep.equal([]);
      } finally {
        console.warn = warn;
      }
    });
  }

  it('a spark that never lands is bounded by the hard ceiling', async () => {
    allianceImpulseState.flying = 1;
    tail = deliverRulingChangeDraws();
    clock.advance(IMPULSE_FLIGHT_MAX_MS - 100);
    await microtasks();
    expect(rulingChangeDrawState.handedOver).is.false;
    clock.advance(200);
    await microtasks();
    expect(rulingChangeDrawState.handedOver).is.true;
  });
});
