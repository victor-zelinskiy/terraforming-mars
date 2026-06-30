import {expect} from 'chai';
import {buildPlayers, buildCreateGamePayloadFromPremiumState} from '../../src/client/components/create/premium/buildCreateGamePayload';
import {PREMIUM_EXPANSIONS} from '../../src/client/components/create/premium/createGameMeta';
import type {PremiumCreateGameState} from '../../src/client/components/create/premium/createGameState';
import {ResolvedPlayerIdentity} from '../../src/client/components/mainMenu/identity/playerIdentity';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';
import {BoardName} from '../../src/common/boards/BoardName';

const IDENTITY: ResolvedPlayerIdentity = {
  displayName: 'Victor',
  normalizedName: 'victor',
  cubeColor: 'green',
  source: 'manual-name',
  temporary: true,
};

function baseState(): PremiumCreateGameState {
  const selectedExpansions = {} as PremiumCreateGameState['selectedExpansions'];
  for (const e of PREMIUM_EXPANSIONS) {
    selectedExpansions[e.id] = true;
  }
  return {
    trBoost: 0,
    playerCount: 2,
    selectedExpansions,
    mapMode: 'random-all',
    mapId: BoardName.THARSIS,
    draftVariant: true,
    randomMilestonesAwards: true,
  };
}

describe('buildPlayers', () => {
  it('seats the identity first with its colour + TR Boost as handicap', () => {
    const players = buildPlayers(IDENTITY, 3, 4, false);
    expect(players).length(3);
    expect(players[0].name).eq('Victor');
    expect(players[0].color).eq('green');
    expect(players[0].handicap).eq(4);
    // other seats: no boost, distinct colours
    expect(players[1].handicap).eq(0);
    expect(players[2].handicap).eq(0);
    expect(new Set(players.map((p) => p.color)).size).eq(3);
  });

  it('marks exactly one first player (seat 0 when not random)', () => {
    const players = buildPlayers(IDENTITY, 4, 0, false);
    expect(players.filter((p) => p.first)).length(1);
    expect(players[0].first).eq(true);
  });

  it('still marks exactly one first player when randomised', () => {
    const players = buildPlayers(IDENTITY, 5, 0, true);
    expect(players.filter((p) => p.first)).length(1);
  });
});

describe('buildCreateGamePayloadFromPremiumState', () => {
  it('maps player count + identity', () => {
    const payload = buildCreateGamePayloadFromPremiumState({...baseState(), playerCount: 4, trBoost: 7}, IDENTITY);
    expect(payload.players).length(4);
    expect(payload.players[0].name).eq('Victor');
    expect(payload.players[0].handicap).eq(7);
  });

  it('overrides in-scope expansions but preserves hidden defaults (turmoil stays off)', () => {
    const state = baseState();
    state.selectedExpansions.venus = false;
    const payload = buildCreateGamePayloadFromPremiumState(state, IDENTITY);
    expect(payload.expansions.venus).eq(false);
    expect(payload.expansions.corpera).eq(true);
    // turmoil is not exposed in the premium grid → keeps the default (off)
    expect(payload.expansions.turmoil).eq(false);
    // solar phase follows the Venus toggle, like the legacy form
    expect(payload.solarPhaseOption).eq(false);
  });

  it('maps random-all + specific board', () => {
    const randomPayload = buildCreateGamePayloadFromPremiumState(baseState(), IDENTITY);
    expect(randomPayload.board).eq(RandomBoardOption.ALL);

    const specific = buildCreateGamePayloadFromPremiumState({...baseState(), mapMode: 'specific', mapId: BoardName.HELLAS}, IDENTITY);
    expect(specific.board).eq(BoardName.HELLAS);
  });

  it('maps the rule toggles', () => {
    const on = buildCreateGamePayloadFromPremiumState(baseState(), IDENTITY);
    expect(on.draftVariant).eq(true);
    expect(on.randomMA).eq(RandomMAOptionType.ALL);

    const off = buildCreateGamePayloadFromPremiumState({...baseState(), draftVariant: false, randomMilestonesAwards: false}, IDENTITY);
    expect(off.draftVariant).eq(false);
    expect(off.randomMA).eq(RandomMAOptionType.NONE);
  });

  it('fills hidden legacy options from the central defaults', () => {
    const payload = buildCreateGamePayloadFromPremiumState(baseState(), IDENTITY);
    // a representative sample of hidden options that must still be present
    expect(payload).to.have.property('undoOption');
    expect(payload).to.have.property('startingCorporations');
    expect(payload).to.have.property('soloTR');
    expect(payload.clonedGamedId).eq(undefined);
    expect(payload.escapeVelocity).eq(undefined);
  });
});
