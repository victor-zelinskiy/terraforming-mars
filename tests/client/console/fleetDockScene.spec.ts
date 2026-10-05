import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {activeAnimationHoldLabels, blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import {
  armFleetDockScene, armedFleetDockScene, disarmFleetDockScene, endFleetDockScene, fleetDockSceneState, releaseFleetDockHoldWhenGone,
  resetFleetDockScene, seedFleetDockHold, setFleetDockScenePhase, setFleetDockStageCard,
} from '@/client/console/colonyTrade/fleetDockScene';
import {fleetDockScenePlan} from '@/client/console/colonyTrade/fleetDockModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {clearPanelRewardHold, heldStock} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {RATING_RAIL_KEY} from '@/client/console/resourceTransfer/resourceTransferModel';
import {railRewardPending, railRewardState, resetRailRewards} from '@/client/console/resourceTransfer/railReward';
import {fleetDockRewardKey} from '@/client/console/colonyTrade/fleetDockScene';
import {reduceMotionOverrideState} from '@/client/utils/reducedMotion';
import {
  armTradeFleet, detectTradeFleet, endTradeFleet, registerTradeFleetHandle, resetTradeFleet, runTradeFleet,
  setTradeFleetLaunchPending, tradeFleetState,
} from '@/client/console/colonyFleet/consoleTradeFleet';

const DOCK = CardName.WATER_HAULING;

describe('fleetDockScene — the dock\'s scene holds the reward\'s placement (TR06)', () => {
  afterEach(() => {
    resetFleetDockScene();
    resetTradeFleet();
  });

  it('is seeded ONLY while the dock\'s own stage stands — a hold nobody plays is never raised', () => {
    seedFleetDockHold(DOCK);
    expect(fleetDockSceneState.holding, 'no stage').is.false;
    setFleetDockStageCard(DOCK);
    seedFleetDockHold('');
    expect(fleetDockSceneState.holding, 'a colony trade').is.false;
    seedFleetDockHold(DOCK);
    expect(fleetDockSceneState.holding).is.true;
    expect(fleetDockSceneState.phase).eq('seeded');
  });

  it('is a BLOCKING animation hold — the placement\'s admission waits on it — and names itself', () => {
    setFleetDockStageCard(DOCK);
    const before = blockingAnimationHoldCount();
    seedFleetDockHold(DOCK);
    expect(blockingAnimationHoldCount()).eq(before + 1);
    expect(activeAnimationHoldLabels().some((l) => l.startsWith('trade-fleet-dock'))).is.true;
    endFleetDockScene('test');
    expect(blockingAnimationHoldCount()).eq(before);
  });

  it('is released by the END of the leave — the workspace root leaving the document — never by a timer', () => {
    setFleetDockStageCard(DOCK);
    seedFleetDockHold(DOCK);
    const root = document.createElement('div');
    document.body.appendChild(root);
    releaseFleetDockHoldWhenGone(root);
    expect(fleetDockSceneState.phase).eq('conclude');
    expect(fleetDockSceneState.holding, 'the root still paints its leave').is.true;
    root.remove();
    return Promise.resolve().then(() => {
      expect(fleetDockSceneState.holding).is.false;
      expect(fleetDockSceneState.lastEnd).eq('concluded');
    });
  });

  it('a root already gone (or none) releases at once; an interruption ends the scene, idempotently', () => {
    setFleetDockStageCard(DOCK);
    seedFleetDockHold(DOCK);
    releaseFleetDockHoldWhenGone(undefined);
    expect(fleetDockSceneState.holding).is.false;
    seedFleetDockHold(DOCK);
    setFleetDockScenePhase('read');
    endFleetDockScene('stage-unmounted');
    endFleetDockScene('again');
    expect(fleetDockSceneState.lastEnd).eq('stage-unmounted');
    expect(fleetDockSceneState.holding).is.false;
  });
});

describe('fleetDockScene — the plan the stage arms at the commit boundary', () => {
  const LINER = CardName.UNMI_LINER;
  const railPlan = fleetDockScenePlan({effects: [{direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21}], followUps: []});

  afterEach(() => {
    resetFleetDockScene();
    resetTradeFleet();
  });

  it('is read back for ITS card only, and a refused submit voids it', () => {
    armFleetDockScene({card: LINER, plan: railPlan, known: {}});
    expect(armedFleetDockScene(LINER)?.plan.category).eq('rail');
    expect(armedFleetDockScene(DOCK), 'another dock\'s scene never reads it').is.undefined;
    disarmFleetDockScene(DOCK);
    expect(armedFleetDockScene(LINER), 'disarming another card is a no-op').is.not.undefined;
    disarmFleetDockScene(LINER);
    expect(armedFleetDockScene(LINER)).is.undefined;
  });

  it('the scene\'s end voids it — the next trade arms its own', () => {
    setFleetDockStageCard(LINER);
    armFleetDockScene({card: LINER, plan: railPlan, known: {}});
    seedFleetDockHold(LINER);
    expect(fleetDockSceneState.holding, 'the hold stands for every category').is.true;
    setFleetDockScenePhase('reward');
    expect(fleetDockSceneState.phase).eq('reward');
    endFleetDockScene('concluded');
    expect(armedFleetDockScene(LINER)).is.undefined;
  });
});

/*
 * THE RAIL HALF OF THE SCENE (TR26 UNMI Liner): a reward that lands on the rail
 * is HELD there in the apply block — only while the dock's own stage stands,
 * only when the applied view keeps the promise, never under reduced motion —
 * and every way the scene can end leaves nothing held.
 */
describe('fleetDockScene — a reward on the rail is held until its token lands', () => {
  const LINER = CardName.UNMI_LINER;
  const view = (tr: number, mc: number): PlayerViewModel => ({
    id: 'p-viewer',
    thisPlayer: {color: 'blue', terraformRating: tr, megacredits: mc, energy: 0, steel: 0, titanium: 0, plants: 0, heat: 0},
  } as unknown as PlayerViewModel);
  const greens = {
    id: 'greens-tr', source: {kind: 'party', name: 'Greens', owner: 'blue', channel: 'tr-increase'}, certainty: 'exact',
    recipient: {kind: 'you'}, timing: 'immediate', effects: [{direction: 'gain', icon: 'megacredits', amount: 2}], reason: 'r',
  };
  const railPlan = fleetDockScenePlan({
    effects: [{direction: 'gain', icon: 'tr', amount: 1, current: 20, resulting: 21}], followUps: [],
    reactions: [greens] as never,
  });
  const placementPlan = fleetDockScenePlan({
    effects: [{direction: 'gain', icon: 'oceans', amount: 1}, {direction: 'gain', icon: 'tr', amount: 1}],
    followUps: [{kind: 'note', role: 'tradeReward', note: 'placeOcean'}],
  });

  afterEach(() => {
    reduceMotionOverrideState.enabled = false;
    resetFleetDockScene();
    resetRailRewards();
    clearPanelRewardHold();
    resetTradeFleet();
  });

  it('with the stage standing: the rating AND the table\'s answer keep their old values on the rail', () => {
    setFleetDockStageCard(LINER);
    armFleetDockScene({card: LINER, plan: railPlan, known: {}});
    seedFleetDockHold(LINER, view(20, 0), view(21, 2));
    expect(fleetDockSceneState.railHeld).is.true;
    expect(heldStock(RATING_RAIL_KEY), 'the rail paints committed − held').eq(1);
    expect(heldStock('megacredits'), 'the Greens\' M€ waits for its cause').eq(2);
    expect(railRewardPending(fleetDockRewardKey(LINER))).is.true;
  });

  it('NO stage for this card: nothing is held — the counters tick with the commit (a hold nobody plays is never raised)', () => {
    armFleetDockScene({card: LINER, plan: railPlan, known: {}});
    seedFleetDockHold(LINER, view(20, 0), view(21, 2));
    expect(fleetDockSceneState.holding).is.false;
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
    setFleetDockStageCard(DOCK);
    seedFleetDockHold(LINER, view(20, 0), view(21, 2));
    expect(heldStock(RATING_RAIL_KEY), 'another dock\'s stage is not this card\'s').eq(0);
  });

  it('a `placement` scene holds NOTHING on the rail: the TR is the tile\'s, and comes with it', () => {
    setFleetDockStageCard(DOCK);
    armFleetDockScene({card: DOCK, plan: placementPlan, known: {}});
    seedFleetDockHold(DOCK, view(20, 0), view(20, 0));
    expect(fleetDockSceneState.holding, 'the scene\'s own hold stands').is.true;
    expect(fleetDockSceneState.railHeld).is.false;
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
  });

  it('the trade\'s OTHER moves are allowed for: a 9 M€ fee beside the Greens\' +2 is −7 on the row', () => {
    setFleetDockStageCard(LINER);
    armFleetDockScene({card: LINER, plan: railPlan, known: {'stock:megacredits': -9}});
    seedFleetDockHold(LINER, view(20, 12), view(21, 5));
    expect(heldStock('megacredits')).eq(2);
    expect(railRewardState.degraded).is.undefined;
  });

  it('a promise the applied view does not keep is NOT held, and says so', () => {
    setFleetDockStageCard(LINER);
    armFleetDockScene({card: LINER, plan: railPlan, known: {}});
    seedFleetDockHold(LINER, view(20, 0), view(20, 0));
    expect(fleetDockSceneState.holding, 'the scene still plays').is.true;
    expect(fleetDockSceneState.railHeld).is.false;
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
    expect(railRewardState.degraded?.why).eq('mismatch');
  });

  it('no plan was armed (the press outran the preview): the scene holds, the rail does not', () => {
    setFleetDockStageCard(LINER);
    seedFleetDockHold(LINER, view(20, 0), view(21, 2));
    expect(fleetDockSceneState.holding).is.true;
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
  });

  it('reduced motion: the final poses at once — no hold on the rail', () => {
    reduceMotionOverrideState.enabled = true;
    setFleetDockStageCard(LINER);
    armFleetDockScene({card: LINER, plan: railPlan, known: {}});
    seedFleetDockHold(LINER, view(20, 0), view(21, 2));
    expect(fleetDockSceneState.railHeld).is.false;
    expect(heldStock(RATING_RAIL_KEY)).eq(0);
  });

  it('EVERY end of the scene releases the rail: an interrupt, the ceiling, the conclusion', () => {
    for (const reason of ['stage-unmounted', 'expired', 'concluded']) {
      setFleetDockStageCard(LINER);
      armFleetDockScene({card: LINER, plan: railPlan, known: {}});
      seedFleetDockHold(LINER, view(20, 0), view(21, 2));
      expect(heldStock(RATING_RAIL_KEY), reason).eq(1);
      endFleetDockScene(reason);
      expect(heldStock(RATING_RAIL_KEY), reason).eq(0);
      expect(heldStock('megacredits'), reason).eq(0);
      expect(railRewardPending(fleetDockRewardKey(LINER)), reason).is.false;
      expect(fleetDockSceneState.railHeld, reason).is.false;
    }
  });

  it('a second seed while the scene holds changes nothing (an echo frame of the same response)', () => {
    setFleetDockStageCard(LINER);
    armFleetDockScene({card: LINER, plan: railPlan, known: {}});
    seedFleetDockHold(LINER, view(20, 0), view(21, 2));
    seedFleetDockHold(LINER, view(21, 2), view(21, 2));
    expect(heldStock(RATING_RAIL_KEY)).eq(1);
  });
});

describe('consoleTradeFleet — the flight\'s TARGET (a colony or a dock card)', () => {
  afterEach(() => resetTradeFleet());

  it('a CARD target names the card and leaves the colony half empty — no colony claims a dock\'s flight', () => {
    armTradeFleet({kind: 'card', card: DOCK}, 'blue');
    expect(tradeFleetState.target).deep.eq({kind: 'card', card: DOCK});
    expect(tradeFleetState.card).eq(DOCK);
    expect(tradeFleetState.colonyName).eq('');
    expect(detectTradeFleet()).deep.eq({colonyName: '', card: DOCK});
  });

  it('a bare colony name is still a colony target, byte-for-byte as before', () => {
    armTradeFleet(ColonyName.LUNA, 'red');
    expect(tradeFleetState.target).deep.eq({kind: 'colony', colonyName: ColonyName.LUNA});
    expect(tradeFleetState.colonyName).eq(ColonyName.LUNA);
    expect(tradeFleetState.card).eq('');
  });

  it('a response that arrives while the launch is still MEASURING waits for the director — the view never commits under a ship on its pad', async () => {
    armTradeFleet({kind: 'card', card: DOCK}, 'blue');
    setTradeFleetLaunchPending(true);
    detectTradeFleet();
    let resolved = false;
    const gate = runTradeFleet().then(() => {
      resolved = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(resolved, 'no director yet — the gate waits (it used to resolve after 120 ms)').is.false;
    let docked = false;
    registerTradeFleetHandle({dock: (onLand) => {
      docked = true;
      onLand();
    }, release: (onGone) => onGone(), skip: () => undefined});
    await gate;
    expect(docked, 'the parked gate went to the director\'s dock').is.true;
  });

  it('…and the layer\'s «no believable flight» verdict releases a parked gate at once', async () => {
    armTradeFleet(ColonyName.LUNA, 'red');
    setTradeFleetLaunchPending(true);
    detectTradeFleet();
    let resolved = false;
    const gate = runTradeFleet().then(() => {
      resolved = true;
    });
    setTradeFleetLaunchPending(false);
    await gate;
    expect(resolved).is.true;
  });

  it('the landing on a card hands the one-shot settle to the CARD\'s mark', () => {
    armTradeFleet({kind: 'card', card: DOCK}, 'green');
    registerTradeFleetHandle({dock: (onLand) => onLand(), release: (onGone) => onGone(), skip: () => undefined});
    endTradeFleet();
    expect(tradeFleetState.active).is.false;
    expect(tradeFleetState.dockedCard).eq(DOCK);
    expect(tradeFleetState.dockedColonyName).eq('');
  });
});
