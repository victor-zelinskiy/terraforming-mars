import {expect} from 'chai';
import {CardName} from '@/common/cards/CardName';
import {ColonyName} from '@/common/colonies/ColonyName';
import {activeAnimationHoldLabels, blockingAnimationHoldCount} from '@/client/components/presentation/animationHold';
import {
  endFleetDockScene, fleetDockSceneState, releaseFleetDockHoldWhenGone, resetFleetDockScene, seedFleetDockHold,
  setFleetDockScenePhase, setFleetDockStageCard,
} from '@/client/console/colonyTrade/fleetDockScene';
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
