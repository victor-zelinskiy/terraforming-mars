import {Color, PLAYER_COLORS} from '@/common/Color';
import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {BoardNameType, NewGameConfig, NewPlayerModel} from '@/common/game/NewGameConfig';
import {Expansion} from '@/common/cards/GameModule';
import {defaultCreateGameModel} from '@/client/components/create/defaultCreateGameModel';
import {ResolvedPlayerIdentity} from '@/client/components/mainMenu/identity/playerIdentity';
import type {PremiumCreateGameState} from './createGameState';
import {PREMIUM_EXPANSIONS} from './createGameMeta';

/**
 * THE single conversion from premium UI state → the existing `NewGameConfig`
 * payload. Every legacy/hidden option is filled from `defaultCreateGameModel`
 * (the fork's central defaults) so the premium screen never scatters defaults
 * across components and never diverges from the project's create behaviour.
 *
 * Only the premium-controlled fields are overridden: the players (built from the
 * identity + count + TR Boost), the in-scope expansions, the map, the draft
 * variant and the random-milestones/awards toggle.
 */

function defaultColorName(c: Color): string {
  return c.charAt(0).toUpperCase() + c.slice(1);
}

/**
 * Seat 0 is the creator (the resolved identity), carrying their cube colour and
 * the TR Boost (the existing per-player `handicap`). The remaining seats are
 * placeholders other players join, each on the next free colour.
 */
export function buildPlayers(
  identity: ResolvedPlayerIdentity,
  count: number,
  trBoost: number,
  randomFirstPlayer: boolean,
  colorName: (c: Color) => string = defaultColorName,
): Array<NewPlayerModel> {
  const colors: Array<Color> = [identity.cubeColor, ...PLAYER_COLORS.filter((c) => c !== identity.cubeColor)];
  const players: Array<NewPlayerModel> = [];
  for (let i = 0; i < count; i++) {
    const color = colors[i] ?? PLAYER_COLORS[i % PLAYER_COLORS.length];
    players.push({
      name: i === 0 ? identity.displayName : colorName(color),
      color,
      beginner: false,
      handicap: i === 0 ? trBoost : 0,
      first: false,
    });
  }
  // Mirror the legacy form: with random-first-player, a random seat starts;
  // otherwise the creator (seat 0) does. `randomFirstPlayer` is still sent so a
  // rematch re-randomises it.
  const firstIdx = randomFirstPlayer ? Math.floor(Math.random() * count) : 0;
  players[firstIdx].first = true;
  return players;
}

export function buildCreateGamePayloadFromPremiumState(
  state: PremiumCreateGameState,
  identity: ResolvedPlayerIdentity,
  opts: {colorName?: (c: Color) => string} = {},
): NewGameConfig {
  const d = defaultCreateGameModel();
  const players = buildPlayers(identity, state.playerCount, state.trBoost, d.randomFirstPlayer, opts.colorName);

  // Start from the central default expansions, override only the in-scope set.
  const expansions: Record<Expansion, boolean> = {...d.expansions};
  for (const e of PREMIUM_EXPANSIONS) {
    expansions[e.id] = state.selectedExpansions[e.id] === true;
  }

  const board: BoardNameType = state.mapMode === 'random-all' ? RandomBoardOption.ALL : state.mapId;
  const randomMA = state.randomMilestonesAwards ? RandomMAOptionType.ALL : RandomMAOptionType.NONE;

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
    // The Venus solar phase follows the Venus expansion, exactly like the form.
    solarPhaseOption: expansions.venus === true,
    removeNegativeGlobalEventsOption: d.removeNegativeGlobalEventsOption,
    modularMA: d.modularMA,
    draftVariant: state.draftVariant,
    initialDraft: d.initialDraft,
    preludeDraftVariant: d.preludeDraftVariant ?? false,
    ceosDraftVariant: d.ceosDraftVariant ?? false,
    startingCorporations: d.startingCorporations,
    shuffleMapOption: d.shuffleMapOption,
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
    altVenusBoard: d.altVenusBoard,
    escapeVelocity: undefined,
    twoCorpsVariant: d.twoCorpsVariant,
    customCeos: d.customCeos,
    startingCeos: d.startingCeos,
    startingPreludes: d.startingPreludes,
  };
}
