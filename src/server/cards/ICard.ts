import {CardType} from '../../common/cards/CardType';
import {IProjectCard} from './IProjectCard';
import {Space} from '../boards/Space';
import {PlayerInput} from '../PlayerInput';
import {CanAffordOptions, IPlayer} from '../IPlayer';
import {Tag} from '../../common/cards/Tag';
import {CardResource} from '../../common/CardResource';
import {CardName} from '../../common/cards/CardName';
import {CardMetadata} from '../../common/cards/CardMetadata';
import {GlobalParameter} from '../../common/GlobalParameter';
import {BoardType} from '../boards/BoardType';
import {CardDiscount, GlobalParameterRequirementBonus, PartyRequirementWaiver} from '../../common/cards/Types';
import type {ArmedPlayEffectKind} from '../../common/models/ArmedPlayEffectModel';
import {CountableVictoryPoints} from '../../common/cards/CountableVictoryPoints';
import {VictoryPointsSign} from '../../common/cards/victoryPointsIcon';
import {TileType} from '../../common/TileType';
import {Behavior} from '../behavior/Behavior';
import {TRSource} from '../../common/cards/TRSource';
import {CardRequirementDescriptor} from '../../common/cards/CardRequirementDescriptor';
import {OneOrArray} from '../../common/utils/types';
import {JSONValue} from '../../common/Types';
import {IStandardProjectCard} from './IStandardProjectCard';
import {Warning} from '../../common/cards/Warning';
import {PreludeNeed} from '../../common/cards/PreludeOutlook';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {ActionEffect, ActionPreview, AgendaWalkModel} from '../../common/models/ActionPreviewModel';
import {ActionFutility} from '../../common/models/ActionFutilityModel';
import {Resource} from '../../common/Resource';
import {Units} from '../../common/Units';
import {SerializedCard} from '../SerializedCard';
import {UndergroundResourceToken} from '../../common/underworld/UndergroundResourceToken';
import {BoardFact} from '../../common/boards/BoardInformationFacts';
import {ReduxParty, ResolutionId, ResolutionInstanceId} from '../../common/parliament/ParliamentTypes';
import {PlacementPreviewContext} from '../boards/PlacementPreviewContext';
import {DeltaMovement, DeltaMovementBonus} from '../delta/deltaMovement';
import {AdjacencyBonus} from '../ares/AdjacencyBonus';
import {EffectForecastFact} from '../../common/models/EffectForecastModel';
import {EffectForecastContext, EffectForecastGrant, EffectForecastTile} from './EffectForecastContext';
import type {FleetDock} from '../colonies/FleetDock';
import type {DeclaredHolderRole, HolderActionGood} from '../../common/cards/holderRole';
import type {GlobalParameterRaise} from './GlobalParameterRaise';

/*
 * Represents a card which has an action that itself allows a player
 * to replay a card. Those cards can evaluate card playability recursively.
 * which consumes the entire call stack.
 *
 * Cards like that keep track of the number of times they're called as a
 * loop check.
 */
export interface IHasCheckLoops {
  getCheckLoops(): number;
}

export function isIHasCheckLoops(object: any): object is IHasCheckLoops {
  return object.getCheckLoops !== undefined;
}

/** Defines how ICard.getVictoryPoints works. */
export type GetVictoryPointsContext = 'default' | 'projectWorkshop';

export interface ICard {
  readonly name: CardName;
  readonly tags: ReadonlyArray<Tag>;
  canPlay(player: IPlayer, canAffordOptions?: CanAffordOptions): boolean;
  /**
   * Optional structured reason this card can't be played right now, for cards
   * whose block lives in bespoke `canPlay` / `bespokeCanPlay` logic the generic
   * explainer can't introspect (e.g. Robotic Workforce: "no card to copy";
   * Stratospheric Birds: "no floater to spend"; mining/city cards: a bespoke
   * tile placement). Called by `src/server/models/unplayableReasons.ts` whenever
   * the card is known unplayable — ALONGSIDE any requirement / affordability
   * reasons, not only as a last resort (a card can be blocked by both at once).
   * So a hook MUST return `undefined` when ITS OWN bespoke condition is actually
   * satisfied (the block is something else, e.g. the oceans requirement), and
   * the specific reason otherwise.
   */
  unplayableReason?(player: IPlayer): UnplayableReason | undefined;
  /**
   * Optional structured reason this card's ACTIVATABLE ACTION can't be used
   * right now, for action cards whose block lives in bespoke `canAct` /
   * `bespokeCanAct` logic the generic explainer can't introspect (e.g. United
   * Nations Mars Initiative: "TR not raised this generation", or Ants: "no card
   * with the right resource to remove"). Called by
   * `src/server/models/actionUnavailableReasons.ts` ONLY when the action is
   * known unavailable. Return `undefined` to defer to the generic fallback.
   */
  actionUnavailableReason?(player: IPlayer): UnplayableReason | undefined;
  /**
   * Optional READ-ONLY preview of this card's ACTIVATABLE ACTION — the branches
   * and per-branch choice steps the player will make — so the confirmation modal
   * can collect every choice BEFORE the final submit (instead of follow-up modals
   * after confirming). Lives in the card file next to `action()`/`canAct()` (the
   * analog of `actionUnavailableReason`), so bespoke action logic and its preview
   * can't drift on an upstream merge. DECLARATIVE action cards don't need it —
   * `src/server/models/actionPreview.ts` auto-derives them from `actionBehavior`.
   * MUST NOT mutate game state. Builders live in `src/server/cards/actionPreviews.ts`.
   */
  actionPreview?(player: IPlayer): ActionPreview;
  /**
   * Optional READ-ONLY verdict that this card's ACTIVATABLE ACTION would change nothing right now (the «no effect»
   * class — `src/server/models/actionFutility.ts`), for a BESPOKE action the declarative reader cannot see into: a
   * branch that spends to raise a maxed parameter, a gain counted off the table, a resource past the card's points.
   * Per branch in `actionPreview` order, built with `cards/actionFutilities.ts`; `undefined` = nothing to say. The
   * RESCUES (a Whales owner, a reacting card, a live award) are the engine's, never the hook's. Lives beside
   * `action()` / `canAct()` so an upstream change to the action meets it in the same diff. MUST NOT mutate state.
   */
  actionFutility?(player: IPlayer): ActionFutility | undefined;
  /**
   * Optional READ-ONLY preview of PLAYING this card — its ON-PLAY effects and the
   * per-choice steps the player will make — so the "РАЗЫГРАТЬ КАРТУ" modal can
   * show the impact AND collect every target/parameter choice BEFORE the final
   * batch submit (instead of follow-up modals after the card is played). The
   * analog of `actionPreview` but for `bespokePlay`; lives in the card file next
   * to `bespokePlay()` so the two can't drift on an upstream merge. DECLARATIVE
   * cards don't need it — `src/server/models/cardPlayPreview.ts` auto-derives them
   * from `behavior`. MUST NOT mutate game state. Builders live in
   * `src/server/cards/actionPreviews.ts`.
   */
  cardPlayPreview?(player: IPlayer): ActionPreview;
  /**
   * Optional READ-ONLY reading of the Agenda walk PLAYING this card would make
   * (Turmoil Redux TR04 / TR12 / TR37 / TR42 — a card whose play «advances the
   * Agenda marker»): the same `AgendaWalkModel` its `cardPlayPreview` hands the
   * composer — the ONE reading, so the play preview, the hand tile's forecast
   * plate and the inspector's «ДЛЯ ВАС» row cannot read apart. A counted walk
   * carries its breakdown (`basis`). The viewer's OWN hand cards carry it on
   * `CardModel.agendaWalk` (inside the Mars Parliament only). MUST NOT mutate
   * game state.
   */
  agendaWalkForecast?(player: IPlayer): AgendaWalkModel;
  /**
   * Optional READ-ONLY chips of a BESPOKE play whose result is COUNTED off the
   * table («1 M€ production per different tag», «1 TR per Jovian tag», «1 M€
   * per empty area next to your tiles», «all your colony bonuses») — the part
   * of the play a `behavior` declaration cannot carry, so `countedPlayEffects`
   * cannot read it. The card's own `cardPlayPreview` builds its chips with the
   * SAME function (the ONE reading: the hand tile's forecast plate, the
   * composer and the play cannot say two numbers); a chip whose count is one
   * reason carries its `basis`, which is the composer's «ПОЧЕМУ». A declarative
   * counted member never needs it. MUST NOT mutate game state. Guard (the
   * worklist): `tests/models/countedPlayForecast.spec.ts`.
   */
  countedPlayForecast?(player: IPlayer): ReadonlyArray<ActionEffect>;
  /**
   * A play whose count the player CHOOSES among several (TR54 Overclocked Equipment — «a standard resource, as many as
   * your production of it»): the hand plate reads the CEILING — «[?] up to +N» — never six gains as if all landed (that
   * is `countedPlayForecast`'s reading). The largest of the counts the play offers right now. MUST NOT mutate game state.
   */
  countedChoiceForecast?(player: IPlayer): {max: number} | undefined;
  /**
   * The card GRANTS N bonus actions when played (Head Start's «immediately
   * take 2 actions»). Co-located on the card class; exported to `ClientCard`
   * so the console start flow declares its bonus chapter before the play.
   */
  readonly grantsBonusActions?: number;
  /**
   * Optional READ-ONLY preview of what THIS card does about the cell the player
   * is currently pointing at, while its own `SelectSpace` is open. The board
   * explainer knows the cell (printed bonus, ocean adjacency, cost, scoring); it
   * cannot know that Solar Farm turns the cell's plant bonuses into energy
   * PRODUCTION, or that Mining Area's production depends on which of steel /
   * titanium the cell prints. Those are card rules, so they live in the card.
   *
   * Reached whenever the prompt carries `sourceCard` (`PlaceTile` threads it from
   * `tile.card`; the declarative city/greenery/ocean branches pass the card name;
   * a bespoke `createMarsSelectSpace` passes `sourceCard`). MUST NOT mutate game
   * state. Builders live in `src/server/cards/placementPreviews.ts`.
   */
  placementPreview?(player: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact>;
  /**
   * Optional READ-ONLY mirror of {@link onTilePlaced} — what this card gives its
   * OWNER when `activePlayer` places the previewed tile. It is what stops a
   * placement from surprising anyone: an opponent's Arctic Algae gains 2 plants
   * off your ocean, their Tharsis Republic gains M€ production off your city.
   * The preview walks EVERY player's tableau, so a fact here may be addressed to
   * an opponent (use `placementPreviews.recipientOf`).
   *
   * The tile is NOT on the board yet, so never test `Board.isCitySpace(space)` —
   * read `ctx.countsAsCity` / `countsAsOcean` / `countsAsGreenery`. MUST NOT
   * mutate game state.
   */
  tilePlacedPreview?(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, ctx: PlacementPreviewContext): ReadonlyArray<BoardFact>;
  /**
   * Optional READ-ONLY mirror of {@link onCardPlayed} / {@link onCardPlayedByAnyPlayer}
   * — what THIS card will do when `activePlayer` plays `playedCard`. Asked for
   * the acting player's own tableau AND for every other seat's (the same walk
   * `Player.onCardPlayed` makes), so a fact may be addressed to an opponent
   * (`effectForecastPreviews.recipientOf`). The played card is already «in
   * play» for the live hook («including this»), so a card forecasts its own
   * play too.
   *
   * It answers HONESTLY on «almost»: a matching tag whose condition fails
   * (an event / not an event, a threshold, a resource on the card) returns a
   * `no` fact with the reason. It decides what the live hook decides — Olympus
   * Conference at zero science adds silently, at one or more it ASKS — by
   * reading the same predicates in the same file. MUST NOT mutate game state.
   * Builders live in `src/server/cards/effectForecastPreviews.ts`; the engine
   * (`src/server/models/effectForecast.ts`) reports a card with a live hook
   * but no forecast as `unknown` — never as silence.
   */
  cardPlayedForecast?(cardOwner: IPlayer, activePlayer: IPlayer, playedCard: ICard, ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact>;
  /**
   * Optional READ-ONLY mirror of the SECOND-ORDER hooks ({@link onProductionGain},
   * {@link onResourceAdded}): what this card does when the operation GRANTS
   * `grant` to its actor. The grant is built by the engine from the preview's
   * own `ActionEffect` chips and from the exact first-order facts — a hook never
   * re-reads the card's behavior. MUST NOT mutate game state.
   */
  grantForecast?(cardOwner: IPlayer, activePlayer: IPlayer, grant: EffectForecastGrant, ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact>;
  /**
   * Optional READ-ONLY mirror of {@link onTilePlaced} for a tile the operation
   * will place LATER (its cell is not chosen yet): a `deferred` fact with exact
   * numbers where they do not depend on the cell (Rover Construction's 2 M€
   * for any city), else a chip-less fact whose note points at the cell
   * dossier (Mining Guild, Philares, the surveys). Asked for every seat's
   * tableau, like the live fan-out in `Game.addTile`. MUST NOT mutate game state.
   */
  tilePlacedForecast?(cardOwner: IPlayer, activePlayer: IPlayer, tile: EffectForecastTile, ctx: EffectForecastContext): ReadonlyArray<EffectForecastFact>;
  play(player: IPlayer): PlayerInput | undefined;
  /**
   * Describes the M€ discount `player` could apply to playing `card`.
   *
   * If the discount code is simple, consider using `cardDiscount` instead.
   */
  getCardDiscount?(player: IPlayer, card: IProjectCard): number;
  /**
   * Describes type of discount this card applies to other cards.
   *
   * Achieves the same thing as `getCardDiscount` but for the simplest, most common use cases.
   *
   * Having descriptions this simple also makes it easier to render its discount in the UI.
   */
  cardDiscount?: OneOrArray<CardDiscount>;
  /**
   * Describes the M€ discount `player` could apply to playing `card`.
   */
  getStandardProjectDiscount?(player: IPlayer, card: IStandardProjectCard): number;

  /**
   * Describes the M€ discount `player` could apply to BUYING ONE CARD TO HAND
   * (Quantum Research). The sibling of `getCardDiscount`, for the other cost:
   * that one cheapens PLAYING a project card, this one cheapens the research /
   * draft purchase price. Summed over the tableau by `Player.cardCost`, whose
   * result is the single authoritative buy price every purchase flow reads.
   *
   * DERIVED, never stored — a permanent modifier declared here can not be
   * applied twice by a reload, an undo or a clone.
   */
  getCardPurchaseDiscount?(player: IPlayer): number;

  /**
   * The +/- bonus applied to global parameter requirements, e.g. Adaptation Technology.
   *
   * `parameter` describes which global parameter is being tested.
   *
   * NB: Instances of `Card` allow using a JSON object to describe the global parameter bonus,
   * see `globalParameterRequirementBonus` for more information.
   */
  getGlobalParameterRequirementBonus(player: IPlayer, parameter: GlobalParameter): number;
  /**
   * The global requirements are IGNORED right now (Cutting-Edge Design TR49,
   * Ecology Experts — `globalParameterRequirementBonus: {waive: true}`): a
   * waived requirement is MET, by kind, never by a number of steps. Read by
   * ONE function, `IPlayer.globalRequirementWaiver`.
   */
  waivesGlobalRequirements?(player: IPlayer, parameter: GlobalParameter): boolean;
  /** The declared requirement bonus / waiver, as printed (Card exposes its own). */
  globalParameterRequirementBonus?: GlobalParameterRequirementBonus;
  /**
   * The PARTY requirement is IGNORED right now (Backroom Deal TR70 —
   * `partyRequirementWaiver: {nextCardOnly: true}` while armed): the other
   * requirement family's waiver, read by ONE function,
   * `IPlayer.partyRequirementWaiver`, and paid by `PartyRequirement.satisfies`.
   */
  waivesPartyRequirements?(player: IPlayer): boolean;
  /** The declared party-requirement waiver, as printed (Card exposes its own). */
  partyRequirementWaiver?: PartyRequirementWaiver;
  /**
   * A ONE-PLAY EFFECT this card arms that NO declaration describes (a bespoke
   * «your next card …»): co-located with the bespoke code that grants it, read
   * by `armedPlayEffectsOf` only while this card is `lastCardPlayed`. A card
   * whose one-play effect IS declared (`cardDiscount` / requirement bonus with
   * `nextCardOnly`) needs nothing — the reader reads the declaration.
   */
  armedPlayEffect?(player: IPlayer): ArmedPlayEffectKind | undefined;
  victoryPoints?: number | 'special' | CountableVictoryPoints,
  /** What a bespoke ('special') VP icon can ever score (see `common/cards/victoryPointsIcon.ts`). */
  victoryPointsSign?: VictoryPointsSign,
  getVictoryPoints(player: IPlayer, context?: GetVictoryPointsContext): number;
  /**
   * A `'special'` VP card whose score is a function of the resources stored HERE alone (Search for Life: 3 VP with at
   * least one science resource) states that function, so a «put N on ANY card» pick can read what the N do to its
   * points before the press (`resourceVictoryPoints` → the target step's `vpBox`, TR51 К-T2). The card's own
   * `getVictoryPoints` reads the same function — one rule, never a copy.
   */
  victoryPointsAtResources?(count: number): number;
  /** Returns any dynamic influence value */
  getInfluenceBonus?: (player: IPlayer) => number;
  /**
   * Turmoil Redux — THE LAW OF ACCESS, lowered by a card: own delegates on ONE
   * resolution that give this card's OWNER the party's effect (TR36 Council
   * Seat: 1 instead of the printed 2). `Parliament.effectDelegatesOf` walks the
   * tableau and the MINIMUM wins — never below 1 and never above
   * `PARTY_EFFECT_DELEGATES`. A THRESHOLD, not a grant: it is read live from
   * the table at every `access()` (no state, no save field, nothing to revoke),
   * so a cube already standing opens the effect the moment the card lands and
   * a cube gone closes it. The card REQUIREMENT never reads it (rulebook FAQ
   * p.19 — «Council Seat only grants you the effect of the party. Not its
   * full favor»).
   */
  readonly partyEffectDelegates?: number;
  /**
   * Turmoil Redux — a hook the SITTING calls: at the refresh step of the
   * political phase (`ParliamentPhase.stepRefresh`) every UNENACTED resolution
   * leaves the voting area and its delegates go home; for each such card that
   * carried `count` (> 0) of this player's delegates the phase calls the hook
   * ONCE, inside `events.withEffect(player, card, 'delegates-discarded')`.
   * Never called for the enacted resolution (`stepEnact`), for a delegate
   * taken back for the chairman's seat (`removeLatestVote` — a move, not a
   * discard), for a delegate a CARD takes off the table (TR72 Banned
   * Delegate:redux — `RemoveDelegate`: a ban, not the sitting), nor in the
   * final generation (nothing is refreshed).
   * First holder: TR02 Political Science (data per delegate).
   */
  onDelegatesDiscarded?(player: IPlayer, count: number, context: {instance: ResolutionInstanceId, resolution: ResolutionId}): void;
  /**
   * Turmoil Redux — THE LAW OF ACCESS, given a FOURTH road by a card: an
   * ALLIANCE of two parties (TR62 Tharsis Alliance: Mars First and the Reds).
   * While ONE party of the pair stands for this card's owner by its PRINTED
   * road (it rules, or two of the owner's own delegates on its resolution —
   * the requirement's reading), the OTHER is the owner's too: its effect AND
   * its card requirement («effect and cards»). Read live off the tableau by
   * `Parliament.alliancesOf` at every `access()` — no state, no save field,
   * nothing to revoke; the Parliament never knows the card's name. A grant, a
   * lowered threshold (TR36) or the alliance itself never sets an alliance
   * off: one pair, one hop.
   */
  readonly partyAlliance?: Readonly<[ReduxParty, ReduxParty]>;
  /**
   * Turmoil Redux — a hook the SITTING calls at the ENACTMENT
   * (`ParliamentPhase.stepEnact`): right after the winning resolution takes the
   * ENACTED slot, every participant of the party effects has every card of
   * its tableau carrying the hook called ONCE with the new ruling party and
   * the one it replaced (generation 1's starting-rule Greens included), inside
   * `events.withEffect(player, card, 'ruling-party-changed')` and under the
   * step's own key (a reload mid-sitting never calls it twice). First holder:
   * TR62 Tharsis Alliance (a card when either of its parties becomes ruling).
   */
  onRulingPartyChanged?(player: IPlayer, next: ReduxParty, previous: ReduxParty): void;
  /**
   * Turmoil Redux — a hook the SITTING calls for the WINNING PLAYER of the
   * winning resolution («when you win on a resolution» — rulebook p.8: the
   * player with the most delegates on it). Called at the ENACTMENT
   * (`ParliamentPhase.stepEnact`), right after the resolution took the ENACTED
   * slot and the ruling-party hooks ran — so what the hook opens for its owner
   * is read against the new power (a cube on the new ruling party's banner is
   * no access news: the party rules). ONCE per sitting, for every card of the
   * winner's tableau carrying the hook, inside `events.withEffect(player, card,
   * 'resolution-won')` and under the step's own `enact:` key (a reload
   * mid-sitting never calls it twice). Never for the NEUTRAL player's win, and
   * never for a seat outside the PARTY-EFFECTS aspect (MarsBot). First holder:
   * Septem Tribus:redux (a cube on the won resolution's party's banner).
   */
  onResolutionWon?(player: IPlayer, context: {instance: ResolutionInstanceId, resolution: ResolutionId, party: ReduxParty}): void;
  /**
   * THIS CARD IS A FLEET DOCK (Turmoil Redux — TR06 Water Hauling, TR26 UNMI
   * Liner, TR27 Aurora Station: «once per generation, when you trade, you can
   * send the trade fleet to this card to …»): a DESTINATION of its owner's
   * trade action beside the colony tiles. The card states only what is its
   * own — the reward, the reward's one blocker, the reward's preview; the
   * occupied berth, the offer, the landing and the destination itself are the
   * class's (`colonies/FleetDock.ts`). A dock card also declares
   * `data = {dockedGeneration}` so the fleet standing on it survives a save.
   */
  fleetDock?: FleetDock;
  /**
   * WHAT THE RESOURCE STORED HERE IS FOR, when no structure tells it
   * (`common/cards/holderRole.ts` — PL-030 / PL-075): a resource spent for
   * a DELEGATE (the census family) or for a TRADE (TR66). A payment unit
   * and VP per resource are read structurally and declare nothing.
   */
  resourceRole?: DeclaredHolderRole;
  /**
   * THE ACTION ROLE OF A BESPOKE HOLDER (К-R1, TR46): what one press of a
   * BESPOKE action buys with the resource stored here — a declarative action's
   * role is DERIVED (`cards/holderActionGood.ts`) and must never declare one.
   * Built in the card file from the constants its action and preview read.
   */
  holderActionGood?: HolderActionGood;
  /** Called when cards are played. Corps have a different callback */
  onCardPlayed?(player: IPlayer, card: ICard): PlayerInput | undefined | void;
  onCardPlayedByAnyPlayer?(thisCardOwner: IPlayer, card: ICard, activePlayer: IPlayer): PlayerInput | undefined | void;
  onCardPlayedFromAnyPlayer?: never;
  /**
   * MarsBot gained a MICROBE advancement without a card — a corporation
   * starting tag or a printed track/bonus effect (RB-B FAQ: «resolve your
   * corporation's effect as if a card with a microbe was played»). Only the
   * RB-B-sanctioned reactors implement it (Pharmacy Union, Splice); routed by
   * `automa/AutomaHumanTagReactions`, never by the ordinary play dispatch.
   */
  onMarsBotMicrobeAdvancement?(cardOwner: IPlayer): void;
  onStandardProject?(player: IPlayer, project: IStandardProjectCard): void;
  /**
   * THE PATENT SALE (fork hook — Turmoil Redux TR46 Research Startups: «When you
   * Sell Patents, add 1 data here per card sold»): called on the SELLER's own
   * tableau with the cards the standard project «Sell patents» just discarded.
   * Its ONE writer is `SellPatentsStandardProject`, inside a `standard-project`
   * effect scope per card. `onStandardProject` carries no count, and the count
   * is never to be read off the hand before / after.
   */
  onPatentsSold?(player: IPlayer, sold: ReadonlyArray<ICard>): void;
  /**
   * The forecast twin of {@link onPatentsSold} — what selling `count` cards pays
   * THIS card's owner, by the live hook's own rate. Read-only; asked by
   * `effectForecast.patentSaleForecast` (the sale prompt's `patentSale` model).
   */
  patentsSoldForecast?(owner: IPlayer, count: number): ReadonlyArray<EffectForecastFact>;
  onTilePlaced?(cardOwner: IPlayer, activePlayer: IPlayer, space: Space, boardType: BoardType): void;
  onDiscard?(player: IPlayer): void;
  /**
   * Called when anybody gains TR
   *
   * @param cardOwner the owner of this card
   * @param player the player gaining TR
   * @param steps the number of steps gained
   */
  onIncreaseTerraformRatingByAnyPlayer?(cardOwner: IPlayer, player: IPlayer, steps: number): void;
  onIncreaseTerraformRating?: never;
  /**
   * The PLAYER'S OWN rewarded raise (Venus Contract, Homeostasis Bureau): called
   * for the raising player's played cards only, inside the engine's reward
   * gate — never for the World Government's phase or an unrewarded world move.
   * A card that answers «each time the scale is terraformed», whoever raised
   * it, uses {@link onGlobalParameterRaised} instead.
   */
  onGlobalParameterIncrease?(player: IPlayer, parameter: GlobalParameter, steps: number): void;
  /**
   * A GLOBAL PARAMETER SCALE WAS RAISED — by ANY player, MarsBot, the World
   * Government or a resolution's world move (Aphrodite: «whenever Venus is
   * terraformed 1 step»; Turmoil Redux TR24 Venusian Census). ONE dispatcher,
   * `Game.globalParameterRaised`, walks every seat's tableau in generation
   * order (corporations included) and wraps each call in
   * `events.withEffect(cardOwner, card, 'global-parameter')`, so a payout to a
   * foreign owner records as THEIR effect. Called only for steps actually made
   * (`raise.steps > 0`); never for a lowering, never for an ocean. Its forecast
   * twin is `grantForecast` on a `{kind: 'global'}` grant, asked at every seat.
   */
  onGlobalParameterRaised?(cardOwner: IPlayer, raise: GlobalParameterRaise): void;

  /**
   * Optional callback when a resource is added to this card.
   *
   * @param player the player whose turn it is. Expected to be the player that owns this card.
   * @param playedCard the card that received resources. Can be itself, but
   * for cards like Meat Industry, `playedCard` is the destination card.
   * @param count the number of resources added to `card`
   */
  onResourceAdded?(player: IPlayer, playedCard: ICard, count: number): void;


  /**
   * Optional callback when any player identifies a space.
   *
   * @param cardOwner the player who owns THIS CARD.
   * @param identifyingPlayer the player performing the identification action,
   *        or undefined if it is the neutral player (game setup or global event.)
   * @param token the underground resource token that was revealed.
   */
  onIdentificationByAnyPlayer?(cardOwner: IPlayer, identifyingPlayer: IPlayer | undefined, token: UndergroundResourceToken): void;
  onIdentification?: never;

  /**
   * Optional callback when this card owner claims an underground resource.
   *
   * @param player the player performing the claim.
   * @param space the space that was excavated.
   */
  onClaim?(player: IPlayer, isExcavate: boolean, space: Space | undefined): void;

  /**
   * Callback when `player` gains (or loses) production.
   *
  * @param player the card owner.
   */
  onProductionGain?(player: IPlayer, resource: Resource, amount: number): void;
  /**
   * Callback when the card owner completes ONE advance on the Delta Project
   * («Гидросеть») track. Fired once per committed `DeltaProjectExpansion.advance`
   * — the single authoritative movement pipeline — with the full logical
   * distance of that one move (jumped-over spaces count as steps). Never fired
   * for another player's move, a failed/rejected advance, or state restoration
   * (deserialization assigns the position directly).
   *
   * @param player the card owner (always the moving player).
   * @param steps the number of logical steps this single move advanced.
   */
  onDeltaTrackAdvance?(player: IPlayer, steps: number): void;
  /**
   * WHAT THIS CARD OWES ITS OWNER because ANY player — the owner, another
   * human, or MarsBot — actually completed one movement on the Delta Project
   * («Гидросеть») track (Social Heating).
   *
   * PURE, AND THAT IS THE POINT. The hook ANSWERS «what is owed»; it never
   * grants, logs, defers or moves anything. `deltaMovement.ts` is the single
   * caller, and it calls this for BOTH readers:
   *  - the COMMIT, which pays the answer out inside the movement's own event
   *    scope (so the journal reads «⟨card⟩ → +N ⟨resource⟩» under the move
   *    that caused it), and
   *  - the PLANNING PROJECTION, which promises the same answer for a move
   *    that has not happened yet.
   * One function, two readers ⇒ a promise and a payout cannot diverge; and an
   * effect that cannot mutate cannot re-trigger the movement that called it.
   *
   * `movement.steps` is the ACTUAL committed distance (`to - from`), never a
   * request — a capped move pays for the cells actually crossed. Return
   * `undefined` (or a non-positive amount) when nothing is owed.
   *
   * @param cardOwner the player holding THIS card — the beneficiary.
   * @param movement the committed (or projected) movement fact.
   */
  deltaMovementBonus?(cardOwner: IPlayer, movement: DeltaMovement): DeltaMovementBonus | undefined;
  /**
   * While this card sits in the moving player's tableau, ONE committed
   * multi-step advance on the Delta Project («Гидросеть») track grants the
   * reward of EVERY stage it crosses, in path order — not only the landing
   * stage's (Delta Surge). The 2 VP stage is positional and stays excluded
   * when crossed; a landing on it is untouched. Declared, never computed:
   * the shared traversal plan (`DeltaProjectExpansion.traversalSteps`) is
   * the single reader, for the preview and the commit alike.
   */
  readonly grantsDeltaTraversalRewards?: boolean;
  /**
   * Callback during the production phase. Used to reset between generations.
   *
   * @param player the card owner.
   */
  onProductionPhase?(player: IPlayer): void;

  /**
   * Callback when ANY player adds a colony.
   *
   * @param cardOwner the player who owns this card.
   * @param colonyOwner the player adding a colony.
   */
  onColonyAddedByAnyPlayer?(cardOwner: IPlayer, colonyOwner: IPlayer): void;
  onColonyAdded?: never;

  onNonCardTagAdded?(player: IPlayer, tag: Tag): void;
  onNonCardTagAddedByAnyPlayer?(cardOwner: IPlayer, tag: Tag): void;

  readonly cost?: number; /** Used with IProjectCard and PreludeCard. */
  readonly type: CardType;
  readonly requirements: ReadonlyArray<CardRequirementDescriptor>;
  readonly metadata: CardMetadata;

  /**
   * Per-instance state-specific warnings about this card's action.
   * This is ephemeral data that gets reset between evaluations.
   * It is not serialized.
   *
   * See: IProjectCard.additionalProjectCosts
   */
  readonly warnings: ReadonlySet<Warning>;
  addWarning(warning: Warning): void;
  clearWarnings(): void;

  /**
   * PRELUDE ORDER DEPENDENCY — what this prelude's effect is waiting for when
   * `canPlay` says no. CO-LOCATED with the card's own `canPlay` (never a
   * fork-only central table: when upstream changes the card, the declaration
   * is in the same diff), and deliberately declarative — the engine that
   * reasons about play ORDER (`server/preludes/preludeOutlook.ts`) knows no
   * card names at all, only these two vocabularies.
   *
   * Declare it ONLY when another prelude could plausibly create the condition.
   * A requirement nothing at the table can change (a global parameter this
   * generation) stays out: its honest verdict is «no effect», not «wait».
   */
  readonly preludeNeeds?: PreludeNeed;

  /**
   * …and what playing this prelude CREATES for someone else's `preludeNeeds`,
   * BEYOND what the engine already reads off `behavior` (a declarative draw or
   * an M€ gain). Only bespoke cards whose effect is invisible to `behavior`
   * need to say this; `playedPrelude` is never declared here (every prelude
   * creates it by being played).
   */
  readonly preludeProvides?: ReadonlyArray<PreludeNeed>;

  readonly behavior?: Behavior,

  /**
   * The Ares adjacency bonus/cost the tile this card places hands to its future
   * neighbours, when the card declares it OUTSIDE `behavior.tile` (the bespoke
   * placers: Ecological Zone, Industrial Center, Great Dam, Solar Farm). The
   * placement preview reads BOTH sources so "your tile will grant / will tax"
   * needs no per-tile table. `undefined` for a card that places no tile.
   */
  readonly adjacencyBonus?: AdjacencyBonus,

  /**
   * The declarative behavior run when this card's repeatable ACTION is used
   * (the `action` property on ActionCard / ActiveCorporationCard). Distinct from
   * the `action(player)` METHOD (IActionCard). Read by
   * `actionUnavailableReasons.ts` to derive structured "why can't I act" reasons
   * for declarative action cards. `undefined` for bespoke action cards (whose
   * logic lives in `action()` / `canAct()` directly).
   */
  readonly actionBehavior?: Behavior,

  /**
   * Returns the contents of the card's production box.
   *
   * Use with Robotic Workforce and Cyberia Systems.
   *
   * Prefer this to `produce`.
   * Prefer `behavior` to this.
   */
  productionBox?(player: IPlayer): Units;

  /**
   * Applies the production change for the card's production box.
   *
   * Use with Robotic Workforce and Cyberia Systems.
   * (Special case for Small Open Pit Mine.)
   *
   * Prefer both `productionBox` and `behavior` over this.
   */
  produce?(player: IPlayer): void;

  /** Terraform Rating predicted when this card is played */
  tr?: TRSource;
  /** Terraform Rating predicted when this card is played */
  computeTr?(player: IPlayer): TRSource;

  resourceCount: number;
  resourceType?: CardResource;
  protectedResources?: boolean;
  /** Indicates the tile built, which can be used in a variety of useful ways. */
  tilesBuilt: ReadonlyArray<TileType>;
  /** For Pharmacy Union, the card is effectively out of the game.. CEO uses it to ensure it can't be retriggered.  */
  isDisabled?: boolean;
  /**
   * Extra data that the game will serialize and deserialize along with the card.
   *
   * ONLY store plain JSON data. Classes, objects, functions, will all be incorrectly serialized.
   */
  data?: JSONValue;

  /**
   * Additional custom serialization for this card.
   */
  serialize?(serialized: SerializedCard): void;
  /**
   * Additional custom deserialization for this card.
   */
  deserialize?(serialized: SerializedCard): void;

  /** The generation the card was activated. Used for Duncan and Underworld cards. */
  generationUsed?: number;
}

export interface IActionCard {
  action(player: IPlayer): PlayerInput | undefined;
  canAct(player: IPlayer): boolean;
}

export function isIActionCard(object: any): object is IActionCard {
  return object !== undefined && object.canAct !== undefined && object.action !== undefined;
}
