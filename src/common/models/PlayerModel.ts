import {CardModel} from './CardModel';
import {Color} from '../Color';
import {VictoryPointsBreakdown} from '../game/VictoryPointsBreakdown';
import {PlayerInputModel} from './PlayerInputModel';
import {TimerModel} from './TimerModel';
import {GameModel} from './GameModel';
import {PlayerId, ParticipantId} from '../Types';
import {CardName} from '../cards/CardName';
import {Resource} from '../Resource';
import {CardResource} from '../CardResource';
import {PartyName} from '../turmoil/PartyName';
import {Agenda} from '../turmoil/Types';
import {Tag} from '../cards/Tag';
import {UnderworldPlayerData} from '../underworld/UnderworldPlayerData';
import {GlobalParameter} from '../GlobalParameter';
import {DeltaProjectPlayerModel} from './DeltaProjectPlayerModel';
import {CardDrawRevealModel} from './CardDrawRevealModel';
import {RevealResultModel} from './RevealResultModel';
import {EnergyHeatConversionModel} from './EnergyHeatConversionModel';
import {OceanAdjacencyBonusModel} from './OceanAdjacencyBonusModel';
import {StartingSetupModel} from './StartingSetupModel';
import {ColonyTradeManifestModel} from './ColonyTradeManifestModel';
import {PotentialActionsModel} from './PotentialActionsModel';

export interface ViewModel {
  game: GameModel;
  players: Array<PublicPlayerModel>;
  id?: ParticipantId;
  thisPlayer: PublicPlayerModel | undefined;
  runId: string;
}

type AlliedPartyModel = {
  partyName: PartyName;
  agenda: Agenda;
};

// 'off': Resources (or production) are unprotected.
// 'on': Resources (or production) are protected.
// 'half': Half resources are protected when targeted. Applies to Botanical Experience.
export type Protection = 'off' | 'on' | 'half';

/** The public information about a player */
export type PublicPlayerModel = {
  actionsTakenThisRound: number;
  actionsThisGeneration: ReadonlyArray<CardName>;
  actionsTakenThisGame: number;
  alliedParty?: AlliedPartyModel;
  availableBlueCardActionCount: number;
  cardCost: number;
  cardDiscount: number;
  cardsInHandNbr: number;
  citiesCount: number;
  coloniesCount: number;
  color: Color;
  deltaProject?: DeltaProjectPlayerModel;
  /** True for the MarsBot (Automa) seat — its automa state rides GameModel.automa. */
  isMarsBot?: boolean;
  energy: number;
  energyProduction: number;
  fleetSize: number;
  handicap: number | undefined;
  heat: number;
  heatProduction: number;
  id: PlayerId | undefined;
  influence: number;
  isActive: boolean;
  // True iff the server currently has a pending PlayerInput for this player
  // (i.e. `player.getWaitingFor() !== undefined`). The authoritative source
  // of truth for "the table is waiting on this player to do something" — the
  // cube animation and status label both use it instead of phase-derived
  // heuristics, which can stay stale across phase transitions.
  isWaitingForInput: boolean;
  // Kind of prompt the player is currently being asked to resolve, when it
  // matches one of the distinguishable cross-phase prompts. Lets the status
  // label show e.g. "ПОДДЕРЖКА" (World Government Terraforming) vs.
  // "ДЕЛЕГАТ" (Turmoil delegate placement) instead of a generic catch-all.
  // Undefined for plain phase-derived prompts (action / drafting / research).
  waitingForKind?: 'globalsupport' | 'delegate';
  /** Card-granted bonus actions still owed, INCLUDING the one being taken now
   *  (undefined when none). Public so an opponent's chip can read «БОНУСНОЕ
   *  ДЕЙСТВИЕ 1/2» instead of a generic phase label. */
  bonusActions?: number;
  /** How many the granting card handed out — the `M` of the `N/M` readout. */
  bonusActionsGranted?: number;
  /** The card that granted them — the stage's subject while the player is
   *  mid-action and no prompt carries the marker. */
  bonusActionSource?: CardName;
  lastCardPlayed?: CardName;
  megacredits: number;
  megacreditProduction: number;
  name: string;
  needsToDraft: boolean | undefined;
  needsToResearch: boolean | undefined;
  noTagsCount: number;
  plants: number;
  // Effective plant cost to convert plants into a greenery for this player
  // — usually 8, dropped to 7 by Ecoline / Soil Detoxification, can change
  // mid-game when those effects come into play. Exposed so the client's
  // "Convert plants" action button can show the right cost in its label.
  plantsNeededForGreenery: number;
  // Effective heat cost to raise temperature by 1 step. Usually 8 in the
  // base game; lowered to 6 while the Turmoil Kelvinists `kp03` policy is
  // in effect (server swaps the action entirely). Exposed so the convert-
  // heat button shows the right number even when the policy is active.
  heatNeededForTemperature: number;
  // True iff the standard Convert Plants action is offerable to this player
  // RIGHT NOW: they're in the action-selection phase AND `ConvertPlants.canAct`
  // returns true (enough plants, a valid greenery space exists, reds tax is
  // affordable). Computed server-side so the client never has to walk the
  // waitingFor tree or re-derive prerequisites — same source of truth that
  // controls whether the legacy radio-button option appears in the menu.
  canConvertPlants: boolean;
  // Same idea for Convert Heat — accounts for the Kelvinists kp03 variant so
  // the button is enabled iff the matching server-side action would be in
  // the menu.
  canConvertHeat: boolean;
  // The global "Гидросеть" (Delta Project) advance action is available this turn.
  // = `potentialActions.hydroAdvance` AND the player's action window is live.
  canAdvanceDelta?: boolean;
  /**
   * The TURN-INDEPENDENT availability projection — what this player COULD do if
   * it were their window right now (see {@link PotentialActionsModel}). Present
   * on the viewer's OWN model only. Drives the action wheel's green counts,
   * which must not move when the turn does.
   */
  potentialActions?: PotentialActionsModel;
  plantProduction: number;
  protectedResources: Record<Resource, Protection>;
  protectedProduction: Record<Resource, Protection>;
  /**
   * Protection of the resources stored ON THIS PLAYER'S CARDS, by resource
   * type — today Protected Habitats' blanket shield over every animal and
   * microbe they hold (`RemoveResourcesFromCard` filters exactly those out of
   * an opponent's target list). Only PROTECTED types appear; an absent key
   * means «not protected», so a new source is one entry, never a migration.
   *
   * Per-CARD protection (Pets, Bioengineering Enclosure) is not here — it is
   * a printed property of the card and rides `CardModel.protectedResources`,
   * so a surface that aggregates several holders can tell «all of this stock
   * is shielded» from «part of it is».
   */
  protectedCardResources: Partial<Record<CardResource, Protection>>;
  tableau: ReadonlyArray<CardModel>;
  selfReplicatingRobotsCards: Array<CardModel>;
  steel: number;
  steelProduction: number;
  steelValue: number;
  // Standing "may pay with X" grants that no tableau NUMBER carries — the
  // server-authoritative mirrors of the engine's own payment flags (Helion's
  // heat, Luna Trade Federation's titanium-anywhere, Martian Lumber Corp's
  // plants). Exposed so passive surfaces (the console left rail's payment
  // value badges) can state a rate WITHOUT an active payment prompt, from the
  // same source `Player.payingAmount` charges by. Public on purpose: each
  // flag is derivable from the public tableau, so this leaks nothing.
  canUseHeatAsMegaCredits: boolean;
  canUseTitaniumAsMegacredits: boolean;
  canUsePlantsAsMegacredits: boolean;
  tags: Record<Tag, number>
  terraformRating: number;
  timer: TimerModel;
  titanium: number;
  titaniumProduction: number;
  titaniumValue: number;
  tradesThisGeneration: number;
  // Total colony-track trade OFFSET this player has (Σ behavior.colonies.tradeOffset —
  // Trade Agent / Trading Colony / Trade Envoys). When > 0 a trade FIRST advances the
  // colony's track by this much, so the player gets the reward at the HIGHER position.
  // Exposed so the trade-confirm modal can show "track +N → better reward".
  colonyTradeOffset: number;
  underworldData: UnderworldPlayerData,
  victoryPointsBreakdown: VictoryPointsBreakdown;
  victoryPointsByGeneration: ReadonlyArray<number>;
  globalParameterSteps: Partial<Record<GlobalParameter, number>>;
}

/** A player's view of the game, including their secret information. */
export interface PlayerViewModel extends ViewModel {
  autopass: boolean;
  cardsInHand: ReadonlyArray<CardModel>;
  dealtCorporationCards: ReadonlyArray<CardModel>;
  dealtPreludeCards: ReadonlyArray<CardModel>;
  dealtProjectCards: ReadonlyArray<CardModel>;
  dealtCeoCards: ReadonlyArray<CardModel>;
  draftedCards: ReadonlyArray<CardModel>;
  id: PlayerId;
  ceoCardsInHand: ReadonlyArray<CardModel>;
  pickedCorporationCard: ReadonlyArray<CardModel>; // Why Array?
  // CAMPAIGN, self-only: the project cards carried from the previous mission
  // («Наследие проектов») — face-up in the OWNER's own deployment queue from
  // the first frame. Never present on shared/other-player models; undefined
  // outside campaigns (the ordinary wire shape is untouched).
  campaignCarriedCards?: ReadonlyArray<CardModel>;
  preludeCardsInHand: ReadonlyArray<CardModel>;
  // Corporations whose MANDATORY first action this player still owes (server's
  // `pendingInitialActions`, projected to names). Self-only — corp identity is
  // already public via the tableau, so this leaks nothing; it only signals WHEN
  // the start-of-game corp action is still outstanding. Drives the Start Game
  // Flow modal's corp area + its final "begin the game" gate.
  pendingInitialActions: ReadonlyArray<CardName>;
  thisPlayer: PublicPlayerModel;
  waitingFor: PlayerInputModel | undefined;
  // Batches of cards the player just drew via an in-game effect / tile bonus,
  // awaiting the player's "take" acknowledgement in the reveal modal. Empty in
  // the common case. See CardDrawRevealModel.
  cardDrawReveals: ReadonlyArray<CardDrawRevealModel>;
  // The result of the player's most recent REVEAL / DECK-CHECK action (SearchFor-
  // Life / AsteroidDeflectionSystem) — the revealed card + whether the condition
  // fired + the reward. Self-only, transient (cleared on the next action). Drives
  // the premium reveal-result overlay. Absent in the common case. See RevealResultModel.
  lastReveal?: RevealResultModel;
  // Self-only, transient (cleared on the next input): the energy→heat conversion
  // that just happened during this player's production phase ("all energy turns
  // into heat at the end of the generation", or the Supercapacitors chosen
  // amount). Drives the premium paired "Energy −X → Heat +X" transition
  // animation. Absent whenever no energy was converted. See EnergyHeatConversionModel.
  energyHeatConversion?: EnergyHeatConversionModel;
  // Self-only, transient (cleared on the next input): the ocean-adjacency M€ the
  // player just earned by placing a tile next to oceans, broken down to the
  // PAYING neighbour spaces. The rule is applied server-side; this only names
  // the sources so the premium placement scene can materialize one M€ coin per
  // triggered ocean instead of re-deriving board adjacency client-side. Absent
  // whenever a placement earned no ocean bonus. See OceanAdjacencyBonusModel.
  lastOceanBonus?: OceanAdjacencyBonusModel;
  // Self-only, transient (cleared on the next input): the start-of-game setup the
  // corporation just applied — its starting bonuses + the M€ paid for the bought
  // project cards, over the pre-corp baseline. Drives the premium start flow's
  // explicit "apply corporation" / "pay for cards" reveal stages (delta chips on
  // the left panel). Present only on the ceremony view of generation 1. See
  // StartingSetupModel.
  startingSetup?: StartingSetupModel;
  // Self-only, transient: the atomic reward manifest of this player's most
  // recent colony trade — trade income at the PRE-reset track position, the
  // per-cube colony bonuses + recipients, and the track positions before /
  // after the reset. Persists until the next trade overwrites it; the client
  // de-duplicates by tradeId and only ever plays a trade it armed itself at
  // its own confirm press. Drives the console premium trade orchestration.
  // See ColonyTradeManifestModel.
  colonyTradeManifest?: ColonyTradeManifestModel;
  // Self-only: what claiming a milestone / funding the NEXT award costs THIS
  // player right now — the engine's own `milestoneCost()` / `awardFundingCost()`,
  // so every rule that moves them is already applied (Van Allen and Nirgal
  // Enterprises make them free, Staged Protests adds 8, and the award price
  // climbs 8 → 14 → 20 with each funding). The UI must never re-derive a price
  // from constants: it would go on offering a stale number the server refuses.
  maCosts?: MaCostsModel;
}

/** The live claim/fund prices for the viewer (see `PlayerViewModel.maCosts`). */
export type MaCostsModel = {
  milestone: number;
  award: number;
};
