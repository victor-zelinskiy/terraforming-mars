import {expect} from 'chai';
import {buildPlayers, buildCreateGamePayloadFromPremiumState} from '../../src/client/components/create/premium/buildCreateGamePayload';
import {PREMIUM_EXPANSIONS} from '../../src/client/components/create/premium/createGameMeta';
import type {PremiumCreateGameState} from '../../src/client/components/create/premium/createGameState';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {BoardName} from '../../src/common/boards/BoardName';

function baseState(): PremiumCreateGameState {
  const selectedExpansions = {} as PremiumCreateGameState['selectedExpansions'];
  for (const e of PREMIUM_EXPANSIONS) {
    selectedExpansions[e.id] = true;
  }
  return {
    gameMode: 'multiplayer',
    botDifficulty: 'normal',
    seatMarsBot: false,
    players: [
      {slot: 0, name: 'Victor', color: 'green', trBoost: 0, isCreator: true},
      {slot: 1, name: 'Nastya', color: 'pink', trBoost: 0, isCreator: false},
    ],
    selectedExpansions,
    mapMode: 'random-all',
    mapId: BoardName.THARSIS,
    rules: {
      draftVariant: true,
      randomMilestonesAwards: true,
      randomBoardTiles: true,
      alternativeVenusBoard: true,
      trBoostEnabled: false,
      showOtherPlayersVP: false,
      testMode: false,
    },
  };
}

describe('buildPlayers', () => {
  it('uses the real slot names + colours, no TR when the mode is off', () => {
    const players = buildPlayers(baseState(), false);
    expect(players.map((p) => p.name)).deep.eq(['Victor', 'Nastya']);
    expect(players.map((p) => p.color)).deep.eq(['green', 'pink']);
    expect(players.every((p) => p.handicap === 0)).eq(true);
    expect(players.filter((p) => p.first)).length(1);
  });

  it('applies per-player TR Boost as handicap when enabled', () => {
    const state = baseState();
    state.rules.trBoostEnabled = true;
    state.players[0].trBoost = 5;
    state.players[1].trBoost = 2;
    const players = buildPlayers(state, false);
    expect(players[0].handicap).eq(5);
    expect(players[1].handicap).eq(2);
  });
});

describe('buildCreateGamePayloadFromPremiumState', () => {
  it('sends real names — never default colour names', () => {
    const payload = buildCreateGamePayloadFromPremiumState(baseState());
    expect(payload.players.map((p) => p.name)).deep.eq(['Victor', 'Nastya']);
  });

  it('overrides in-scope expansions but preserves hidden defaults (turmoil off)', () => {
    const state = baseState();
    state.selectedExpansions.venus = false;
    const payload = buildCreateGamePayloadFromPremiumState(state);
    expect(payload.expansions.venus).eq(false);
    expect(payload.expansions.corpera).eq(true);
    expect(payload.expansions.turmoil).eq(false);
    expect(payload.solarPhaseOption).eq(false);
  });

  it('maps random-all + specific board', () => {
    expect(buildCreateGamePayloadFromPremiumState(baseState()).board).eq(RandomBoardOption.ALL);
    const specific = buildCreateGamePayloadFromPremiumState({...baseState(), mapMode: 'specific', mapId: BoardName.HELLAS});
    expect(specific.board).eq(BoardName.HELLAS);
  });

  it('maps the rule toggles', () => {
    const on = buildCreateGamePayloadFromPremiumState(baseState());
    expect(on.draftVariant).eq(true);
    expect(on.randomMA).eq(RandomMAOptionType.ALL);
    expect(on.shuffleMapOption).eq(true);
    expect(on.altVenusBoard).eq(true); // venus on + rule on

    const off = baseState();
    off.rules.draftVariant = false;
    off.rules.randomMilestonesAwards = false;
    off.rules.randomBoardTiles = false;
    const payload = buildCreateGamePayloadFromPremiumState(off);
    expect(payload.draftVariant).eq(false);
    expect(payload.randomMA).eq(RandomMAOptionType.NONE);
    expect(payload.shuffleMapOption).eq(false);
  });

  it('maps the show-real-time-VP toggle', () => {
    const off = buildCreateGamePayloadFromPremiumState(baseState());
    expect(off.showOtherPlayersVP).eq(false);

    const on = baseState();
    on.rules.showOtherPlayersVP = true;
    expect(buildCreateGamePayloadFromPremiumState(on).showOtherPlayersVP).eq(true);
  });

  it('keeps alt-Venus board off when Venus is disabled even if the rule is on', () => {
    const state = baseState();
    state.selectedExpansions.venus = false;
    state.rules.alternativeVenusBoard = true;
    expect(buildCreateGamePayloadFromPremiumState(state).altVenusBoard).eq(false);
  });

  it('sends test mode only when a seat is taken by admin', () => {
    const state = baseState();
    state.rules.testMode = true;
    expect(buildCreateGamePayloadFromPremiumState(state).testMode).eq(false);

    state.players[1].name = 'Admin';
    expect(buildCreateGamePayloadFromPremiumState(state).testMode).eq(true);

    state.rules.testMode = false;
    expect(buildCreateGamePayloadFromPremiumState(state).testMode).eq(false);
  });

  it('fills hidden legacy options from the central defaults', () => {
    const payload = buildCreateGamePayloadFromPremiumState(baseState());
    expect(payload).to.have.property('undoOption');
    expect(payload).to.have.property('startingCorporations');
    expect(payload.clonedGamedId).eq(undefined);
    expect(payload.escapeVelocity).eq(undefined);
  });
});
