import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armColonyBuild, detectColonyBuild, runColonyBuild, endColonyBuild,
  abortColonyBuild, resetColonyBuild, isColonyBuildActive, colonyBuildState,
  clearColonyBuildReceipt, colonyBuildAnswered, setColonyBuildHoming,
} from '@/client/console/colonyBuild/consoleColonyBuild';
import {isBoardCardBonusActive, resetBoardCardBonus} from '@/client/console/boardCardBonus/consoleBoardCardBonus';

function colony(name: ColonyName, colonies: Array<Color>): ColonyModel {
  return {colonies, isActive: true, name, trackPosition: 1, visitor: undefined};
}

function view(colonies: Array<ColonyModel>, color: Color, waitingForType?: string): PlayerViewModel {
  return {
    game: {colonies},
    thisPlayer: {color},
    waitingFor: waitingForType !== undefined ? {type: waitingForType} : undefined,
  } as unknown as PlayerViewModel;
}

describe('consoleColonyBuild', () => {
  beforeEach(() => {
    resetColonyBuild();
    resetBoardCardBonus();
  });
  afterEach(() => {
    resetColonyBuild();
    resetBoardCardBonus();
  });

  /*
   * THE STAGED DOOR (a card that builds by being played — TR25 Exclusive Colony): the flow does not end with the
   * cube. The transaction keeps what the grid will state (the receipt) and answers «is the door's prompt
   * answered» for as long as the flow is past its commit; a LIVE build keeps none of it.
   */
  describe('the two doors', () => {
    const prev = () => view([colony(ColonyName.LUNA, ['red', 'red', 'blue'])], 'blue');
    const next = () => view([colony(ColonyName.LUNA, ['red', 'red', 'blue', 'blue'])], 'blue');

    it('a LIVE build is answered by nothing and leaves no receipt', async () => {
      armColonyBuild(ColonyName.LUNA, 3, 'blue');
      expect(colonyBuildState.door).to.eq('live');
      expect(colonyBuildAnswered()).to.eq(false);
      expect(detectColonyBuild(prev(), next())).to.deep.eq({colonyName: ColonyName.LUNA});
      await runColonyBuild();
      await endColonyBuild();
      expect(colonyBuildState.receipt).to.eq(undefined);
      expect(colonyBuildAnswered()).to.eq(false);
    });

    it('a STAGED build: answered from the press, the berth is the answer\'s, and the landing leaves its receipt', async () => {
      armColonyBuild(ColonyName.LUNA, 3, 'blue', undefined, 'staged');
      expect(colonyBuildState.door).to.eq('staged');
      expect(colonyBuildAnswered(), 'on the wire').to.eq(true);
      expect(detectColonyBuild(prev(), next())).to.deep.eq({colonyName: ColonyName.LUNA});
      expect(colonyBuildState.slotIndex, 'the fourth berth — the server\'s').to.eq(3);
      await runColonyBuild();
      await endColonyBuild();
      expect(isColonyBuildActive()).to.eq(false);
      expect(colonyBuildState.receipt).to.deep.eq({colony: ColonyName.LUNA, slot: 3});
      expect(colonyBuildAnswered(), 'standing as a receipt').to.eq(true);
      setColonyBuildHoming(true);
      expect(colonyBuildAnswered()).to.eq(true);
      clearColonyBuildReceipt();
      expect(colonyBuildState.receipt).to.eq(undefined);
      expect(colonyBuildState.homing).to.eq(false);
      expect(colonyBuildAnswered(), 'the flow is over').to.eq(false);
    });

    it('a STAGED build the answer did not carry (parked / re-asked): aborted at the detect — the door offers again, no receipt', () => {
      armColonyBuild(ColonyName.LUNA, 3, 'blue', undefined, 'staged');
      expect(detectColonyBuild(prev(), prev())).to.eq(undefined);
      expect(isColonyBuildActive()).to.eq(false);
      expect(colonyBuildState.receipt).to.eq(undefined);
      expect(colonyBuildAnswered()).to.eq(false);
    });

    it('a flight that cannot be played NAMES itself — and the next arm starts clean', async () => {
      // No seat is laid out in this environment: the cube has nowhere measurable to land.
      armColonyBuild(ColonyName.LUNA, 3, 'blue');
      expect(colonyBuildState.degraded).to.eq(false);
      detectColonyBuild(prev(), next());
      await runColonyBuild();
      expect(colonyBuildState.degraded, 'said out loud, never a silent «the cube just stands»').to.eq(true);
      await endColonyBuild();
      expect(colonyBuildState.degraded, 'sticky past the scene — a probe reads it afterwards').to.eq(true);
      armColonyBuild(ColonyName.LUNA, 3, 'blue');
      expect(colonyBuildState.degraded).to.eq(false);
    });
  });

  it('arm sets the transaction live synchronously (input gate closes at once)', () => {
    expect(isColonyBuildActive()).to.eq(false);
    armColonyBuild(ColonyName.LUNA, 0, 'red');
    expect(isColonyBuildActive()).to.eq(true);
    expect(colonyBuildState.phase).to.eq('armed');
    expect(colonyBuildState.colonyName).to.eq(ColonyName.LUNA);
    expect(colonyBuildState.slotIndex).to.eq(0);
    expect(colonyBuildState.color).to.eq('red');
  });

  it('detect returns undefined when NOT armed (desktop / non-build submit)', () => {
    expect(detectColonyBuild(view([], 'red'), view([], 'red'))).to.eq(undefined);
  });

  it('detect proves the build + claims the arm EXACTLY once', () => {
    armColonyBuild(ColonyName.LUNA, 0, 'red');
    const first = detectColonyBuild(
      view([colony(ColonyName.LUNA, [])], 'red'),
      view([colony(ColonyName.LUNA, ['red'])], 'red'));
    expect(first).to.not.eq(undefined);
    expect(first?.colonyName).to.eq(ColonyName.LUNA);
    expect(colonyBuildState.slotIndex).to.eq(0);
    // Already claimed — a second response cannot re-gate.
    expect(detectColonyBuild(
      view([colony(ColonyName.LUNA, [])], 'red'),
      view([colony(ColonyName.LUNA, ['red'])], 'red'))).to.eq(undefined);
  });

  it('detect UNWINDS a refused build (the cube never landed)', () => {
    armColonyBuild(ColonyName.LUNA, 0, 'red');
    const proof = detectColonyBuild(
      view([colony(ColonyName.LUNA, ['red'])], 'red'),
      view([colony(ColonyName.LUNA, ['red'])], 'red')); // no growth
    expect(proof).to.eq(undefined);
    expect(isColonyBuildActive()).to.eq(false);
  });

  it('run resolves without hanging (no stage / unmeasurable → degrade)', async () => {
    armColonyBuild(ColonyName.LUNA, 0, 'red');
    detectColonyBuild(view([colony(ColonyName.LUNA, [])], 'red'), view([colony(ColonyName.LUNA, ['red'])], 'red'));
    await runColonyBuild(); // must not hang
    expect(colonyBuildState.phase).to.eq('landed');
  });

  it('abort frees a pending run gate AND resets active (never hangs)', async () => {
    armColonyBuild(ColonyName.LUNA, 0, 'red');
    detectColonyBuild(view([colony(ColonyName.LUNA, [])], 'red'), view([colony(ColonyName.LUNA, ['red'])], 'red'));
    const gate = runColonyBuild();
    abortColonyBuild();
    await gate; // the abort must resolve it
    expect(isColonyBuildActive()).to.eq(false);
  });

  it('a CARD build bonus (Pluto) arms the board-card-bonus cover lift', async () => {
    armColonyBuild(ColonyName.PLUTO, 0, 'red');
    detectColonyBuild(view([colony(ColonyName.PLUTO, [])], 'red'), view([colony(ColonyName.PLUTO, ['red'])], 'red'));
    expect(colonyBuildState.mode).to.eq('card');
    colonyBuildState.reducedMotion = true;
    await runColonyBuild();
    expect(isBoardCardBonusActive()).to.eq(true);
  });

  it('endColonyBuild performs the seamless handoff + finishes', async () => {
    armColonyBuild(ColonyName.LUNA, 0, 'red');
    detectColonyBuild(view([colony(ColonyName.LUNA, [])], 'red'), view([colony(ColonyName.LUNA, ['red'])], 'red'));
    await runColonyBuild();
    await endColonyBuild();
    expect(isColonyBuildActive()).to.eq(false);
  });

  it('reset clears the transaction', () => {
    armColonyBuild(ColonyName.LUNA, 0, 'red');
    resetColonyBuild();
    expect(isColonyBuildActive()).to.eq(false);
    expect(colonyBuildState.phase).to.eq('idle');
    expect(colonyBuildState.colonyName).to.eq('');
  });
});
