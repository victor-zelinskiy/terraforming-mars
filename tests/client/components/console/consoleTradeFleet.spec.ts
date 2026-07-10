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

  it('run resolves via the registered director dock, then end hands off', async () => {
    armTradeFleet(ColonyName.TITAN, 'green');
    let dockedCalled = false;
    registerTradeFleetHandle({
      dock: (onDock) => {
        dockedCalled = true;
        onDock(); // the director reports the dock snap finished
      },
      skip: () => {},
    });
    detectTradeFleet();
    await runTradeFleet();
    expect(dockedCalled).to.eq(true);
    endTradeFleet();
    expect(isTradeFleetActive()).to.eq(false);
    // The just-traded colony gets the brief settle-glow marker.
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
    registerTradeFleetHandle({dock: () => {}, skip: () => {
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
