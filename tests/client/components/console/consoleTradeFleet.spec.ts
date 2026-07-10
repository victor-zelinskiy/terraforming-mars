import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {
  abortTradeFleet, armTradeFleet, detectTradeFleet, endTradeFleet, isTradeFleetActive,
  registerTradeFleetHandle, resetTradeFleet, runTradeFleet, setTradeFleetPhase, tradeFleetState,
} from '@/client/console/colonyFleet/consoleTradeFleet';

describe('consoleTradeFleet', () => {
  beforeEach(() => resetTradeFleet());
  afterEach(() => resetTradeFleet());

  it('arm sets the flight live synchronously (input gate closes at once)', () => {
    expect(isTradeFleetActive()).to.eq(false);
    armTradeFleet(ColonyName.LUNA, 'blue');
    expect(isTradeFleetActive()).to.eq(true);
    expect(tradeFleetState.phase).to.eq('launch');
    expect(tradeFleetState.colonyName).to.eq(ColonyName.LUNA);
    expect(tradeFleetState.color).to.eq('blue');
  });

  it('detect claims the arm EXACTLY once (a second response cannot re-gate)', () => {
    armTradeFleet(ColonyName.LUNA, 'red');
    const first = detectTradeFleet();
    expect(first).to.not.eq(undefined);
    expect(first?.colonyName).to.eq(ColonyName.LUNA);
    expect(detectTradeFleet()).to.eq(undefined); // already claimed
  });

  it('detect returns undefined when NOT armed (desktop / non-trade submit)', () => {
    expect(detectTradeFleet()).to.eq(undefined);
  });

  it('run docks, then end crossfades (release) before clearing + settle glow', async () => {
    armTradeFleet(ColonyName.TITAN, 'green');
    let dockedCalled = false;
    let releaseCalled = false;
    registerTradeFleetHandle({
      dock: (onLand) => {
        dockedCalled = true;
        onLand(); // the director reports the pixel-perfect landing (gate resolves)
      },
      release: (onGone) => {
        releaseCalled = true;
        onGone(); // the proxy finished crossfading onto the real ship
      },
      skip: () => {},
    });
    detectTradeFleet();
    await runTradeFleet();
    expect(dockedCalled).to.eq(true);
    // Still active until the crossfade completes (proxy over the real ship).
    expect(isTradeFleetActive()).to.eq(true);
    endTradeFleet();
    expect(releaseCalled).to.eq(true);
    expect(isTradeFleetActive()).to.eq(false);
    // The just-traded colony gets the settle glow AFTER the crossfade.
    expect(tradeFleetState.dockedColonyName).to.eq(ColonyName.TITAN);
  });

  it('run resolves even with NO director (degenerate / reduced snap)', async () => {
    armTradeFleet(ColonyName.CERES, 'yellow');
    tradeFleetState.reducedMotion = true;
    detectTradeFleet();
    await runTradeFleet(); // must not hang
    expect(true).to.eq(true);
  });

  it('abort recalls the fleet AND resolves a pending gate (never hangs)', async () => {
    armTradeFleet(ColonyName.PLUTO, 'purple');
    let skipped = false;
    registerTradeFleetHandle({dock: () => {}, release: () => {}, skip: () => {
      skipped = true;
    }});
    detectTradeFleet();
    const gate = runTradeFleet(); // director.dock never calls back (stall)
    abortTradeFleet();
    await gate; // the abort must resolve it
    expect(skipped).to.eq(true);
    expect(isTradeFleetActive()).to.eq(false);
  });

  it('setTradeFleetPhase only applies while active', () => {
    setTradeFleetPhase('transit');
    expect(tradeFleetState.phase).to.eq('idle'); // ignored — not active
    armTradeFleet(ColonyName.LUNA, 'blue');
    setTradeFleetPhase('approach');
    expect(tradeFleetState.phase).to.eq('approach');
  });
});
