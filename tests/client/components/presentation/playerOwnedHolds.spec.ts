import {expect} from 'chai';
import {reactive} from 'vue';
import {
  activeAnimationHoldDetails, beginAnimationHold, isAnimationHoldActive, playerOwnedHolds, registerAnimationHoldSupplier, registerPlayerCanAnswerProbe,
  resetAnimationHoldsForTest, unregisterAnimationHoldSupplier,
} from '@/client/components/presentation/animationHold';
import {causeOf} from '@/common/diagnostics/cause';
import {QUEUE_STARVATION_MS, starvationHolds} from '@/client/components/notifications/notificationState';

/**
 * WHO OWNS THE WAIT DECIDES WHAT THE LINE IS (docs/claude/console/freeze-zero/PLAN.md § 8, stage 1 —
 * `AnimationHoldOptions.heldForPlayer`, `playerOwnedHolds`).
 *
 * The feed's starvation escape calls a hold that outlives twelve seconds «leaked» — «an animation has no player in
 * the loop». The box named the case where that is false: a score share whose token flies with a rival's tile, and
 * the tile waits for a board the viewer keeps covered (seed `fz3` · `field-hydro-terminal`, every run).
 */
describe('playerOwnedHolds — a hold that waits on the player says so', () => {
  const state = reactive({held: false, covered: false});

  beforeEach(() => {
    resetAnimationHoldsForTest();
    state.held = false;
    state.covered = false;
  });
  afterEach(() => {
    unregisterAnimationHoldSupplier('vp-shares');
    unregisterAnimationHoldSupplier('tile-flight');
    registerPlayerCanAnswerProbe(undefined);
    resetAnimationHoldsForTest();
  });

  it('no hold stands: nobody is waited for', () => {
    expect(playerOwnedHolds()).to.eq(undefined);
  });

  it('a hold that says WHY it waits on the player is owned — and only while it says so', () => {
    registerAnimationHoldSupplier('vp-shares', () => state.held, {
      scope: 'notification-only',
      diagnose: () => ['remote-tiles · card:Immigration Shuttles 1'],
      heldForPlayer: () => (state.covered ? 'the tile of another seat waits for a board the viewer keeps covered' : undefined),
    });
    state.held = true;
    expect(playerOwnedHolds(), 'a motion nobody is waited for').to.eq(undefined);
    state.covered = true;
    expect(playerOwnedHolds()).to.eq('vp-shares: the tile of another seat waits for a board the viewer keeps covered');
    expect(activeAnimationHoldDetails(), 'and the hold says what it keeps').to.deep.eq(['vp-shares: ["remote-tiles · card:Immigration Shuttles 1"]']);
    state.held = false;
    expect(playerOwnedHolds(), 'released: nothing is waited for').to.eq(undefined);
  });

  it('ONE hold that is a plain motion makes the whole wait a motion again — a leak is never excused by its neighbour', () => {
    registerAnimationHoldSupplier('vp-shares', () => state.held, {scope: 'notification-only', heldForPlayer: () => 'the board is covered'});
    registerAnimationHoldSupplier('tile-flight', () => state.held);
    state.held = true;
    expect(playerOwnedHolds()).to.eq(undefined);
    unregisterAnimationHoldSupplier('tile-flight');
    expect(playerOwnedHolds()).to.eq('vp-shares: the board is covered');
    // …a manual hold declared `waitsFor: 'player'` is owned by its declaration; an undeclared one is a motion.
    const reading = beginAnimationHold('reading', {waitsFor: 'player'});
    expect(playerOwnedHolds()).to.eq('vp-shares: the board is covered · reading: waits for the player');
    const flight = beginAnimationHold('flight');
    expect(playerOwnedHolds()).to.eq(undefined);
    flight.release();
    reading.release();
  });

  it('a predicate that THROWS owns nothing', () => {
    registerAnimationHoldSupplier('vp-shares', () => state.held, {heldForPlayer: () => {
      throw new Error('a host that is gone');
    }});
    state.held = true;
    expect(playerOwnedHolds()).to.eq(undefined);
  });

  /*
   * THE CEILING ASKS THE HOLD ITSELF (the gate's seed `fz1` · `parliament-skyscrapers-enact`, 2026-11-17): the seat
   * stood on the sitting's verdict with a sheet of its own open, a reward owed and nothing in the air — and thirty-five
   * seconds of the player's reading ended as «leaked hold?», a defect.
   */
  it('THE CEILING\'S OWN LINE: a hold that waits on the player ends PLANNED, with its reason; a motion ends as the leak it is', async () => {
    // (REAL timers, like the registry's own spec: the ceiling under test is the kernel's timer.)
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const warns: Array<string> = [];
    const original = console.warn;
    console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
    try {
      registerAnimationHoldSupplier('vp-shares', () => state.held, {
        maxHoldMs: 20,
        heldForPlayer: () => (state.covered ? 'the reward waits for a walk that stands on this seat\'s answer (a reading)' : undefined),
      });
      state.held = true;
      state.covered = true;
      expect(isAnimationHoldActive()).to.eq(true);
      await wait(60);
      expect(warns[0]).to.match(/force-released by the safety ceiling \(planned: the hold waits for the player — the reward waits for a walk that stands on this seat's answer a reading\)$/);
      expect(causeOf(warns[0], 'warn')).to.deep.include({cls: 'animation-hold/ceiling/vp-shares', tier: 'planned'});

      // …and the same hold as a plain motion: nothing excuses it.
      unregisterAnimationHoldSupplier('vp-shares');
      resetAnimationHoldsForTest();
      state.covered = false;
      registerAnimationHoldSupplier('vp-shares', () => state.held, {maxHoldMs: 20, heldForPlayer: () => (state.covered ? 'x' : undefined)});
      expect(isAnimationHoldActive()).to.eq(true);
      await wait(60);
      expect(warns[1]).to.match(/force-released by the safety ceiling \(leaked hold\?\)$/);
      expect(causeOf(warns[1], 'warn')).to.deep.include({tier: 'defect'});
    } finally {
      console.warn = original;
    }
  });

  /*
   * «WAITS FOR THE PLAYER» IS BELIEVED ONLY WHILE THE PLAYER CAN ANSWER (the tier audit of 2026-11-18, row 2: a still
   * Parliament whose owed reward said «the seat is asked» for thirty-five seconds — over a pad that took no press —
   * ended as an honest wait). The screen's own word comes down as a probe (the arbiter's `accepting`).
   */
  it('a hold that says it waits for the player over a SHUT pad waits for nobody — a defect, and the line says both halves', async () => {
    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const warns: Array<string> = [];
    const original = console.warn;
    console.warn = (...args: Array<unknown>) => warns.push(args.map(String).join(' '));
    let accepting = false;
    registerPlayerCanAnswerProbe(() => accepting);
    try {
      registerAnimationHoldSupplier('vp-shares', () => state.held, {maxHoldMs: 20, heldForPlayer: () => 'the seat is asked (a reading)'});
      state.held = true;
      expect(playerOwnedHolds(), 'the feed does not believe it either').to.eq(undefined);
      await wait(60);
      expect(warns[0]).to.match(/force-released by the safety ceiling \(the hold says it waits for the player — the seat is asked a reading — but nothing on screen takes a press\)$/);
      expect(causeOf(warns[0], 'warn')).to.deep.include({cls: 'animation-hold/ceiling/vp-shares', tier: 'defect'});

      // …the pad takes a press: the same hold's word stands.
      unregisterAnimationHoldSupplier('vp-shares');
      resetAnimationHoldsForTest();
      accepting = true;
      registerAnimationHoldSupplier('vp-shares', () => state.held, {maxHoldMs: 20, heldForPlayer: () => 'the seat is asked'});
      expect(playerOwnedHolds()).to.eq('vp-shares: the seat is asked');
      await wait(60);
      expect(causeOf(warns[1], 'warn')).to.deep.include({tier: 'planned'});
    } finally {
      console.warn = original;
    }
  });

  it('THE FEED\'S TWO LINES: a starved queue behind an owned wait is PLANNED; behind a motion it is the defect it always was', () => {
    const owned = '[notifications] 2 queued event(s) held behind an ANIMATION hold for over 12000ms — delivering anyway — ' +
      'vp-shares: ["remote-tiles · card:Immigration Shuttles 1"] (the holds wait for the player: vp-shares: the tile of another seat waits for a board the viewer keeps covered)';
    const leaked = '[notifications] 2 queued event(s) held behind an ANIMATION hold for over 12000ms — delivering anyway — ' +
      'vp-shares: ["tile-placement · city:44 1"] (leaked hold: vp-shares[notification-only])';
    expect(causeOf(owned, 'warn')).to.deep.include({cls: 'notifications/starvation-owned/vp-shares', tier: 'planned'});
    expect(causeOf(leaked, 'warn')).to.deep.include({tier: 'defect'});
    expect(causeOf(leaked, 'warn')?.cls).to.match(/^notifications\/starvation\//);
  });

  /*
   * A SUCCESSION OF SCENES IS NOT ONE LEAKED HOLD (`notifications/starvation/hand-delivery` under a green
   * `console-re-settlement`, the whole suite on CI 2026-11-22): the escape's clock runs for as long as SOME animation
   * blocks the queue, and the line called whichever hold stood at the twelfth second «leaked».
   */
  it('the queue starved behind a CHAIN of scenes is PLANNED — «leaked» is said only of a hold that itself stood the bound', () => {
    const now = 100_000;
    // The city was carried for eleven seconds of scenes; the card's flight into the hand is 0.8 s old at the bound.
    const chain = starvationHolds([{label: 'hand-delivery', scope: 'notification-only', since: now - 800}], now);
    expect(chain).to.deep.eq({ages: 'hand-delivery[notification-only] 0.8s', succession: true});
    // ONE hold that stood the whole bound is the leak it always was — whatever younger ones stand beside it.
    const leak = starvationHolds([
      {label: 'hand-delivery', scope: 'notification-only', since: now - QUEUE_STARVATION_MS - 1},
      {label: 'tile-flight', scope: 'blocking', since: now - 300},
    ], now);
    expect(leak.succession).is.false;
    expect(leak.ages).to.eq('hand-delivery[notification-only] 12.0s, tile-flight[blocking] 0.3s');
    // No hold named at all (the block is somebody else's «animation»): never a succession — the old line.
    expect(starvationHolds([], now)).to.deep.eq({ages: '', succession: false});
    // …and the two lines, as the classifier reads them.
    const head = '[notifications] 1 queued event(s) held behind an ANIMATION hold for over 12000ms — delivering anyway';
    const said = `${head} — hand-delivery: 1 run · carries Re-Settlement (planned: a succession of scenes — no standing hold is itself older than the bound; ${chain.ages})`;
    expect(causeOf(said, 'warn')).to.deep.include({cls: 'notifications/starvation-succession', tier: 'planned'});
    const leaked = `${head} — standing ${leak.ages} (leaked hold: hand-delivery[notification-only], tile-flight[blocking])`;
    expect(causeOf(leaked, 'warn')).to.deep.include({tier: 'defect'});
    expect(causeOf(leaked, 'warn')?.cls).to.match(/^notifications\/starvation\/hand-delivery/);
  });
});
