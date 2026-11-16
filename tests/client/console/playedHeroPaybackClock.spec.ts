/*
 * THE PLAYED HERO'S BOUNDS COUNT FROM THE EVENT THEY WAIT FOR (FLAKE ZERO · class N — `consolePlayedHero.ts`).
 *
 * ① THE PAY-BACK (P84 · DK): an event that pays before its lift lets the commit through and waits for the pay-back's go.
 *   Its 8 s bound counted from the GATE over the whole pay-back — on a slow renderer the pay-back's tokens were still
 *   leaving the card when it ran out, and the event lifted mid-pay-back. The 8 s now bounds the pay-back's START; once
 *   it pays, the lift waits for its END (a ceiling for one that never ends).
 * ② THE FLIGHT: the commit gate's scene safety and the pay-back's commit half waited «the motion + 3 s» for a flight
 *   whose own inner bounds (the source poll, two guarded beats that catch their motion up at budget + 1.2 s, the
 *   target's 1.6 s wait) add up to more: the gate opened and the real card was revealed under a proxy in the air.
 */
import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {createManualClock, ManualFlowClock, setFlowClock} from '@/client/console/kernel/flowClock';
import {
  abortPlayedHero, armPlayedHero, detectPlayedHero, endPlayedHero, playedHeroFlightBoundMs, playedHeroState, runPlayedHero,
} from '@/client/console/played/consolePlayedHero';
import {HERO_FLIGHT_MS, HERO_LAND_MS, HERO_LIFT_MS} from '@/client/console/played/playedHeroModel';
import {dropTransferEnds, registerTransferEnds, resetTransferEnds} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {motionMs} from '@/client/components/motion/motionTokens';

function seat(tableau: Array<CardName>): PlayerViewModel {
  return {id: 'p-blue', thisPlayer: {megacredits: 10, tableau: tableau.map((n) => ({name: n}))}, waitingFor: undefined} as unknown as PlayerViewModel;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 20; i++) {
    await Promise.resolve();
  }
}

describe('the played hero · its bounds count from the event they wait for', () => {
  describe('① the pay-back: the 8 s bound its START, the lift waits for its END', () => {
    let clock: ManualFlowClock;
    let standing: HTMLElement | undefined;
    const TOKEN = 9_000_001;

    beforeEach(() => {
      clock = createManualClock(0);
      setFlowClock(clock);
      // AN EVENT standing in the play composer with printed points: it pays before it lifts.
      standing = document.createElement('div');
      standing.className = 'con-composer con-composer--play';
      standing.innerHTML = '<div data-zoom-handoff="play-card"><div class="pcard"><div class="pcard__vp">1</div></div></div>';
      document.body.appendChild(standing);
      const pcard = standing.querySelector<HTMLElement>('.pcard')!;
      pcard.getBoundingClientRect = () => ({x: 100, y: 100, width: 200, height: 300, left: 100, top: 100, right: 300, bottom: 400, toJSON: () => ({})}) as DOMRect;
    });
    afterEach(async () => {
      abortPlayedHero();
      resetTransferEnds();
      standing?.remove();
      standing = undefined;
      setFlowClock(undefined);
      await flush();
    });

    it('a pay-back still playing past 8 s keeps the card standing — it lifts on the pay-back\'s own end', async () => {
      armPlayedHero(CardName.SHIPMENT_TO_EARTH, true, {manualTableOpen: false});
      const before = seat([]);
      const after = seat([CardName.SHIPMENT_TO_EARTH]);
      expect(detectPlayedHero(after)).to.not.be.undefined;
      // The gate opens for the pay-back (the commit goes through before the lift).
      await runPlayedHero(after, before);
      expect(playedHeroState.payback, 'the event pays before it lifts').to.eq('paying');
      // A token born on the standing card is still leaving it: the pay-back's fold law holds the card (its surface clear).
      registerTransferEnds(TOKEN, {channel: 'stock', resource: 'megacredits', amount: 1, direction: 'gain'} as ResourceTransferSpec,
        standing!.querySelector('.pcard')!, undefined);
      void endPlayedHero();
      await flush();
      for (let t = 0; t < 8500; t += 500) {
        clock.advance(500);
        await flush();
      }
      expect(playedHeroState.payback, 'past the gate\'s 8 s, the pay-back is still PLAYING — never «late»').to.eq('paying');
      expect(playedHeroState.phase, 'the card still stands in the composer').to.eq('shipping');
      // The token left the card: the pay-back ends and gives the go.
      dropTransferEnds(TOKEN);
      await flush();
      expect(playedHeroState.payback).to.eq('paid');
    });
  });

  describe('② the flight\'s bound is the sum of its inner bounds', () => {
    it('it never runs out before the flight\'s own guarded beats, the target\'s wait and the source poll', () => {
      const guardedLift = motionMs(HERO_LIFT_MS) + 1200;
      const guardedArc = motionMs(HERO_FLIGHT_MS + HERO_LAND_MS) + 1200;
      const targetWait = 1600;
      const sourcePoll = 26 * 50;
      expect(playedHeroFlightBoundMs()).to.be.greaterThan(sourcePoll + Math.max(guardedLift, targetWait) + guardedArc);
    });
  });
});
