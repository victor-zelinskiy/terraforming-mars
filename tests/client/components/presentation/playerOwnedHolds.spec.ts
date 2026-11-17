import {expect} from 'chai';
import {reactive} from 'vue';
import {
  activeAnimationHoldDetails, beginAnimationHold, playerOwnedHolds, registerAnimationHoldSupplier, resetAnimationHoldsForTest,
  unregisterAnimationHoldSupplier,
} from '@/client/components/presentation/animationHold';
import {causeOf} from '@/common/diagnostics/cause';

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

  it('THE FEED\'S TWO LINES: a starved queue behind an owned wait is PLANNED; behind a motion it is the defect it always was', () => {
    const owned = '[notifications] 2 queued event(s) held behind an ANIMATION hold for over 12000ms — delivering anyway — ' +
      'vp-shares: ["remote-tiles · card:Immigration Shuttles 1"] (the holds wait for the player: vp-shares: the tile of another seat waits for a board the viewer keeps covered)';
    const leaked = '[notifications] 2 queued event(s) held behind an ANIMATION hold for over 12000ms — delivering anyway — ' +
      'vp-shares: ["tile-placement · city:44 1"] (leaked hold: vp-shares[notification-only])';
    expect(causeOf(owned, 'warn')).to.deep.include({cls: 'notifications/starvation-owned/vp-shares', tier: 'planned'});
    expect(causeOf(leaked, 'warn')).to.deep.include({tier: 'defect'});
    expect(causeOf(leaked, 'warn')?.cls).to.match(/^notifications\/starvation\//);
  });
});
