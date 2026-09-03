import {PlayerId} from '../common/Types';
import {PendingBonusGain} from '../common/BonusGain';
import {CardName} from '../common/cards/CardName';
import {Color} from '../common/Color';
import {SerializedCard} from './SerializedCard';
import {SerializedTimer} from '../common/SerializedTimer';
import {AlliedParty} from '../common/turmoil/Types';
import {GlobalParameter} from '../common/GlobalParameter';
import {TRSourceEntry} from '../common/game/VictoryPointsBreakdown';
import {DiscordId} from './server/auth/discord';
import {UnderworldPlayerData} from '../common/underworld/UnderworldPlayerData';
import {DeltaProjectPlayerModel} from '../common/models/DeltaProjectPlayerModel';

interface DeprecatedFields {
}

export interface SerializedPlayer extends DeprecatedFields{
  actionsTakenThisGame: number;
  actionsTakenThisRound: number;
  availableActionsThisRound?: number;
  /** Card-granted bonus actions still owed (Head Start). Absent on saves made
   *  before bonus actions existed → 0. */
  bonusActions?: number;
  bonusActionsGranted?: number;
  bonusActionSource?: CardName;
  /** Gains whose timing the player chooses (Head Start). Absent → none. */
  pendingBonusGains?: Array<PendingBonusGain>;
  actionsThisGeneration: Array<CardName>;
  alliedParty: AlliedParty | undefined;
  autoPass: boolean;
  beginner: boolean;
  /** MarsBot (Automa) seat marker. Absent in ordinary saves → false. */
  isMarsBot?: boolean;
  canUseHeatAsMegaCredits: boolean;
  canUseTitaniumAsMegacredits: boolean;
  canUsePlantsAsMegaCredits: boolean;
  /**
   * The BASE buy-to-hand price (`Player.baseCardCost`) — 3 M€ or the
   * corporation's replacement. Permanent per-card modifiers are NOT stored
   * here: they are re-derived from the tableau by `Player.cardCost`, so a
   * reload can never apply one twice. Older saves wrote the same number (no
   * card modified it before), so they restore unchanged.
   */
  cardCost: number;
  cardDiscount: number;
  cardsInHand: Array<CardName>;
  ceoCardsInHand: Array<CardName>;
  colonyTradeDiscount: number;
  colonyTradeOffset: number;
  colonyVictoryPoints: number;
  color: Color;
  dealtCorporationCards: Array<CardName>;
  dealtCeoCards: Array<CardName>;
  dealtPreludeCards: Array<CardName>;
  dealtProjectCards: Array<CardName>;
  deltaProject?: DeltaProjectPlayerModel;
  draftedCards: Array<CardName>;
  draftHand: Array<CardName>,
  energy: number;
  energyProduction: number;
  fleetSize: number;
  globalParameterSteps: Record<GlobalParameter, number>;
  handicap: number;
  hasIncreasedTerraformRatingThisGeneration: boolean;
  hasTurmoilScienceTagBonus: boolean;
  heat: number;
  heatProduction: number;
  id: PlayerId;
  jovianTagCount: number;
  lastCardPlayed?: CardName;
  megaCreditProduction: number;
  megaCredits: number;
  name: string;
  needsToDraft: boolean | undefined;
  oceanBonus: number;
  pendingInitialActions: Array<CardName> | undefined;
  pickedCorporationCard: CardName | undefined;
  /** Campaign mode: immutable campaign seat index. Absent in ordinary saves. */
  campaignSeat?: number;
  /** Campaign mode: PRIVATE carried project cards. Absent in ordinary saves. */
  campaignCarriedCards?: Array<CardName>;
  /** Campaign mode: carried cards already granted to the hand. Absent → false. */
  campaignCarriedGranted?: boolean;
  /** Initial-cards selection completed (needed by the corp-less final mission). Absent → false. */
  initialCardSelectionDone?: boolean;
  plantProduction: number;
  plants: number;
  plantsNeededForGreenery: number;
  plantTagCount: number;
  playedCards: Array<SerializedCard>;
  politicalAgendasActionUsedCount: number;
  preludeCardsInHand: Array<CardName>;
  preservationProgram: boolean;
  removedFromPlayCards: Array<CardName>;
  removingPlayers: Array<PlayerId>;
  scienceTagCount: number;
  standardProjectsThisGeneration: Array<CardName>;
  steel: number;
  steelProduction: number;
  steelValue: number;
  terraformRating: number;
  terraformRatingFromCards?: number;
  terraformRatingSources?: ReadonlyArray<TRSourceEntry>;
  timer: SerializedTimer;
  titanium: number;
  titaniumProduction: number;
  titaniumValue: number;
  totalDelegatesPlaced: number;
  tradesThisGeneration: number;
  trThisGeneration: number;
  turmoilPolicyActionUsed: boolean;
  underworldData: UnderworldPlayerData;
  victoryPointsByGeneration: Array<number>;
  user?: DiscordId;
  warmongerCards: number;
  withinDeflectionZone: boolean;
}
