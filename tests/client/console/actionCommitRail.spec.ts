import {expect} from 'chai';
import {watch} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionPreviewBranch} from '@/common/models/ActionPreviewModel';
import {blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import {
  ActionCommitPlan, armActionCommit, commitRailPlan, releaseActionCommit, resetActionCommit,
} from '@/client/console/consoleActionCommit';
import {
  actionCommitRailHoldsCapsule, actionCommitRailState, flyActionCommitRail, resetActionCommitRail, seedActionCommitRail,
} from '@/client/console/consoleActionCommitRail';
import {clearPanelRewardHold, heldCardCapsule, heldCardResource, heldStock, heldVictoryPoints} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY} from '@/client/console/resourceTransfer/resourceTransferModel';
import {railRewardState, resetRailRewards} from '@/client/console/resourceTransfer/railReward';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

/*
 * THE ACTION COMMIT'S RAIL HALF (`consoleActionCommitRail.ts`) — PL-001 for
 * actions and TR28's two beats on one card. Pinned here: the seed checks the
 * promise against the views and holds ONCE; a half nobody flies is released by
 * the commit's release; the chain releases its rows in the PRINTED order; and
 * the capsule arithmetic — the card reads c, then c + 1, then c − 1: never
 * c − 2, never below zero.
 */
const EAC = CardName.EARTH_ARMY_CONTRACT;
const UNMI = CardName.UNITED_NATIONS_MARS_INITIATIVE;

function view(p: {tr: number, mc?: number, fighters?: number}): PlayerViewModel {
  return {
    id: 'p-viewer',
    thisPlayer: {
      color: 'blue',
      terraformRating: p.tr,
      megacredits: p.mc ?? 0,
      energy: 0, steel: 0, titanium: 0, plants: 0, heat: 0,
      megacreditProduction: 0, steelProduction: 0, titaniumProduction: 0, plantProduction: 0, energyProduction: 0, heatProduction: 0,
      tableau: p.fighters === undefined ? [] : [{name: EAC, resources: p.fighters}],
    },
  } as unknown as PlayerViewModel;
}

/** The server's chips of TR28's action at `c` fighters (≥ 1) — the printed order. */
function eacBranch(c: number): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [
      {direction: 'gain', icon: 'fighter', amount: 1, current: c, resulting: c + 1, note: 'on this card'},
      {direction: 'cost', icon: 'fighter', amount: 2, current: c + 1, resulting: c - 1, note: 'on this card'},
      {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21},
    ],
  } as ActionPreviewBranch;
}

function unmiBranch(): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [{direction: 'cost', icon: 'megacredits', amount: 3, current: 20, resulting: 17}, {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21}],
  } as ActionPreviewBranch;
}

/** A TR paid with a PRODUCTION step (Equatorial Magnetizer's shape): the plate's own number, no token leaves the rail. */
function plainTrBranch(): ActionPreviewBranch {
  return {
    index: -1, title: '', available: true, renderKeys: [], steps: [],
    effects: [{direction: 'cost', icon: 'energy', amount: 1, note: 'production'}, {direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21}],
  } as ActionPreviewBranch;
}

function arm(card: CardName, branch: ActionPreviewBranch, reactions: Array<{channel: 'stock', resource: string, amount: number}> = []): ActionCommitPlan {
  const rail = commitRailPlan(card, branch, {}, reactions)!;
  const plan: ActionCommitPlan = {
    sourceCard: card, kind: 'rating', specs: [], origins: [],
    rail: {...rail, origins: rail.reward.cause.map(() => ({x: 10, y: 10}))},
  };
  armActionCommit(plan);
  return plan;
}

describe('consoleActionCommitRail — the action commit\'s rail half', () => {
  afterEach(() => {
    reduceMotionOverrideState.enabled = false;
    resetActionCommitRail();
    resetActionCommit();
    resetRailRewards();
    clearPanelRewardHold();
  });

  describe('SEED — the promise against the views, once', () => {
    it('UNMI: the TR held (and with it the VP cell), the price held until it LEAVES, the Greens\' answer held after it', () => {
      arm(UNMI, unmiBranch(), [{channel: 'stock', resource: 'megacredits', amount: 2}]);
      // −3 (the price — the chain's first link, PL-099) + 2 (the Greens' answer): the row moved by −1.
      seedActionCommitRail(view({tr: 20, mc: 20}), view({tr: 21, mc: 19}));
      expect(actionCommitRailState.phase).eq('seeded');
      expect(heldStock(RATING_RAIL_KEY)).eq(1);
      expect(heldStock('megacredits'), 'the answer (+2) held and the price (−3) held, signed: the row reads 20 until the first token moves').eq(-1);
    });

    it('a view that does not keep the promise holds NOTHING and names itself', () => {
      arm(UNMI, unmiBranch());
      seedActionCommitRail(view({tr: 20, mc: 20}), view({tr: 20, mc: 17}));
      expect(actionCommitRailState.phase).eq('idle');
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(railRewardState.degraded?.why).eq('mismatch');
    });

    it('a plan is seeded ONCE — a later frame cannot re-seed (and so release) the held rows', () => {
      arm(UNMI, unmiBranch());
      seedActionCommitRail(view({tr: 20, mc: 20}), view({tr: 21, mc: 17}));
      seedActionCommitRail(view({tr: 21, mc: 17}), view({tr: 21, mc: 17}));
      expect(heldStock(RATING_RAIL_KEY)).eq(1);
    });

    it('reduced motion holds nothing', () => {
      reduceMotionOverrideState.enabled = true;
      arm(UNMI, unmiBranch());
      seedActionCommitRail(view({tr: 20, mc: 20}), view({tr: 21, mc: 17}));
      expect(actionCommitRailState.phase).eq('idle');
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
    });

    it('a commit released WITHOUT its handoff releases the half — no hold nobody will fly', () => {
      arm(UNMI, unmiBranch());
      seedActionCommitRail(view({tr: 20, mc: 20}), view({tr: 21, mc: 17}));
      releaseActionCommit('hosted');
      expect(actionCommitRailState.phase).eq('idle');
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(blockingAnimationHoldCount()).eq(0);
    });
  });

  describe('FLY — the links in the printed order', () => {
    it('a plain TR (no price — a production cost is the plate\'s number) may fold at once; its row ticks on the flight', async () => {
      const plan = arm(UNMI, plainTrBranch());
      seedActionCommitRail(view({tr: 20, mc: 20}), view({tr: 21, mc: 20}));
      const flight = flyActionCommitRail(plan);
      let folded = false;
      void flight.foldable.then(() => {
        folded = true;
      });
      await Promise.resolve();
      expect(folded, 'nothing of the card is a target or a source').is.true;
      await flight.done;
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(actionCommitRailState.phase).eq('idle');
    });

    it('PL-099 — THE PRICE ON THE RAIL IS A DEPARTURE: UNMI\'s 3 M€ leave the row first (it ticks on the departure), the TR after; the surface stands until the TR is born', async () => {
      const plan = arm(UNMI, unmiBranch());
      seedActionCommitRail(view({tr: 20, mc: 20}), view({tr: 21, mc: 17}));
      expect(actionCommitRailState.phase).eq('seeded');
      const shown = () => `mc${17 - heldStock('megacredits')}|tr${21 - heldStock(RATING_RAIL_KEY)}`;
      const seen: Array<string> = [shown()];
      const stop = watch(shown, (now) => seen.push(now), {flush: 'pre'});
      const flight = flyActionCommitRail(plan);
      let foldedAt = '';
      void flight.foldable.then(() => {
        foldedAt = seen[seen.length - 1];
      });
      await flight.done;
      stop();
      expect(seen, 'the row reads 20, then 17 on the departure, the rating only after').deep.eq(['mc20|tr20', 'mc17|tr20', 'mc17|tr21']);
      expect(foldedAt, 'the surface stood while the card was absorbing the price').not.eq('mc20|tr20');
      expect(actionCommitRailState.phase).eq('idle');
    });

    it('an unseeded plan flies nothing and folds at once', async () => {
      const plan = arm(UNMI, unmiBranch());
      const flight = flyActionCommitRail(plan);
      await flight.foldable;
      await flight.done;
      expect(actionCommitRailState.lastEnd).eq('');
    });

    /* PL-063 — «+N на эту карту» with nothing spent before it: the token lands in the hero's own capsule, which reads
       the old count until that touchdown (never ticking with the view), and the workspace stands to it. */
    it('PL-063: a gain on THIS card with no spend — the capsule reads 0 until the touchdown; the surface held to it', async () => {
      const branch = {
        index: -1, title: '', available: true, renderKeys: [], steps: [],
        effects: [{direction: 'gain', icon: 'fighter', amount: 1, current: 0, resulting: 1, note: 'on this card'}],
      } as ActionPreviewBranch;
      const plan = arm(EAC, branch);
      expect(plan.rail?.holdsSurface, 'the workspace stands to the touchdown').is.true;
      seedActionCommitRail(view({tr: 20, fighters: 0}), view({tr: 20, fighters: 1}));
      expect(actionCommitRailHoldsCapsule(EAC)).is.true;
      const shown = () => 1 - heldCardCapsule(EAC);
      const seen: Array<number> = [shown()];
      const stop = watch(shown, (now) => seen.push(now), {flush: 'sync'});
      const flight = flyActionCommitRail(plan);
      let foldedAt = -1;
      void flight.foldable.then(() => {
        foldedAt = shown();
      });
      await flight.done;
      stop();
      expect(seen, 'the model already reads 1; the capsule says 0 until the fighter lands').deep.eq([0, 1]);
      expect(foldedAt, 'the surface folded only after the touchdown').eq(1);
      expect(heldCardResource('fighter'), 'nothing left for the satellite').eq(0);
    });

    for (const c of [1, 2, 3, 5]) {
      it(`TR28 at ${c}: the capsule reads ${c} → ${c + 1} → ${c - 1} — never ${c - 2}, never below zero; the TR last`, async () => {
        const plan = arm(EAC, eacBranch(c));
        // The model already holds the result: c − 1 fighters, +1 TR.
        seedActionCommitRail(view({tr: 20, fighters: c}), view({tr: 21, fighters: c - 1}));
        expect(actionCommitRailHoldsCapsule(EAC)).is.true;
        const model = c - 1;
        const shown = () => model - heldCardCapsule(EAC);
        const seen: Array<string> = [`${shown()}|tr${heldStock(RATING_RAIL_KEY)}`];
        const stop = watch(() => `${shown()}|tr${heldStock(RATING_RAIL_KEY)}`, (now) => seen.push(now), {flush: 'sync'});
        const flight = flyActionCommitRail(plan);
        let foldedAt = '';
        void flight.foldable.then(() => {
          foldedAt = seen[seen.length - 1];
        });
        await flight.done;
        stop();
        expect(seen, 'the capsule and the rating, sample by sample').deep.eq([`${c}|tr1`, `${c + 1}|tr1`, `${c - 1}|tr1`, `${c - 1}|tr0`]);
        expect(Math.min(...seen.map((s) => Number(s.split('|')[0]))), 'never below c − 1').eq(c - 1);
        expect(foldedAt.split('|')[0], 'the surface folds only once the two have left the card').eq(String(c - 1));
        expect(heldCardResource('fighter'), 'the satellite\'s holds are spent too').eq(0);
      });
    }
  });

  /*
   * PL-064 IN GENERAL — A SPEND IS A DEPARTURE FROM ITS REAL SOURCE (TR29 Spaceship Recycling): the fighter leaves the
   * card the source step chose — its capsule (and its point) tick on the DEPARTURE, never with the view — and the
   * result is born where it landed: the titanium ticks only after, the mech lands on the card the target step chose.
   */
  describe('a SPEND — the source ticks on the departure, the result after the spend lands', () => {
    const SR = CardName.SPACESHIP_RECYCLING;
    const FZ = CardName.FORMULA_ZERO;
    const MS = CardName.MECH_SPORTS;
    const preSteps = [{kind: 'input' as const, input: {type: 'card', title: '', cards: [], min: 1, max: 1} as never, amount: -1, cardResource: 'fighter',
      vpBox: {[FZ]: {from: 1, to: 0}}}];
    const tiView = (p: {fz: number, ms: number, ti: number, vp: number}): PlayerViewModel => {
      const v = view({tr: 20});
      const me = v.thisPlayer as unknown as {tableau: unknown, titanium: number, victoryPointsBreakdown: unknown};
      me.tableau = [{name: SR, resources: 2}, {name: FZ, resources: p.fz}, {name: MS, resources: p.ms}];
      me.titanium = p.ti;
      me.victoryPointsBreakdown = {total: p.vp};
      return v;
    };
    function armSpend(variant: 'A' | 'B'): ActionCommitPlan {
      const branch = variant === 'A' ? {
        index: 0, title: '', available: true, renderKeys: [], steps: [],
        effects: [{direction: 'cost', icon: 'fighter', amount: 1}, {direction: 'gain', icon: 'titanium', amount: 2, current: 0, resulting: 2}],
      } as ActionPreviewBranch : {
        index: 1, title: '', available: true, renderKeys: [],
        steps: [{kind: 'input', input: {type: 'card', title: '', cards: [], min: 1, max: 1} as never, amount: 1, cardResource: 'mech', vpBox: {[MS]: {from: 0, to: 1}}}],
        effects: [{direction: 'cost', icon: 'fighter', amount: 1}, {direction: 'gain', icon: 'mech', amount: 1, note: 'to a card'}],
      } as ActionPreviewBranch;
      const steps = variant === 'B' ? {0: {type: 'card', cards: [MS]}} : {};
      const rail = commitRailPlan(SR, branch, steps, [], {preSteps, preResponses: {0: {type: 'card', cards: [FZ]}}, ownCard: () => true})!;
      const plan: ActionCommitPlan = {sourceCard: SR, kind: 'resources', specs: [], origins: [], rail: {...rail, origins: rail.reward.cause.map(() => ({x: 10, y: 10}))}};
      armActionCommit(plan);
      return plan;
    }

    it('A: Formula Zero reads 1 (and its point) until the fighter leaves, then 0; the titanium only after — the surface folds once the result is born', async () => {
      const plan = armSpend('A');
      seedActionCommitRail(tiView({fz: 1, ms: 0, ti: 0, vp: 21}), tiView({fz: 0, ms: 0, ti: 2, vp: 20}));
      expect(actionCommitRailState.phase).eq('seeded');
      expect(actionCommitRailHoldsCapsule(FZ), 'the source\'s miniature reads the held capsule').is.true;
      const shown = () => `fz${0 - heldCardCapsule(FZ)}|ti${2 - heldStock('titanium')}|vp${20 - heldVictoryPoints()}`;
      const seen: Array<string> = [shown()];
      // 'pre' — what a render sees: the capsule and its point are released in ONE call, never painted apart.
      const stop = watch(shown, (now) => seen.push(now), {flush: 'pre'});
      const flight = flyActionCommitRail(plan);
      let foldedAt = '';
      void flight.foldable.then(() => {
        foldedAt = seen[seen.length - 1];
      });
      await flight.done;
      stop();
      expect(seen, 'the fighter leaves (its point with it), THEN the titanium lands').deep.eq(['fz1|ti0|vp21', 'fz0|ti0|vp20', 'fz0|ti2|vp20']);
      expect(foldedAt, 'the surface stood while the source was a source of a token').not.eq('fz1|ti0|vp21');
    });

    it('B: the mech lands on the card the target step chose — the surface folds only on its touchdown', async () => {
      const plan = armSpend('B');
      seedActionCommitRail(tiView({fz: 1, ms: 0, ti: 0, vp: 21}), tiView({fz: 0, ms: 1, ti: 0, vp: 21}));
      expect(actionCommitRailState.phase).eq('seeded');
      expect([actionCommitRailHoldsCapsule(FZ), actionCommitRailHoldsCapsule(MS)]).deep.eq([true, true]);
      const shown = () => `fz${0 - heldCardCapsule(FZ)}|ms${1 - heldCardCapsule(MS)}|vp${21 - heldVictoryPoints()}`;
      const seen: Array<string> = [shown()];
      // 'pre' — what a render sees: the capsule and its point are released in ONE call, never painted apart.
      const stop = watch(shown, (now) => seen.push(now), {flush: 'pre'});
      const flight = flyActionCommitRail(plan);
      let foldedAt = '';
      void flight.foldable.then(() => {
        foldedAt = seen[seen.length - 1];
      });
      await flight.done;
      stop();
      expect(seen, 'Formula Zero −1 (and its point) on the departure, Mech Sports +1 (and its point) on the touchdown')
        .deep.eq(['fz1|ms0|vp21', 'fz0|ms0|vp20', 'fz0|ms1|vp21']);
      expect(foldedAt, 'the workspace stood until the mech had landed on its card').eq('fz0|ms1|vp21');
    });

    it('reduced motion seeds nothing: the counters tick with the commit', () => {
      reduceMotionOverrideState.enabled = true;
      armSpend('A');
      seedActionCommitRail(tiView({fz: 1, ms: 0, ti: 0, vp: 21}), tiView({fz: 0, ms: 0, ti: 2, vp: 20}));
      expect(actionCommitRailState.phase).eq('idle');
      expect(heldCardCapsule(FZ)).eq(0);
    });

    it('a view that moved the source otherwise holds nothing (named) — the capsule ticks with the commit', () => {
      armSpend('A');
      seedActionCommitRail(tiView({fz: 1, ms: 0, ti: 0, vp: 21}), tiView({fz: 1, ms: 0, ti: 2, vp: 21}));
      expect(actionCommitRailState.phase).eq('idle');
      expect(railRewardState.degraded?.why).eq('mismatch');
    });
  });
});
