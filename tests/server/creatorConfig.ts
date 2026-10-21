import {NewGameConfig} from '../../src/common/game/NewGameConfig';
import {Expansion} from '../../src/common/cards/GameModule';
import {RandomBoardOption} from '../../src/common/boards/RandomBoardOption';
import {RandomMAOptionType} from '../../src/common/ma/RandomMAOptionType';

const NONE: Record<Expansion, boolean> = {
  corpera: false, promo: false, venus: false, colonies: false, prelude: false, prelude2: false, turmoil: false,
  community: false, ares: false, moon: false, pathfinders: false, ceo: false, starwars: false, underworld: false,
  deltaProject: false, turmoilRedux: false,
};

/** A creator config (the launch body) with `humans` seats, these expansions on, and the rest at their defaults. */
export function creatorConfig(on: ReadonlyArray<Expansion>, humans = 2, extra: Partial<NewGameConfig> = {}): NewGameConfig {
  const expansions = {...NONE};
  for (const e of on) {
    expansions[e] = true;
  }
  return {
    players: Array.from({length: humans}, (_, i) => ({name: `p${i}`, color: (['blue', 'red', 'green', 'yellow', 'black', 'purple'] as const)[i], beginner: false, handicap: 0, first: i === 0})),
    expansions, board: RandomBoardOption.ALL, seed: 0, randomFirstPlayer: false, clonedGamedId: undefined,
    undoOption: false, showTimers: false, testMode: false, fastModeOption: false, showOtherPlayersVP: false,
    aresExtremeVariant: false, politicalAgendasExtension: 'Standard', solarPhaseOption: false,
    removeNegativeGlobalEventsOption: false, modularMA: false, draftVariant: false, initialDraft: false,
    preludeDraftVariant: false, ceosDraftVariant: false, startingCorporations: 2, shuffleMapOption: false,
    randomMA: RandomMAOptionType.NONE, includeFanMA: false, soloTR: false, customCorporationsList: [], bannedCards: [],
    includedCards: [], customColoniesList: [], customPreludes: [], requiresMoonTrackCompletion: false,
    requiresVenusTrackCompletion: false, moonStandardProjectVariant: false, moonStandardProjectVariant1: false,
    altVenusBoard: false, escapeVelocity: undefined, twoCorpsVariant: false, customCeos: [], startingCeos: 0,
    startingPreludes: 0,
    ...extra,
  };
}

