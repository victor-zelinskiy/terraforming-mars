import {expect} from 'chai';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {activeAnimationHoldLabels, blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import {clearPanelRewardHold, heldProduction, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY, ResourceTransferSpec, railRewardSpecs, railRowKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  flyRailReward, railRewardPending, railRewardState, releaseRailReward, resetRailRewards, seedRailReward, verifyRailReward,
} from '@/client/console/resourceTransfer/railReward';
import {RATING_RAIL_KEY as PARLIAMENT_KEY} from '@/client/console/parliament/parliamentRewardBeat';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';

/*
 * A REWARD ON THE RAIL (`railReward.ts`) — the class beat behind «the TR
 * arrives as a reward, not as a number that changed» (TR26 UNMI Liner is its
 * first owner outside the Parliament). Pinned here: which chips are rail
 * gains, the promise checked against the DIFF of two views, the holds and the
 * ORDER of their release (the cause first, the table's answer one beat after),
 * the named degradation, and that nothing can stay held.
 */
const TR: ResourceTransferSpec = {channel: 'stock', resource: RATING_RAIL_KEY, amount: 1};
const GREENS: ResourceTransferSpec = {channel: 'stock', resource: 'megacredits', amount: 2};
const KEY = 'test-owner';

function view(player: {tr?: number, mc?: number, energy?: number, mcProd?: number}, id = 'p-viewer'): PlayerViewModel {
  return {
    id,
    thisPlayer: {
      color: 'blue',
      terraformRating: player.tr ?? 20,
      megacredits: player.mc ?? 0,
      energy: player.energy ?? 0,
      megacreditProduction: player.mcProd ?? 0,
      steel: 0, titanium: 0, plants: 0, heat: 0,
      steelProduction: 0, titaniumProduction: 0, plantProduction: 0, energyProduction: 0, heatProduction: 0,
    },
  } as unknown as PlayerViewModel;
}

const gain = (icon: string, amount: number, extra: Partial<ActionEffect> = {}): ActionEffect => ({direction: 'gain', icon, amount, ...extra});

describe('railReward — a gain arrives on the rail as a reward', () => {
  afterEach(() => {
    reduceMotionOverrideState.enabled = false;
    resetRailRewards();
    clearPanelRewardHold();
  });

  describe('railRewardSpecs — which of a reward\'s chips are rail gains', () => {
    it('a TR gain rides the stock channel under the rail\'s rating key — the ONE key the Parliament flies too', () => {
      expect(railRewardSpecs([gain('tr', 1, {current: 20, resulting: 21})])).deep.eq([TR]);
      expect(PARLIAMENT_KEY, 'one key, two owners').eq(RATING_RAIL_KEY);
    });

    it('a standard resource: stock on its row, production on its production zone', () => {
      expect(railRewardSpecs([gain('megacredits', 3), gain('titanium', 1, {note: 'production'})])).deep.eq([
        {channel: 'stock', resource: 'megacredits', amount: 3},
        {channel: 'production', resource: 'titanium', amount: 1},
      ]);
    });

    it('never a cost, a card resource, a card draw, a global parameter, an «any resource» unit, a zero', () => {
      expect(railRewardSpecs([
        {direction: 'cost', icon: 'megacredits', amount: 9},
        gain('floater', 2, {note: 'to a card'}),
        gain('cards', 1),
        gain('oceans', 1),
        gain('megacredits', 2, {unit: 'each'} as Partial<ActionEffect>),
        gain('tr', 0),
      ])).deep.eq([]);
    });

    it('two chips of one row are one token', () => {
      expect(railRewardSpecs([gain('tr', 1), gain('tr', 1)])).deep.eq([{...TR, amount: 2}]);
    });
  });

  describe('verifyRailReward — the promise against the applied view', () => {
    it('the row moved by exactly the promise: held', () => {
      const verdict = verifyRailReward({cause: [TR], reactions: []}, view({tr: 20}), view({tr: 21}));
      expect(verdict).deep.eq({cause: [TR], reactions: [], mismatches: []});
    });

    it('the owner\'s KNOWN moves on a row are allowed for: a 9 M€ fee, a +3 flat bonus and the Greens\' +2 are −4', () => {
      const reward = {cause: [TR], reactions: [GREENS], known: {[railRowKey(GREENS)]: -9 + 3}};
      const verdict = verifyRailReward(reward, view({tr: 20, mc: 12}), view({tr: 21, mc: 8}));
      expect(verdict.mismatches).deep.eq([]);
      expect(verdict.reactions).deep.eq([GREENS]);
    });

    it('a REACTION row that disagrees is not held and is named — the cause still is', () => {
      const verdict = verifyRailReward({cause: [TR], reactions: [GREENS]}, view({tr: 20, mc: 0}), view({tr: 21, mc: 5}));
      expect(verdict.cause).deep.eq([TR]);
      expect(verdict.reactions).deep.eq([]);
      expect(verdict.mismatches).deep.eq(['stock:megacredits: expected +2, applied +5']);
    });

    it('a CAUSE row that disagrees holds NOTHING — an answer is never shown after a cause that was not', () => {
      const verdict = verifyRailReward({cause: [TR], reactions: [GREENS]}, view({tr: 20, mc: 0}), view({tr: 22, mc: 2}));
      expect(verdict.cause).deep.eq([]);
      expect(verdict.reactions).deep.eq([]);
      expect(verdict.mismatches).deep.eq(['stock:rating: expected +1, applied +2']);
    });

    it('a production row reads the production field', () => {
      const spec: ResourceTransferSpec = {channel: 'production', resource: 'megacredits', amount: 1};
      expect(verifyRailReward({cause: [spec], reactions: []}, view({mcProd: 2}), view({mcProd: 3})).cause).deep.eq([spec]);
    });

    it('no pair of views of ONE seat (a first view, another seat\'s): nothing is held', () => {
      expect(verifyRailReward({cause: [TR], reactions: []}, undefined, view({tr: 21})).cause).deep.eq([]);
      expect(verifyRailReward({cause: [TR], reactions: []}, view({tr: 20}, 'p-other'), view({tr: 21})).cause).deep.eq([]);
    });
  });

  describe('the holds — seeded in the apply block, released in order, never left standing', () => {
    it('SEED holds every verified row on the rail and raises a BLOCKING hold that names itself', () => {
      const before = blockingAnimationHoldCount();
      expect(seedRailReward(KEY, {cause: [TR], reactions: [GREENS]}, view({tr: 20, mc: 0}), view({tr: 21, mc: 2}))).is.true;
      expect(heldStock(RATING_RAIL_KEY)).eq(1);
      expect(heldStock('megacredits')).eq(2);
      expect(railRewardPending(KEY)).is.true;
      expect(blockingAnimationHoldCount()).eq(before + 1);
      expect(activeAnimationHoldLabels().some((label) => label.startsWith('rail-reward'))).is.true;
      releaseRailReward(KEY, 'test');
      expect(blockingAnimationHoldCount()).eq(before);
    });

    it('a mismatch seeds nothing and is NAMED — the counters tick with the commit', () => {
      expect(seedRailReward(KEY, {cause: [TR], reactions: []}, view({tr: 20}), view({tr: 20}))).is.false;
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(railRewardPending(KEY)).is.false;
      expect(railRewardState.degraded).deep.eq({key: KEY, why: 'mismatch', detail: 'stock:rating: expected +1, applied +0'});
    });

    it('an interrupt releases every row at once, idempotently, and a later flight finds nothing', async () => {
      seedRailReward(KEY, {cause: [TR], reactions: [GREENS]}, view({tr: 20, mc: 0}), view({tr: 21, mc: 2}));
      releaseRailReward(KEY, 'stage-unmounted');
      releaseRailReward(KEY, 'stage-unmounted');
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(heldStock('megacredits')).eq(0);
      expect(railRewardPending(KEY)).is.false;
      expect(await flyRailReward(KEY, () => ({x: 10, y: 10}))).eq('none');
    });

    it('reduced motion: nothing is held and nothing is owed — the final values at once', async () => {
      reduceMotionOverrideState.enabled = true;
      expect(seedRailReward(KEY, {cause: [TR], reactions: [GREENS]}, view({tr: 20, mc: 0}), view({tr: 21, mc: 2}))).is.false;
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(railRewardPending(KEY)).is.false;
      expect(await flyRailReward(KEY, () => ({x: 1, y: 1}))).eq('none');
      expect(railRewardState.degraded, 'reduced motion is not a degradation').is.undefined;
    });

    it('a second seed of one owner never doubles the hold', () => {
      seedRailReward(KEY, {cause: [TR], reactions: []}, view({tr: 20}), view({tr: 21}));
      seedRailReward(KEY, {cause: [TR], reactions: []}, view({tr: 20}), view({tr: 21}));
      expect(heldStock(RATING_RAIL_KEY)).eq(1);
      expect(railRewardState.entries).has.lengthOf(1);
    });

    it('two owners hold one row together and release only their own', () => {
      seedRailReward('a', {cause: [TR], reactions: []}, view({tr: 20}), view({tr: 21}));
      seedRailReward('b', {cause: [TR], reactions: []}, view({tr: 20}), view({tr: 21}));
      expect(heldStock(RATING_RAIL_KEY)).eq(2);
      releaseRailReward('a', 'test');
      expect(heldStock(RATING_RAIL_KEY), 'the other owner\'s token is still owed').eq(1);
    });
  });

  describe('the flight — the cause ticks first, the table\'s answer one beat after; a lost flight names itself', () => {
    it('no measurable row (no rail in this DOM): the token is not flown, the reason is named, the cause ticks NOW and the reaction LATER', async () => {
      seedRailReward(KEY, {cause: [TR], reactions: [GREENS]}, view({tr: 20, mc: 0}), view({tr: 21, mc: 2}));
      const flown = flyRailReward(KEY, () => ({x: 100, y: 100}));
      // The framework resolves a lost flight in its own microtasks: let them run, but no timer.
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(heldStock(RATING_RAIL_KEY), 'the cause has ticked').eq(0);
      expect(heldStock('megacredits'), 'the answer waits for its own beat — never the same tick as its cause').eq(2);
      expect(railRewardPending(KEY)).is.true;
      expect(await flown).eq('degraded');
      expect(heldStock('megacredits')).eq(0);
      expect(railRewardPending(KEY)).is.false;
      expect(railRewardState.degraded).deep.eq({key: KEY, why: 'no-destination', detail: 'stock:rating+1'});
    });

    it('no origin (the paying icon could not be measured): named `no-origin`, nothing hangs', async () => {
      seedRailReward(KEY, {cause: [TR], reactions: []}, view({tr: 20}), view({tr: 21}));
      expect(await flyRailReward(KEY, () => undefined)).eq('degraded');
      expect(heldStock(RATING_RAIL_KEY)).eq(0);
      expect(railRewardState.degraded).deep.eq({key: KEY, why: 'no-origin', detail: 'stock:rating+1'});
      expect(railRewardPending(KEY)).is.false;
    });

    it('an interrupt DURING the answer\'s beat releases the reaction and settles the flight\'s promise', async () => {
      seedRailReward(KEY, {cause: [TR], reactions: [GREENS]}, view({tr: 20, mc: 0}), view({tr: 21, mc: 2}));
      const flown = flyRailReward(KEY, () => ({x: 100, y: 100}));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
      expect(heldStock('megacredits')).eq(2);
      releaseRailReward(KEY, 'stage-unmounted');
      expect(heldStock('megacredits')).eq(0);
      expect(await flown).eq('degraded');
    });

    it('a reward is flown once: a second call for the same owner is `none`', async () => {
      seedRailReward(KEY, {cause: [TR], reactions: []}, view({tr: 20}), view({tr: 21}));
      const first = flyRailReward(KEY, () => ({x: 1, y: 1}));
      expect(await flyRailReward(KEY, () => ({x: 1, y: 1}))).eq('none');
      await first;
    });

    it('a production cause holds the production zone', () => {
      const spec: ResourceTransferSpec = {channel: 'production', resource: 'megacredits', amount: 1};
      seedRailReward(KEY, {cause: [spec], reactions: []}, view({mcProd: 0}), view({mcProd: 1}));
      expect(heldProduction('megacredits')).eq(1);
    });
  });
});
