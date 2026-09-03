// The ONE NewGameConfig → GameOptions mapping, extracted from ApiCreateGame so
// campaign mission creation (CampaignManager) derives a mission's options
// through exactly the same code path as an ordinary create — settings can't
// drift between the two by construction.
//
// `gameReq.board` must already be resolved to a concrete board;
// `requestedBoard` is the ORIGINAL request (possibly random) so the intent is
// preserved for rematches. The `campaign` contract is deliberately NOT mapped
// here: it is server-forged by CampaignManager only — a client-sent value can
// never reach GameOptions.

import {BoardNameType, NewGameConfig} from '../../common/game/NewGameConfig';
import {isRandomBoardOption} from '../boards/randomBoard';
import {GameOptions} from './GameOptions';

export function gameOptionsFromNewGameConfig(gameReq: NewGameConfig, requestedBoard: BoardNameType): GameOptions {
  return {
    altVenusBoard: gameReq.altVenusBoard,
    aresExtension: gameReq.expansions.ares,
    aresHazards: true, // Not a runtime option.
    aresExtremeVariant: gameReq.aresExtremeVariant,
    bannedCards: gameReq.bannedCards,
    boardName: gameReq.board as GameOptions['boardName'],
    // Remember a RANDOM board request so a rematch re-rolls it (boardName
    // above is already a concrete board); undefined for an explicit pick.
    randomBoardOption: isRandomBoardOption(requestedBoard) ? requestedBoard : undefined,
    // Remember "random first player" so a rematch re-randomizes it too (the
    // form already resolved it into a concrete `first` flag).
    randomFirstPlayer: gameReq.randomFirstPlayer === true,
    ceoExtension: gameReq.expansions.ceo,
    clonedGamedId: gameReq.clonedGamedId,
    coloniesExtension: gameReq.expansions.colonies,
    communityCardsOption: gameReq.expansions.community,
    expansions: gameReq.expansions,
    ceosDraftVariant: gameReq.ceosDraftVariant,
    corporateEra: gameReq.expansions.corpera,
    customCeos: gameReq.customCeos,
    customColoniesList: gameReq.customColoniesList,
    customCorporationsList: gameReq.customCorporationsList,
    customPreludes: gameReq.customPreludes,
    customProjectCards: gameReq.customProjectCards ?? [],
    customBonusCards: gameReq.customBonusCards ?? [],
    draftVariant: gameReq.draftVariant,
    escapeVelocity: gameReq.escapeVelocity,
    fastModeOption: gameReq.fastModeOption,
    testMode: gameReq.testMode ?? false,
    includedCards: gameReq.includedCards,
    includeFanMA: gameReq.includeFanMA,
    initialDraftVariant: gameReq.initialDraft,
    modularMA: gameReq.modularMA,
    moonExpansion: gameReq.expansions.moon,
    moonStandardProjectVariant: gameReq.moonStandardProjectVariant,
    moonStandardProjectVariant1: gameReq.moonStandardProjectVariant1,
    pathfindersExpansion: gameReq.expansions.pathfinders,
    politicalAgendasExtension: gameReq.politicalAgendasExtension,
    prelude2Expansion: gameReq.expansions.prelude2,
    preludeDraftVariant: gameReq.preludeDraftVariant,
    preludeExtension: gameReq.expansions.prelude,
    promoCardsOption: gameReq.expansions.promo,
    randomMA: gameReq.randomMA,
    removeNegativeGlobalEventsOption: gameReq.removeNegativeGlobalEventsOption,
    requiresMoonTrackCompletion: gameReq.requiresMoonTrackCompletion,
    requiresVenusTrackCompletion: gameReq.requiresVenusTrackCompletion,
    showOtherPlayersVP: gameReq.showOtherPlayersVP,
    showTimers: gameReq.showTimers,
    shuffleMapOption: gameReq.shuffleMapOption,
    solarPhaseOption: gameReq.solarPhaseOption,
    soloTR: gameReq.soloTR,
    startingCeos: gameReq.startingCeos,
    startingCorporations: gameReq.startingCorporations,
    startingPreludes: gameReq.startingPreludes,
    starWarsExpansion: gameReq.expansions.starwars,
    turmoilExtension: gameReq.expansions.turmoil,
    twoCorpsVariant: gameReq.twoCorpsVariant,
    underworldExpansion: gameReq.expansions.underworld,
    deltaProjectExpansion: gameReq.expansions.deltaProject,
    undoOption: gameReq.undoOption,
    venusNextExtension: gameReq.expansions.venus,
    automa: gameReq.automa,
  };
}
