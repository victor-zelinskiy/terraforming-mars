import {expect} from 'chai';
import {BoardName} from '@/common/boards/BoardName';
import {
  canCreateGame,
  createGameState,
  firstBlocker,
  resetCreateGameState,
  setGameMode,
  setBotDifficulty,
  setSlotName,
  stateAutomaConflicts,
  stateAutomaConflictKeys,
} from '@/client/components/create/premium/createGameState';
import {buildCreateGamePayloadFromPremiumState} from '@/client/components/create/premium/buildCreateGamePayload';

describe('premium create — MarsBot mode', () => {
  beforeEach(() => {
    resetCreateGameState();
  });

  it('multiplayer mode never reports automa conflicts', () => {
    createGameState.config.selectedExpansions.promo = true;
    createGameState.config.rules.randomMilestonesAwards = true;
    expect(stateAutomaConflicts()).is.empty;
  });

  it('marsbot mode keeps exactly one human seat and restores two on switch back', () => {
    expect(createGameState.config.players.length).to.be.gte(2);
    setGameMode('marsbot');
    expect(createGameState.config.players).has.length(1);
    expect(createGameState.config.players[0].isCreator).is.true;
    setGameMode('multiplayer');
    expect(createGameState.config.players).has.length(2);
  });

  it('conflicting options are highlighted and block creation with a readable reason', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.THARSIS;
    expect(canCreateGame()).is.true;

    createGameState.config.selectedExpansions.promo = true;
    createGameState.config.rules.randomBoardTiles = true;
    const keys = stateAutomaConflictKeys();
    expect(keys.has('expansion:promo')).is.true;
    expect(keys.has('rule:randomBoardTiles')).is.true;
    expect(canCreateGame()).is.false;
    expect(firstBlocker()).eq('MarsBot does not support Promos yet');
  });

  it('a non-Tharsis map conflicts in marsbot mode', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.HELLAS;
    expect(stateAutomaConflictKeys().has('board')).is.true;
    expect(canCreateGame()).is.false;

    createGameState.config.mapId = BoardName.THARSIS;
    expect(canCreateGame()).is.true;
  });

  it('the POC set (Tharsis + corpera/prelude/venus/colonies + draft) is clean', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.THARSIS;
    createGameState.config.selectedExpansions.corpera = true;
    createGameState.config.selectedExpansions.prelude = true;
    createGameState.config.selectedExpansions.venus = true;
    createGameState.config.selectedExpansions.colonies = true;
    createGameState.config.rules.draftVariant = true;
    expect(stateAutomaConflicts()).is.empty;
    expect(canCreateGame()).is.true;
  });

  it('the payload carries automa difficulty, one player and no solar phase', () => {
    setGameMode('marsbot');
    setSlotName(0, 'Astronaut');
    setBotDifficulty('brutal');
    createGameState.config.mapMode = 'specific';
    createGameState.config.mapId = BoardName.THARSIS;
    createGameState.config.selectedExpansions.venus = true;

    const payload = buildCreateGamePayloadFromPremiumState(createGameState.config);
    expect(payload.automa).deep.eq({difficulty: 'brutal'});
    expect(payload.players).has.length(1);
    expect(payload.players[0].first).is.true;
    expect(payload.solarPhaseOption).is.false;
    expect(payload.board).eq(BoardName.THARSIS);
  });

  it('a multiplayer payload never carries automa', () => {
    setSlotName(0, 'Astronaut');
    setSlotName(1, 'Botanist');
    const payload = buildCreateGamePayloadFromPremiumState(createGameState.config);
    expect(payload.automa).is.undefined;
    expect(payload.players).has.length(2);
  });
});
