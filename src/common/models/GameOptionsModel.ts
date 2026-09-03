import {BoardName} from '../boards/BoardName';
import {RandomMAOptionType} from '../ma/RandomMAOptionType';
import {AgendaStyle} from '../turmoil/Types';
import {CardName} from '../cards/CardName';
import {Expansion} from '../cards/GameModule';
import {EscapeVelocityOptions} from '../game/NewGameConfig';
import {CampaignGameContract} from '../campaign/CampaignGameContract';

export type GameOptionsModel = {
  /** Campaign mode: the PUBLIC mission contract (absent in ordinary games). */
  campaign?: CampaignGameContract,
  aresExtremeVariant: boolean,
  altVenusBoard: boolean,
  boardName: BoardName,
  bannedCards: ReadonlyArray<CardName>;
  expansions: Record<Expansion, boolean>,
  draftVariant: boolean,
  escapeVelocity?: EscapeVelocityOptions,
  fastModeOption: boolean,
  includedCards: ReadonlyArray<CardName>;
  includeFanMA: boolean,
  initialDraftVariant: boolean,
  preludeDraftVariant: boolean,
  ceosDraftVariant: boolean,
  politicalAgendasExtension: AgendaStyle,
  removeNegativeGlobalEvents: boolean,
  showOtherPlayersVP: boolean,
  showTimers: boolean,
  testMode: boolean,
  shuffleMapOption: boolean,
  solarPhaseOption: boolean,
  soloTR: boolean,
  randomMA: RandomMAOptionType,
  requiresMoonTrackCompletion: boolean,
  requiresVenusTrackCompletion: boolean,
  twoCorpsVariant: boolean,
  undoOption: boolean,
}
