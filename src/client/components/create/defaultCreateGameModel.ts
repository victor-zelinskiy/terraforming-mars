import * as constants from '@/common/constants';
import {RandomBoardOption} from '@/common/boards/RandomBoardOption';
import {DEFAULT_EXPANSIONS} from '@/common/cards/GameModule';
import {RandomMAOptionType} from '@/common/ma/RandomMAOptionType';
import {CreateGameModel} from './CreateGameModel';

/*
 * vize1215 fork — defaults are tuned to the exact JSON template the
 * owner uploads on every match (2 players: Victor green + Nastya pink,
 * Corporate Era + Promo + Venus + Colonies + Prelude + Ares + Delta Project,
 * random-all board with randomized tile locations, alt Venus board,
 * full-pool random milestones/awards, draft on with prelude draft,
 * random first player, hidden timers). Lets the form
 * open in a ready-to-create state with no JSON upload step.
 *
 * Tweak this file (NOT DEFAULT_EXPANSIONS in common/) when the regular
 * game lineup changes — DEFAULT_EXPANSIONS is shared with the server
 * and other call sites that should keep upstream behaviour.
 */
export function defaultCreateGameModel(): CreateGameModel {
  return {
    firstIndex: 1,
    playersCount: 2,
    players: [
      {name: 'Victor', color: 'green', beginner: false, handicap: 0, first: false},
      {name: 'Nastya', color: 'pink', beginner: false, handicap: 0, first: false},
      {name: '', color: 'red', beginner: false, handicap: 0, first: false},
      {name: '', color: 'yellow', beginner: false, handicap: 0, first: false},
      {name: '', color: 'blue', beginner: false, handicap: 0, first: false},
      {name: '', color: 'black', beginner: false, handicap: 0, first: false},
      {name: '', color: 'purple', beginner: false, handicap: 0, first: false},
      {name: '', color: 'orange', beginner: false, handicap: 0, first: false},
    ],
    expansions: {
      ...DEFAULT_EXPANSIONS,
      promo: true,
      venus: true,
      colonies: true,
      prelude: true,
      ares: true,
      deltaProject: true,
    },
    draftVariant: true,
    initialDraft: false,
    randomMA: RandomMAOptionType.ALL,
    modularMA: false,
    randomFirstPlayer: true,
    // Default OFF → opponents' VP are hidden during the game and the premium
    // final-scoring reveal plays at the end. Check "Show real-time VP" at
    // creation to opt into live VP (and the classic instant winner screen).
    showOtherPlayersVP: false,
    // beginnerOption: false,
    showCeosList: false,
    showColoniesList: false,
    showCorporationList: false,
    showPreludesList: false,
    showBannedCards: false,
    showIncludedCards: false,
    customCeos: [],
    customColonies: [],
    customCorporations: [],
    customPreludes: [],
    bannedCards: [],
    includedCards: [],
    board: RandomBoardOption.ALL,
    seed: Math.random(),
    seededGame: false,
    solarPhaseOption: true,
    shuffleMapOption: true,
    aresExtremeVariant: false,
    politicalAgendasExtension: 'Standard',
    undoOption: false,
    showTimers: false,
    fastModeOption: false,
    removeNegativeGlobalEventsOption: false,
    includeFanMA: false,
    startingCorporations: 2,
    soloTR: false,
    clonedGameId: undefined,
    allOfficialExpansions: false,
    requiresVenusTrackCompletion: false,
    requiresMoonTrackCompletion: false,
    moonStandardProjectVariant: false,
    moonStandardProjectVariant1: false,
    altVenusBoard: true,
    escapeVelocityMode: false,
    escapeVelocityThreshold: constants.DEFAULT_ESCAPE_VELOCITY_THRESHOLD,
    escapeVelocityBonusSeconds: constants.DEFAULT_ESCAPE_VELOCITY_BONUS_SECONDS,
    escapeVelocityPeriod: constants.DEFAULT_ESCAPE_VELOCITY_PERIOD,
    escapeVelocityPenalty: constants.DEFAULT_ESCAPE_VELOCITY_PENALTY,
    twoCorpsVariant: false,
    startingCeos: 3,
    startingPreludes: 4,
    testMode: false,
    // NOT "playing with preludes" (that's expansions.prelude + the standard
    // pick 2 of 4 in SelectInitialCards). This flag is the pick-and-pass
    // prelude draft INSIDE the initial draft (Draft.ts) — dead while
    // `initialDraft` is false. The owner's games never draft preludes, and a
    // stray `true` here leaked into payloads (it 500'd the MarsBot create
    // until the server normalization) — keep it OFF unless deliberately
    // drafting.
    preludeDraftVariant: false,
    ceosDraftVariant: false,
  };
}
