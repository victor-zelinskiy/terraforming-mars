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
import {CardDiscount} from '../../common/cards/Types';
import {CountableVictoryPoints} from '../../common/cards/CountableVictoryPoints';
import {TileType} from '../../common/TileType';
import {Behavior} from '../behavior/Behavior';
import {TRSource} from '../../common/cards/TRSource';
import {CardRequirementDescriptor} from '../../common/cards/CardRequirementDescriptor';
import {OneOrArray} from '../../common/utils/types';
import {JSONValue} from '../../common/Types';
import {IStandardProjectCard} from './IStandardProjectCard';
import {Warning} from '../../common/cards/Warning';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {ActionPreview} from '../../common/models/ActionPreviewModel';
import {Resource} from '../../common/Resource';
import {Units} from '../../common/Units';
import {SerializedCard} from '../SerializedCard';
import {UndergroundResourceToken} from '../../common/underworld/UndergroundResourceToken';

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
   * The +/- bonus applied to global parameter requirements, e.g. Adaptation Technology.
   *
   * `parameter` describes which global parameter is being tested.
   *
   * NB: Instances of `Card` allow using a JSON object to describe the global parameter bonus,
   * see `globalParameterRequirementBonus` for more information.
   */
  getGlobalParameterRequirementBonus(player: IPlayer, parameter: GlobalParameter): number;
  victoryPoints?: number | 'special' | CountableVictoryPoints,
  getVictoryPoints(player: IPlayer, context?: GetVictoryPointsContext): number;
  /** Returns any dynamic influence value */
  getInfluenceBonus?: (player: IPlayer) => number;
  /** Called when cards are played. Corps have a different callback */
  onCardPlayed?(player: IPlayer, card: ICard): PlayerInput | undefined | void;
  onCardPlayedByAnyPlayer?(thisCardOwner: IPlayer, card: ICard, activePlayer: IPlayer): PlayerInput | undefined | void;
  onCardPlayedFromAnyPlayer?: never;
  onStandardProject?(player: IPlayer, project: IStandardProjectCard): void;
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
  onGlobalParameterIncrease?(player: IPlayer, parameter: GlobalParameter, steps: number): void;

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

  readonly behavior?: Behavior,

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
