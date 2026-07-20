import {expect} from 'chai';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyModel} from '@/common/models/ColonyModel';
import {Color} from '@/common/Color';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  armColonyBuild, detectColonyBuild, runColonyBuild, endColonyBuild,
  abortColonyBuild, resetColonyBuild, isColonyBuildActive, colonyBuildState,
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
