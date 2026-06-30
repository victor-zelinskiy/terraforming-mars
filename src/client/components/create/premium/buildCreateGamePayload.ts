import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {BoardNameType, NewGameConfig, NewPlayerModel} from '@/common/game/NewGameConfig';
import {Expansion} from '@/common/cards/GameModule';
import {defaultCreateGameModel} from '@/client/components/create/defaultCreateGameModel';
import type {PremiumCreateGameState} from './createGameState';
import {PREMIUM_EXPANSIONS} from './createGameMeta';

/**
 * THE single conversion from premium UI state → the existing `NewGameConfig`.
 * Every legacy/hidden option is filled from `defaultCreateGameModel` (the fork's
 * central defaults); only premium-controlled fields are overridden:
 *   - real player slots (names + colours + per-player TR Boost when enabled)
 *   - in-scope expansions
 *   - the map
 *   - the rule toggles (draft / random M&A / random tiles / alt-Venus)
 *
 * Player NAMES are sent verbatim (never a default colour name) — they are the
 * temporary identity key other players match on in the "join" flow.
 */
export function buildPlayers(state: PremiumCreateGameState, randomFirstPlayer: boolean): Array<NewPlayerModel> {
  const players: Array<NewPlayerModel> = state.players.map((slot) => ({
    name: slot.name.trim(),
    color: slot.color,
    beginner: false,
    handicap: state.rules.trBoostEnabled ? slot.trBoost : 0,
    first: false,
  }));
  const firstIdx = randomFirstPlayer ? Math.floor(Math.random() * players.length) : 0;
  players[firstIdx].first = true;
  return players;
}

export function buildCreateGamePayloadFromPremiumState(state: PremiumCreateGameState): NewGameConfig {
  const d = defaultCreateGameModel();
  const players = buildPlayers(state, d.randomFirstPlayer);

  const expansions: Record<Expansion, boolean> = {...d.expansions};
  for (const e of PREMIUM_EXPANSIONS) {
    expansions[e.id] = state.selectedExpansions[e.id] === true;
  }
  const venusOn = expansions.venus === true;

  const board: BoardNameType = state.mapMode === 'random-all' ? RandomBoardOption.ALL : state.mapId;
  const randomMA = state.rules.randomMilestonesAwards ? RandomMAOptionType.ALL : RandomMAOptionType.NONE;

  return {
    players,
    expansions,
    board,
    seed: d.seed,
    randomFirstPlayer: d.randomFirstPlayer,
    clonedGamedId: undefined,
    undoOption: d.undoOption,
    showTimers: d.showTimers,
    fastModeOption: d.fastModeOption,
    showOtherPlayersVP: d.showOtherPlayersVP,
    testMode: d.testMode,
    aresExtremeVariant: d.aresExtremeVariant,
    politicalAgendasExtension: d.politicalAgendasExtension,
    // Venus solar phase follows the Venus expansion, like the legacy form.
    solarPhaseOption: venusOn,
    removeNegativeGlobalEventsOption: d.removeNegativeGlobalEventsOption,
    modularMA: d.modularMA,
    draftVariant: state.rules.draftVariant,
    initialDraft: d.initialDraft,
    preludeDraftVariant: d.preludeDraftVariant ?? false,
    ceosDraftVariant: d.ceosDraftVariant ?? false,
    startingCorporations: d.startingCorporations,
    // "Случайные места для тайлов" maps to the board-shuffle option.
    shuffleMapOption: state.rules.randomBoardTiles,
    randomMA,
    includeFanMA: d.includeFanMA,
    soloTR: d.soloTR,
    customCorporationsList: d.customCorporations,
    bannedCards: d.bannedCards,
    includedCards: d.includedCards,
    customColoniesList: d.customColonies,
    customPreludes: d.customPreludes,
    requiresMoonTrackCompletion: d.requiresMoonTrackCompletion,
    requiresVenusTrackCompletion: d.requiresVenusTrackCompletion,
    moonStandardProjectVariant: d.moonStandardProjectVariant,
    moonStandardProjectVariant1: d.moonStandardProjectVariant1,
    // Alt-Venus board only applies with Venus on; cleanly off otherwise.
    altVenusBoard: venusOn && state.rules.alternativeVenusBoard,
    escapeVelocity: undefined,
    twoCorpsVariant: d.twoCorpsVariant,
    customCeos: d.customCeos,
    startingCeos: d.startingCeos,
    startingPreludes: d.startingPreludes,
  };
}
