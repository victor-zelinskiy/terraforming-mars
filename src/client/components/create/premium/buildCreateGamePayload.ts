import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {BoardNameType, NewGameConfig, NewPlayerModel} from '@/common/game/NewGameConfig';
import {Expansion} from '@/common/cards/GameModule';
import {defaultCreateGameModel} from '@/client/components/create/defaultCreateGameModel';
import {adminUnlocked} from './createGameState';
import type {GuaranteedCardPicks, GuaranteedPickList, PremiumCreateGameState} from './createGameState';
import {PREMIUM_EXPANSIONS} from './createGameMeta';

const GUARANTEED_LISTS: ReadonlyArray<GuaranteedPickList> = ['corporations', 'preludes', 'projects'];
const NO_GUARANTEED_CARDS: GuaranteedCardPicks = {corporations: [], preludes: [], projects: []};

/**
 * THE single conversion from premium UI state → the existing `NewGameConfig`.
 * Every legacy/hidden option is filled from `defaultCreateGameModel` (the fork's
 * central defaults); only premium-controlled fields are overridden:
 *   - real player slots (names + colours + per-player TR Boost when enabled)
 *   - in-scope expansions
 *   - the map
 *   - the rule toggles (draft / random M&A / random tiles / real-time VP / alt-Venus)
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
  const marsBot = state.gameMode === 'marsbot';
  // Mode B (§12 Q14): the bot seated as an EXTRA participant of the ordinary
  // multiplayer party. Either way the bot seat itself is created by the server.
  const botSeated = marsBot || (state.gameMode === 'multiplayer' && state.seatMarsBot === true);

  // The development switch only exists for the admin seat — a toggle left over
  // from an admin session (persisted setup) can never leak into a real party.
  const testMode = adminUnlocked(state) && state.rules.testMode;
  // Guaranteed cards are a SUB-setting of test mode: off with it, always.
  const guaranteed = testMode ? state.guaranteedCards : NO_GUARANTEED_CARDS;
  const hasGuaranteed = GUARANTEED_LISTS.some((list) => guaranteed[list].length > 0);
  // Those cards ride the TOP of each deck, so they land in the FIRST hand dealt
  // — which is the first player's. A random first player would hand a dev's
  // picks to someone else half the time, so pin the creator instead. Dev branch
  // only: an ordinary party keeps the random first player untouched.
  const randomFirstPlayer = hasGuaranteed ? false : d.randomFirstPlayer;
  const players = buildPlayers(state, randomFirstPlayer);

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
    randomFirstPlayer,
    clonedGamedId: undefined,
    undoOption: d.undoOption,
    showTimers: d.showTimers,
    fastModeOption: d.fastModeOption,
    showOtherPlayersVP: state.rules.showOtherPlayersVP,
    testMode,
    aresExtremeVariant: d.aresExtremeVariant,
    politicalAgendasExtension: d.politicalAgendasExtension,
    // Venus solar phase follows the Venus expansion, like the legacy form.
    // With the bot seated (either mode): never — the Government Intervention
    // bonus card plays the WGT role per the official Automa rules (the server
    // rejects the combination).
    solarPhaseOption: venusOn && !botSeated,
    removeNegativeGlobalEventsOption: d.removeNegativeGlobalEventsOption,
    modularMA: d.modularMA,
    draftVariant: state.rules.draftVariant,
    // SOLO MarsBot: the start-of-game draft variants degenerate with one human
    // (the server normalizes them off too) — never send the form defaults
    // (the fork's template ships with the prelude draft ON). Mode B keeps
    // them: the humans draft among themselves, the bot stays out (§12 Q8).
    initialDraft: marsBot ? false : d.initialDraft,
    preludeDraftVariant: marsBot ? false : (d.preludeDraftVariant ?? false),
    ceosDraftVariant: marsBot ? false : (d.ceosDraftVariant ?? false),
    startingCorporations: d.startingCorporations,
    // "Случайные места для тайлов" maps to the board-shuffle option.
    shuffleMapOption: state.rules.randomBoardTiles,
    randomMA,
    includeFanMA: d.includeFanMA,
    soloTR: d.soloTR,
    // Guaranteed picks ride the server's "cards on top of the deck" lists, so a
    // dev-chosen card lands in the first hand. They EXTEND the defaults rather
    // than replace them (the fork ships both empty, but that stays true here).
    customCorporationsList: [...d.customCorporations, ...guaranteed.corporations],
    bannedCards: d.bannedCards,
    includedCards: d.includedCards,
    customColoniesList: d.customColonies,
    customPreludes: [...d.customPreludes, ...guaranteed.preludes],
    customProjectCards: [...guaranteed.projects],
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
    // The bot seat is created by the server; the server also derives the
    // official-solo vs multiplayer mode from the seat count.
    automa: botSeated ? {difficulty: state.botDifficulty} : undefined,
  };
}
