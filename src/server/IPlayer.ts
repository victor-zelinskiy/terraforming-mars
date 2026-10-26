import {PlayerId, isPlayerId} from '../common/Types';
import {PendingBonusGain} from '../common/BonusGain';
import {CardName} from '../common/cards/CardName';
import {ICorporationCard} from './cards/corporation/ICorporationCard';
import {IGame, isIGame} from './IGame';
import {Payment, PaymentOptions} from '../common/inputs/Payment';
import {EventSource} from '../common/events/EventSource';
import {SpendableCardResource} from '../common/inputs/Spendable';
import {ICard, IActionCard} from './cards/ICard';
import {TRSource} from '../common/cards/TRSource';
import {IProjectCard} from './cards/IProjectCard';
import {IPreludeCard} from './cards/prelude/IPreludeCard';
import {PlayerInput} from './PlayerInput';
import {Resource} from '../common/Resource';
import {CardResource} from '../common/CardResource';
import {Priority} from './deferredActions/Priority';
import {SerializedPlayer} from './SerializedPlayer';
import {Timer} from '../common/Timer';
import {AllOptions, DrawOptions} from './deferredActions/DrawCards';
import {Units} from '../common/Units';
import {GlobalParameter} from '../common/GlobalParameter';
import {InputResponse} from '../common/inputs/InputResponse';
import {Tags} from './player/Tags';
import {Colonies} from './player/Colonies';
import {Production} from './player/Production';
import {ICeoCard} from './cards/ceos/ICeoCard';
import {TRSourceEntry, TRSourceType, VictoryPointsBreakdown} from '../common/game/VictoryPointsBreakdown';
import {Color} from '../common/Color';
import {OrOptions} from './inputs/OrOptions';
import {Stock} from './player/Stock';
import {UnderworldPlayerData} from '../common/underworld/UnderworldPlayerData';
import {DeltaProjectPlayerModel} from '../common/models/DeltaProjectPlayerModel';
import {CardDrawRevealSource, CardIntakePendingAnswer, ColonyTradeRevealRole, DrawSearchModel} from '../common/models/CardDrawRevealModel';
import {ColonyTradeManifestModel} from '../common/models/ColonyTradeManifestModel';
import {ExternalDrawCause} from '../common/models/ExternalDrawPromptModel';
import {RevealResultModel} from '../common/models/RevealResultModel';
import {EnergyHeatConversionModel} from '../common/models/EnergyHeatConversionModel';
import {ProductionIncomeModel} from '../common/models/ProductionIncomeModel';
import {OceanAdjacencyBonusModel} from '../common/models/OceanAdjacencyBonusModel';
import {PlacementLawPayoutModel} from '../common/models/PlacementLawPayoutModel';
import {TileMoveRewardModel} from '../common/models/TileMoveRewardModel';
import {StartingSetupModel} from '../common/models/StartingSetupModel';
import {AlliedParty} from '../common/turmoil/Types';
import {IParty} from './turmoil/parties/IParty';
import {Message} from '../common/logs/Message';
import {DiscordId} from './server/auth/discord';
import {PlayedCards} from './cards/PlayedCards';
import {From} from './logs/From';
import type {CardResourceBasis} from '../common/events/EventImpact';
import {Tag} from '../common/cards/Tag';
import {SelectStandardProjectToPlay} from './inputs/SelectStandardProjectToPlay';
import {ResolutionId} from '../common/parliament/ParliamentTypes';

/**
 * Represents additional costs a player must pay to execute an action.
 *
 * For instance, when finding a space to place a tile, it has to take into account
 * that the player must also pay some additional costs (e.g. additional TR from the
 * card's action, or resources they have to spend.)
 */
export type CanAffordOptions = Partial<PaymentOptions> & {
  cost: number,
  reserveUnits?: Units,
  tr?: TRSource,
  /** Represents when the action rewards the tile space more than once. */
  bonusMultiplier?: number,
}

/**
 * Asks the playability question about a HYPOTHETICAL state instead of the
 * current one.
 *
 * `extraDiscount` — M€ off every card's cost on top of the discounts already in
 * play. It exists for a card that must know, BEFORE it is played, whether the
 * discount it is about to grant would give the player anything to play (Eccentric
 * Sponsor: its own `getCardDiscount` only fires once the card sits in the tableau
 * and `lastCardPlayed` names it, so at `canPlay` time the discount cannot be
 * observed any other way).
 *
 * It goes through the REAL playability path deliberately — a private
 * re-implementation would drift from `canPlay` and start answering "unplayable"
 * for cards that are playable.
 */
export type PlayabilityOptions = {
  extraDiscount?: number,
  /**
   * Units held back BEFORE the card is priced — a bill paid FIRST out of the
   * same pockets (Live Experiments RX36: «pay 6 M€ to play a card» — the card
   * must still be affordable after the 6). Added to the card's own reserve
   * (`reserveUnits`), so the engine's one affordability check answers.
   */
  reserve?: Partial<Units>,
}

/**
 * WHO a probe names while it asks «could a card be played if this waiver were
 * armed?» (`IPlayer.temporaryGlobalRequirementWaiver`) — a card (Ecology
 * Experts) or a law (Live Experiments RX36).
 */
export type GlobalWaiverProbe = CardName | {resolution: ResolutionId};

/**
 * One card a conditional search turned over, with the verdict that decided
 * its fate (see CardDrawRevealStep — the serialized twin). A discarded card
 * is safe to hold: it lives on in the deck's discard pile.
 */
export type RevealedCard = {
  card: IProjectCard,
  matched: boolean,
  /** The search's `withoutTags` this discarded card carries (see CardDrawRevealStep.failedTags). */
  failedTags?: ReadonlyArray<Tag>,
}

/**
 * What a FILTERED search tells its reveal beyond the cards: the rule it
 * searched by and whether it ran out of cards first (see
 * CardDrawRevealModel.search / exhausted).
 */
export type CardDrawSearchOutcome = {
  search?: DrawSearchModel,
  exhausted: boolean,
}

/**
 * ONE SEGMENT of a queued batch, holding live cards for its search sequence
 * (see CardIntakeSegment — the serialized twin).
 */
export type CardIntakeSegmentLive = {
  source?: CardDrawRevealSource,
  count: number,
  role?: ColonyTradeRevealRole,
  sequence?: ReadonlyArray<RevealedCard>,
  search?: DrawSearchModel,
  exhausted?: true,
}

/**
 * One queued "you drew cards" reveal awaiting the player's acknowledgement —
 * ONE INTAKE BATCH under the law «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» (see
 * CardDrawRevealModel). Holds live cards (serialized to model lazily).
 * Transient — see IPlayer.cardDrawReveals.
 */
export type CardDrawReveal = {
  id: number,
  /** The action root the batch merges under (`EventRecorder` rootId); undefined = merges with nothing. */
  actionId?: number,
  /** The first segment's source — the batch's root cause. */
  source?: CardDrawRevealSource,
  /** The runs of `cards` by cause, in dealing order (`Σ count === cards.length`). */
  segments: Array<CardIntakeSegmentLive>,
  cards: ReadonlyArray<IProjectCard>,
  /**
   * The conditional search's real reveal order. Set ONLY when the search
   * discarded at least one card — a plain draw leaves it undefined.
   */
  sequence?: ReadonlyArray<RevealedCard>,
  /** The filtered search's rule (see CardDrawRevealModel.search) — on every batch a search produced. */
  search?: DrawSearchModel,
  /** The search ran out of cards before it found enough (see CardDrawRevealModel.exhausted). */
  exhausted?: true,
  /**
   * SEALED — this batch is CLOSED to further merging (R3 of the law; also
   * serialized, so the console can read the seal).
   *
   * The merge exists so ONE action is ONE reveal («one queue, one take, one
   * acknowledgement»). It must not reach ACROSS a mandatory input: Pluto's
   * owner bonus pays «draw 1, then discard 1» PER CUBE, and by the rules each
   * colony resolves in FULL before the next is revealed — so the second
   * cube's card may not appear beside the first while the player is still
   * choosing what to throw away. The SAME boundary is drawn structurally for
   * every action: the input routes seal every open batch of the answering
   * player BEFORE applying their answer (`sealCardDrawReveals`) — whatever
   * the rule's name for the question, a draw after the player's own live
   * answer is a new batch. A pre-collected answer (the composer's batch) is
   * NOT a live input and seals nothing.
   *
   * Nothing but the client's acknowledgement used to separate them, and an ack
   * is a fire-and-forget POST racing the discard answer: when it lost, the
   * second card was APPENDED to a batch the client had already dismissed (a
   * card drawn and never shown) or, worse, to one whose arrival cinematic was
   * still in the air — the row re-flowed under the flying covers and they came
   * down beside their slots. The seal makes the boundary structural instead of
   * timing-dependent.
   */
  sealed?: boolean,
  /** What sealed it, when the rule names it (see CardDrawRevealModel.pendingAnswer). */
  pendingAnswer?: CardIntakePendingAnswer,
  /** Cards of this batch the rules discarded at once (see CardDrawRevealModel.autoDiscarded). */
  autoDiscarded?: Array<IProjectCard>,
}

/** The batch under the law's own name (see CardIntakeBatchModel). */
export type CardIntakeBatch = CardDrawReveal;

/**
 * One EXTERNAL-DRAW intake batch: cards an effect fired by ANOTHER player's
 * action (MarsBot included) drew for this player. Drawn from the deck at
 * trigger time (deck order never waits on the recipient), withheld from
 * `cardsInHand` — and thereby from every hand projection and hand-reading
 * prompt — until the recipient takes them through the mandatory
 * `externalDrawPrompt` SelectCard. SERIALIZED (unlike `cardDrawReveals`): a
 * pending intake is game state, and its prompt is re-derived from it on load
 * (`ExternalDrawIntake.rebuildPrompts`). See ExternalDrawTakeMeta.
 */
export type PendingCardIntake = {
  /** Stable per-player id (survives re-issued prompts and reloads). */
  id: number,
  /** Total cards this trigger granted (taken ones no longer sit in `cards`). */
  count: number,
  /** Cards still awaiting the take. */
  cards: Array<IProjectCard>,
  /**
   * WHO granted the draw — a card's effect (with its initiator and trigger)
   * or an ENACTED RESOLUTION (Turmoil Redux). Data, so the take surface reads
   * one shape and a new source family costs a branch, not a mechanism.
   */
  cause: ExternalDrawCause,
}

/**
 * Behavior when playing a card:
 *   add it to the tableau
 *   discard it from the tableau
 *   only play the card (used for replaying a card)
 *   or do nothing.
 */
export type CardAction = 'add' | 'discard' | 'nothing' | 'double-down';

/**
 * ONE term of a player's global-requirement bonus on one parameter — WHO
 * (`source`, named like a discount's) gives how many `steps`, and whether the
 * next card play spends it (`oneShot`: a `nextCardOnly` declaration, the
 * Ecology Experts probe). See `IPlayer.requirementBonusBreakdown`.
 */
export type RequirementBonusEntry = {
  source: EventSource;
  steps: number;
  oneShot: boolean;
};

export interface IPlayer {
  readonly id: PlayerId;
  name: string;
  color: Color;
  beginner: boolean;
  handicap: number;
  /** True for the MarsBot (Automa) seat — a server-driven player with no hand, production or prompts. */
  readonly isMarsBot: boolean;

  readonly game: IGame;
  tags: Tags;
  colonies: Colonies;
  readonly production: Production;
  readonly stock: Stock;
  readonly terraformRating: number;
  readonly opponents: ReadonlyArray<IPlayer>;

  // Used only during set-up
  pickedCorporationCard?: ICorporationCard;
  /** Campaign mode: immutable campaign seat index (undefined in ordinary games). */
  campaignSeat?: number;
  /** Campaign mode: PRIVATE carried project cards («Наследие проектов»). */
  campaignCarriedCards?: Array<CardName>;
  campaignCarriedGranted: boolean;
  /** Campaign: how many merge fees (Merger's «Then pay 42 M€», one per
   *  additional corporation) have been charged this mission. */
  campaignMergeFeesPaid: number;
  /** Campaign: the comeback-bonus press has been answered. */
  campaignBonusGranted: boolean;
  /** Initial-cards selection completed (campaign-final has no corp pick to infer from). */
  initialCardSelectionDone: boolean;

  // Terraforming Rating
  hasIncreasedTerraformRatingThisGeneration: boolean;
  // TR gained directly from cards / effects (not from global parameters).
  // Used for the end-of-game victory-point breakdown by reason.
  terraformRatingFromCards: number;
  // Per-source attribution of `terraformRatingFromCards` (the "Cards & effects"
  // end-game breakdown). Σ amount === terraformRatingFromCards.
  terraformRatingSources: Array<TRSourceEntry>;

  // Resources
  megaCredits: number;
  steel: number;
  titanium: number;
  plants: number;
  energy: number;
  heat: number;

  // Helion
  canUseHeatAsMegaCredits: boolean;
  // Luna Trade Federation
  canUseTitaniumAsMegacredits: boolean;
  // Martian Lumber Corp
  canUsePlantsAsMegacredits: boolean;

  // This generation / this round
  actionsTakenThisRound: number;
  /** Card-granted bonus actions still owed — actions taken IMMEDIATELY,
   *  outside the turn's own two (Head Start). See Player.bonusActions. */
  bonusActions: number;
  bonusActionsGranted: number;
  bonusActionSource: CardName | undefined;
  /** Gains whose timing the player chooses (Head Start) — claimable during
   *  the bonus window, auto-resolved when it closes. */
  pendingBonusGains: Array<PendingBonusGain>;
  // Transient flag: a pay-on-commit placement (standard project) was cancelled,
  // so the action loop re-presents the menu without counting the action.
  pendingPlacementCancelled: boolean;
  lastCardPlayed: CardName | undefined;
  /**
   * THE LAW'S ARMED WAIVER (Turmoil Redux RX36 Live Experiments): the PAID action
   * of an enacted resolution armed «the next card ignores its global
   * requirements» — a one-play effect whose source is a LAW, not a card, so it
   * cannot ride `lastCardPlayed` (one field, a card's name). Serialized: the
   * 6 M€ are paid when it is armed, so a reload between the bill and the card
   * loses nothing (paid = owed). Read FIRST by `globalRequirementWaiver` after
   * the probe, published by `armedPlayEffectsOf` with the law as its source,
   * SPENT by the next card played by any road (beside `lastCardPlayed`, in the
   * one place that moves it) and lost on the pass — the TR49 class's one-play
   * semantics. `undefined` = nothing armed.
   */
  armedLawWaiver: ResolutionId | undefined;
  pendingInitialActions: Array<ICorporationCard>;

  // Cards
  dealtCorporationCards: Array<ICorporationCard>;
  dealtPreludeCards: Array<IPreludeCard>;
  dealtCeoCards: Array<ICeoCard>;
  dealtProjectCards: Array<IProjectCard>;
  cardsInHand: Array<IProjectCard>;
  preludeCardsInHand: Array<IPreludeCard>;
  ceoCardsInHand: Set<ICeoCard>;
  /**
   * Transient (NOT serialized) queue of cards drawn via an in-game effect /
   * tile bonus, awaiting the player's "take" acknowledgement in the reveal
   * modal. Lost on reload/reconnect by design, so stale reveals never resurface.
   */
  cardDrawReveals: Array<CardDrawReveal>;
  /**
   * SERIALIZED queue of external-draw intakes awaiting the mandatory take —
   * see {@link PendingCardIntake}. Managed exclusively by
   * `deferredActions/ExternalDrawIntake.ts`.
   */
  pendingCardIntakes: Array<PendingCardIntake>;
  /**
   * Transient (NOT serialized) result of the player's most recent REVEAL /
   * DECK-CHECK action (SearchForLife / AsteroidDeflectionSystem) — set by the
   * action via `recordReveal` (src/server/cards/actionReveals.ts), serialized
   * self-only in the player model, and cleared at the start of the next input
   * (Player.process). Drives the premium reveal-result overlay.
   */
  lastReveal: RevealResultModel | undefined;
  /**
   * Transient (NOT serialized) snapshot of the energy→heat conversion that just
   * happened in this player's production phase — set in `runProductionPhase` /
   * `Supercapacitors.onProduction`, serialized self-only in the player model,
   * and cleared at the start of the next input (Player.process). Drives the
   * premium paired "Energy −X → Heat +X" transition animation. See
   * EnergyHeatConversionModel.
   */
  energyHeatConversion: EnergyHeatConversionModel | undefined;
  /**
   * Transient (NOT serialized) RECORD of the production phase that just paid
   * this player (TR61 — «ДОХОД — СОБЫТИЕ»): the income per resource, the
   * rating's M€, the energy converted, and the journal root it all stands
   * under. Set in `runProductionPhase` (filled by `finishProductionPhase` /
   * `convertEnergyToHeat`), serialized self-only in the player model, cleared
   * at the start of the next input (Player.process). The console's generation
   * scene plays it. See ProductionIncomeModel.
   */
  productionIncome: ProductionIncomeModel | undefined;
  /**
   * Transient (NOT serialized) snapshot of the OCEAN ADJACENCY bonus this player
   * just earned by placing next to oceans — set in `Game.grantPlacementBonuses`,
   * serialized self-only in the player model, cleared at the start of the next
   * input (Player.process). Names the paying neighbours so the premium placement
   * scene can pay out one coin per ocean without re-deriving the rule. See
   * OceanAdjacencyBonusModel.
   */
  lastOceanBonus: OceanAdjacencyBonusModel | undefined;
  /**
   * Transient (NOT serialized) snapshot of WHAT THE ENACTED LAW PAID on a
   * placement, beyond the engine's own bonuses — set by the passive that paid,
   * serialized self-only in the player model, cleared at the start of the next
   * input (Player.process). The premium placement scene plays it as the law's
   * own wave from the same cell. See PlacementLawPayoutModel.
   */
  lastPlacementLawPayout: PlacementLawPayoutModel | undefined;
  /**
   * Transient (NOT serialized) snapshot of what a TILE MOVE paid beyond the
   * cell — the move's own rating and the table's measured answer to it — set
   * by the one function that pays a move (`Game.moveOceanTile`), serialized
   * self-only, cleared at the start of the next input. The premium scene holds
   * both to the landing. See TileMoveRewardModel.
   */
  lastTileMoveReward: TileMoveRewardModel | undefined;
  /**
   * Transient (NOT serialized) snapshot of the start-of-game setup applied by
   * this player's corporation — its starting bonuses + the M€ paid for the
   * bought project cards, over the pre-corp baseline. Set in
   * `playCorporationCard`, serialized self-only in the player model, cleared at
   * the start of the next input (Player.process). Drives the premium start
   * flow's explicit "apply corporation" / "pay for cards" reveal stages. See
   * StartingSetupModel.
   */
  startingSetup: StartingSetupModel | undefined;
  /**
   * Transient (NOT serialized) atomic reward manifest of this player's most
   * recent colony trade — trade income at the pre-reset track position, the
   * per-cube colony bonuses + recipients, and the track positions before /
   * after the reset. Set in `Colony.handleTrade`, serialized self-only in the
   * player model. Deliberately NOT cleared in `Player.process()` (a batched
   * trade replays several inputs through it before the response is built);
   * the next trade overwrites it, and the client de-duplicates by `tradeId`.
   * Drives the console premium trade-reward orchestration.
   */
  colonyTradeManifest: ColonyTradeManifestModel | undefined;
  playedCards: PlayedCards;
  /** The base buy-to-hand price: 3 M€, or the corporation's replacement. */
  baseCardCost: number;
  /**
   * The price of buying ONE card to hand — `baseCardCost` minus every permanent
   * modifier in the tableau, floored at 0. Read-only because it is DERIVED: the
   * only writable half is `baseCardCost`.
   */
  readonly cardCost: number;
  /**
   * The cards that move {@link cardCost} off the 3 M€ default — every corporation that
   * replaced the base (Terralabs 1, Polyphemos 5) and every card with a purchase
   * discount (Quantum Research). Empty on a plain table. Read by the model so the
   * client can NAME the source of a non-default price without re-deriving it.
   */
  readonly cardCostSources: ReadonlyArray<CardName>;
  // This will eventually replace playedCards.
  tableau: PlayedCards;

  /** Cards this player has in their draft hand. Player chooses from them, and passes them to the next player */
  draftHand: Array<IProjectCard>;
  /** Cards this player has already chosen during this draft round */
  draftedCards: Array<IProjectCard>;
  /** The research deal waiting for its buy (the soft gates: dealt at the phase's start, asked on admission). */
  researchHand: Array<IProjectCard>;
  /** true when this player is drafting, false when player is not, undefined when there is no draft phase. */
  needsToDraft?: boolean;

  timer: Timer;

  // Turmoil
  turmoilPolicyActionUsed: boolean;
  politicalAgendasActionUsedCount: number;

  /** Lakefront Resorts increases ocean adjacency to 3 MC  */
  oceanBonus: number;

  // Custom cards
  // PoliticalAgendas Scientists P41
  hasTurmoilScienceTagBonus: boolean;
  // Ecoline
  plantsNeededForGreenery: number;
  // Lawsuit
  removingPlayers: Array<PlayerId>;
  // Cards this player has played that count toward the Warmonger award but don't live
  // in this player's tableau (e.g. Lawsuit, which lives in the sued player's event pile).
  warmongerCards: number;
  // For Playwrights and Odyssey.
  // removedFromPlayCards is a bit of a misname: it holds replayed events, so their
  // 'next card' discounts still apply. It is never cleared; stale entries are
  // harmless because those discounts only apply while lastCardPlayed matches.
  removedFromPlayCards: Array<IProjectCard>;
  /**
   * When true, Preservation Program is in effect, and the player has not triggered a TR gain this generation.
   *
   * False when the player does not have Preservation Program, or after the first TR in the action phase.
   */
  preservationProgram: boolean;
  /**
   * Total TR gained during this generation's action phase so far. Reset to 0 at the start of
   * each generation.
   *
   * For Preservation Program.
   */
  trThisGeneration: number;
  /**
   * The list of standard projects (EXCEPT SELL PATENTS) this player has taken this generation.
   *
   * For Underworld: Standard Technology and Labor Trafficking
   *
   * Note: Sell Patents is absent to simplify Labor Trafficking. It's also not necessary.
   */
  standardProjectsThisGeneration: Set<CardName>;
  /**
   * Patent sales this generation (fast mode caps the sale at one per generation
   * per player — `SellPatentsStandardProject` is the one writer and the one gate).
   */
  patentSalesThisGeneration: number;

  /**
   * For Hollandia. When true, player has tiles on Mars, and all of them are in the deflection zone.
   * False when the player has any tiles on Mars outside the deflection zone, and also false when the
   * player has no tiles on Mars.
   */
  withinDeflectionZone: boolean;

  // The number of actions a player can take this round.
  // It's almost always 2, but certain cards can change this value.
  //
  // This value isn't serialized. Probably ought to.
  availableActionsThisRound: number;

  // Stats
  actionsTakenThisGame: number;
  victoryPointsByGeneration: Array<number>;
  totalDelegatesPlaced: number;

  underworldData: UnderworldPlayerData;
  deltaProjectData?: DeltaProjectPlayerModel;
  readonly alliedParty?: AlliedParty;

  tearDown(): void;

  // When set, this player can only be accessed by the user.
  user?: DiscordId;

  setup(game: IGame): void;

  getTitaniumValue(): number;
  increaseTitaniumValue(): void;
  decreaseTitaniumValue(): void;
  getSelfReplicatingRobotsTargetCards(): Array<IProjectCard>;
  getSteelValue(): number;
  increaseSteelValue(): void;
  decreaseSteelValue(): void;
  increaseTerraformRating(steps?: number, opts?: {log?: boolean, from?: From, global?: boolean, trAttribution?: {sourceType: TRSourceType, sourceName: string, sourceCardId?: string}}): void;
  decreaseTerraformRating(steps?: number, opts?: {log?: boolean}): void;
  setTerraformRating(value: number): void;

  // The action cards used this generation.
  actionsThisGeneration: Set<CardName>;
  getVictoryPoints(): VictoryPointsBreakdown;
  plantsAreProtected(): boolean;
  alloysAreProtected(): boolean;
  /**
   * Return true when |resource| cannot be stolen from this player.
   */
  isProtected(resource: Resource | keyof Units): boolean;
  /** As {@link isProtected}, but scoped to WHO is removing — every printed
   *  protection is worded against opponents, so a self-inflicted loss is
   *  never protected. See `Player.isProtectedFrom`. */
  isProtectedFrom(resource: Resource, attacker: IPlayer): boolean;
  /** Botanical Experience's «you only lose half, rounded up» — same
   *  opponents-only scope. See `Player.losesHalfFrom`. */
  losesHalfFrom(attacker: IPlayer): boolean;
  /**
   * Returns true when this player can lose |minQuantity| units of production.
   *
   * This typically means they have the required units of production, and that production
   * isn't protected.
   */
  canHaveProductionReduced(resource: Resource, minQuantity: number, attacker: IPlayer): boolean;
  /**
   * Give this player a chance to block an attack made by `perpetrator`. Call `cb` with true if the attack
   * is not blocked.
   */
  maybeBlockAttack(perpetrator: IPlayer, message: Message | string, cb: (proceed: boolean) => PlayerInput | undefined): void;

  /**
   * Remove or steal standard resources from another player. Could be blocked (see `maybeBlockAttack`.)
   *
   * Nothing happens if count is 0.
   */
  attack(perpetrator: IPlayer, type: Resource, count: number, options?: {log?: boolean, stealing?: boolean}): void;

  /**
   * In the multiplayer game, after an attack, the attacked player makes a claim
   * for insurance. If Mons Insurance is in the game, the claimant will receive
   * as much as possible from the insurer.
   *
   * `this` is the attacked player.
   */
  resolveInsurance(): void;
  /**
   * In the solo game, Mons Insurance is only held by the sole player, who will
   * have to pay the penalty for hurting the neutral player.
   *
   * `this` is the potentialInsurer: the solo player in the game. It's not
   * clear yet whether the player has Mons Insurance, but if they do, they will
   * pay. Unlike `resolveInsurance`, there is no claimant Player so the money
   * disappears.
   */
  resolveInsuranceInSoloGame(): void;
  /**
   * Returns the number of colonies this player has on all the colony types.
   *
   * If Colonies is not in this game, this returns 0.
   */
  getColoniesCount(): number;
  /**
   * Count the number of cards in the player's event pile.
   */
  getPlayedEventsCount(): number;
  /**
   * For the given global parameter, return a sum of all requirements bonuses this
   * player has thanks to played cards, Turmoil policies, etcetera.
   */
  getGlobalParameterRequirementBonus(parameter: GlobalParameter): number;
  /**
   * {@link getGlobalParameterRequirementBonus} itemized — WHO gives how many
   * steps (a card, a corporation, a party policy, an underground token), and
   * whether the next card play spends it. The sum IS the bonus: the one
   * breakdown every reading of a requirement modifier stands on
   * (`models/requirementEasing.ts`, `unplayableReasons`' `effectiveCount`).
   */
  requirementBonusBreakdown(parameter: GlobalParameter): Array<RequirementBonusEntry>;
  /**
   * WHO lets this player IGNORE the global requirements on `parameter` right
   * now (Cutting-Edge Design TR49 / Ecology Experts while armed — a
   * `{waive: true}` declaration), or `undefined`. A waived requirement is MET
   * (`GlobalParameterRequirement.satisfies`), before any Think Tank bridge:
   * never a bound stretched by a sentinel number.
   */
  globalRequirementWaiver(parameter: GlobalParameter): EventSource | undefined;
  /**
   * WHO lets this player IGNORE a PARTY requirement right now (Backroom Deal
   * TR70 while armed — a `partyRequirementWaiver` declaration), or
   * `undefined`. A waived party requirement is MET (`PartyRequirement.satisfies`,
   * before the Parliament is asked) — never the party's EFFECT.
   */
  partyRequirementWaiver(): EventSource | undefined;
  /**
   * When Ecology Experts evaluates whether it can be played, it needs
   * this temporary requirement bonus for global parameters.
   */
  temporaryGlobalParameterRequirementBonus: number;
  /**
   * The PROBE's waiver: a source that asks «could a card be played if its own
   * waiver were armed?» names itself here for the length of the question
   * (try / finally) — never serialized. A CARD (Ecology Experts'
   * `bespokeCanPlay`) or a LAW (Live Experiments RX36: the action's gate, its
   * futility verdict and the console's candidates ask with the law armed).
   */
  temporaryGlobalRequirementWaiver: GlobalWaiverProbe | undefined;
  /**
   * Called when this player is responsible for increasing a global parameter.
   */
  onGlobalParameterIncrease(parameter: GlobalParameter, steps: number): void;
  readonly globalParameterSteps: Record<GlobalParameter, number>;
  /**
   * Remove resources from this player's played card
   */
  removeResourceFrom(card: ICard, count?: number, options?: {removingPlayer? : IPlayer, log?: boolean}): void;
  /**
   * Add resources to this player's played card
   */
  addResourceTo(card: ICard, options?: number | {qty?: number, log: boolean, logZero?: boolean, from?: From, basis?: CardResourceBasis}): void;

  /**
   * Returns the set of cards in play that have actual resources on them.
   *
   * Use |getResourceCards| to return all cards, even without resources on them.
   *
   * If `resource` is absent, include cards that collect any resource.
   */
  getCardsWithResources(resource?: CardResource): Array<ICard>;

  /**
   * Return the cards that collect `resource`, even if they have none on the card.
   *
   * Use |getCardsWithResources| to return only cards with resources on them.
   *
   * If `resource` is absent, return the cards that collect any resource.
   */
  getResourceCards(resource?: CardResource): Array<ICard>;

  /**
   * Count all the resources of a given type in the tableau.
   */
  getResourceCount(resource: CardResource): number;
  getPlayableActionCards(): Array<ICard & IActionCard>;
  runProductionPhase(): void;
  finishProductionPhase(): void;
  /**
   * Turn `amount` of this player's energy into heat (the end-of-generation rule,
   * or the Supercapacitors chosen amount) — through the stock chokepoints under
   * the production phase's `conversion` source, with the one-shot snapshot the
   * premium transition reads. A zero / negative amount does nothing.
   */
  convertEnergyToHeat(amount: number): void;

  runResearchPhase(): void;
  /** The research deal alone (into `researchHand`) — the soft gates ask the buy apart. */
  drawResearch(): void;
  /** The research buy over `researchHand`. */
  askResearch(): void;
  getCardCost(card: IProjectCard): number;
  /** `getCardCost` itemized: the printed cost, the final cost and every
   *  card / corporation / party discount by source (read-only). */
  getCardCostBreakdown(card: IProjectCard): {base: number; final: number; discounts: Array<{source: EventSource; amount: number}>};

  /** The number of resources on this card for this player, or 0 if the player does not have this card. */
  resourcesOnCard(name: CardName): number;
  spendableMegacredits(): number;
  /** Return then amount of spendable units of a given card resource */
  getSpendable(resource: SpendableCardResource): number;
  checkPaymentAndPlayCard(selectedCard: IProjectCard, payment: Payment, cardAction?: CardAction): void;
  pay(payment: Payment): void;
  /** Record the plants a greenery-discount effect (EcoLine) saved on a conversion. */
  recordGreeneryDiscount(): void;
  availableHeat(): number;
  spendHeat(amount: number, cb?: () => (undefined | PlayerInput)) : PlayerInput | undefined;
  /** READ-ONLY preview of the Stormcraft heat-source prompt (or undefined when no
   *  prompt would show). Never deducts heat. See Player.spendHeatPreview. */
  spendHeatPreview(amount: number) : PlayerInput | undefined;

  playCard(selectedCard: IProjectCard, payment?: Payment, cardAction?: CardAction): void;
  onCardPlayed(card: ICard): void;
  triggerOnNonCardTagAdded(tag: Tag): void;
  /**
   * Play a corporation: tableau + starting M€ + card cost + its effects.
   * `deferCardPayment` makes the payment for the bought project cards an
   * explicit follow-up prompt instead of an immediate deduction — used ONLY
   * by the start screen's deferred play (Game.playCorporationInput).
   */
  playCorporationCard(corporationCard: ICorporationCard, options?: {deferCardPayment?: boolean, holdResearchRelease?: boolean, cardPaymentPriority?: Priority}): void;
  drawCard(count?: number, options?: DrawOptions): void;
  drawCardKeepSome(count: number, options: AllOptions): void;
  /**
   * Queue a batch of just-drawn cards for the reveal modal. No-op when empty.
   * `sequence` is the conditional search's real reveal order; it is kept only
   * when the search actually discarded something.
   */
  enqueueCardDrawReveal(cards: ReadonlyArray<IProjectCard>, source?: CardDrawRevealSource, sequence?: ReadonlyArray<RevealedCard>, outcome?: CardDrawSearchOutcome): void;
  /**
   * CLOSE the batch just queued to further merging (see `CardDrawReveal.sealed`).
   * Called by a payout that owes the player a MANDATORY answer before the next
   * draw of the same action may be revealed — `pendingAnswer` names that
   * answer for the console's sealed place (R6). Idempotent; a no-op on an
   * empty queue.
   */
  sealCardDrawReveal(pendingAnswer?: CardIntakePendingAnswer): void;
  /**
   * The recipient's OWN LIVE INPUT is about to be applied (the input routes):
   * every open batch of theirs was on their screen before this answer, so the
   * next draw of any action opens a new batch (R3 — the structural seal).
   */
  sealCardDrawReveals(): void;
  /**
   * The rules discarded these cards with no question asked (a mandatory discard met a hand holding no other card):
   * every pending reveal batch that SHOWS one of them records it (`CardDrawReveal.autoDiscarded`), so the console
   * presents the card leaving instead of offering to take a card that is no longer in the hand.
   */
  noteRevealAutoDiscard(cards: ReadonlyArray<IProjectCard>): void;
  /** Remove a reveal batch (or all) once the player has taken the cards. Idempotent. */
  acknowledgeCardDrawReveals(id: number | 'all'): void;
  discardPlayedCard(card: IProjectCard): void;
  discardCardFromHand(card: IProjectCard, options?: {log?: boolean}): void;

  /** Player has prestated they want to pass on their next turn */
  autopass: boolean;
  /** Player is done taking actions this generation. */
  pass(): void;
  takeActionForFinalGreenery(): void;
  getPlayableCards(options?: PlayabilityOptions): Array<IProjectCard>;
  canPlay(card: IProjectCard, playability?: PlayabilityOptions): boolean;
  canSpend(payment: Payment, reserveUnits?: Units): boolean;
  payingAmount(payment: Payment, options?: Partial<PaymentOptions>): number;
  /** Which alternative payment sources `card` accepts (the play prompt's own rule — read-only). */
  paymentOptionsForCard(card: IProjectCard): PaymentOptions;
  /**
   * Returns a summary of how much a player would have to spend to play a card,
   * any associated costs, and ways the player can pay.
   */
  affordOptionsForCard(card: IProjectCard, options?: PlayabilityOptions): CanAffordOptions;
  canAfford(options: number | CanAffordOptions): boolean;
  /** The M€-equivalent shortfall to play `card` right now (0 if affordable). */
  affordabilityDeficit(card: IProjectCard): number;
  /** The same shortfall for an arbitrary affordability request (standard projects). */
  affordabilityDeficitFor(options: CanAffordOptions): number;
  getStandardProjectOption(): SelectStandardProjectToPlay;
  takeAction(saveBeforeTakingAction?: boolean): void;
  /** Return possible mid-game actions like play a card and fund an award, but not play prelude card.
   *  `bonusAction` builds the same menu WITHOUT the two turn-control verbs (End Turn / Pass) —
   *  neither is a legal answer to a card-granted bonus action. */
  getActions(options?: {bonusAction?: boolean}): OrOptions;
  /** Grant `count` bonus actions, attributed to `source` (Head Start),
   *  optionally with gains whose claim timing the player chooses. */
  grantBonusActions(count: number, source: CardName, gains?: ReadonlyArray<PendingBonusGain>): void;
  /** A card-granted bonus action is owed right now. */
  hasBonusAction(): boolean;
  process(input: InputResponse): void;
  getWaitingFor(): PlayerInput | undefined;
  /**
   * The identity serial of the CURRENT prompt — bumped on every
   * `setWaitingFor` from a process-lifetime counter (a rebuilt prompt after a
   * game reload gets a NEW serial by construction). Serialized to the client
   * as `promptId` and validated on every submit: an answer stamped with a
   * different serial was prepared against a prompt the server no longer holds
   * and is refused with `STALE_PROMPT` instead of being applied to whatever
   * stands now. A refused submit keeps its serial (same logical prompt).
   */
  waitingForSerial: number;
  /** Correlation root of the chain the pending prompt belongs to (may still grow). */
  openWaitingForCorrelation(): number | undefined;
  setWaitingFor(input: PlayerInput, cb?: () => void): void;
  setWaitingForSafely(input: PlayerInput, cb?: () => void): void;
  clearWaitingFor(): void;
  serialize(): SerializedPlayer;

  /** Returns the cost a player must spend to claim a milestone. Public for Briber. */
  milestoneCost(): number;

  /** What funding the NEXT award costs this player (8/14/20, ± the card rules).
   *  Public so the player model can publish the live price the action charges. */
  awardFundingCost(): number;

  /** Shorthand for deferring evaluating a PlayerInput */
  defer(input: PlayerInput | undefined | void | (() => PlayerInput | undefined | void), priority?: Priority): void;
  setAlliedParty(party: IParty): void;
}

export function isIPlayer(object: any): object is IPlayer {
  return object !== undefined && object.hasOwnProperty('id') && isPlayerId(object.id) && isIGame(object.game);
}
