import {CardName} from '../cards/CardName';
import {CardResource} from '../CardResource';
import {Color} from '../Color';
import {Resource} from '../Resource';
import {SpaceBonus} from '../boards/SpaceBonus';
import {SpaceId} from '../Types';

/**
 * How ONE Ares adjacency-bonus unit actually reached the placer:
 *  - `stock`         — added straight to a stock pool (`resource` says which);
 *  - `card-resource` — landed on the placer's SINGLE eligible card
 *                      (`cardResource` + `targetCard` name it);
 *  - `draw`          — a card draw (rides its own reveal cinematic, whose
 *                      source names the paying tile via `spaceId`);
 *  - `prompt`        — a deferred choice was opened (several eligible cards /
 *                      AddResourcesToCard) — the unit arrives via that prompt;
 *  - `none`          — the bonus could not apply (no card can hold it) and
 *                      was lost (the log names the loss).
 *
 * The console flies a chip only for `stock` / `card-resource`; everything
 * else already has its own honest surface.
 */
export type AresAdjacencyDelivery = 'stock' | 'card-resource' | 'draw' | 'prompt' | 'none';

/** ONE granted adjacency-bonus unit (one printed icon on the paying tile). */
export type AresAdjacencyGrantEntry = {
  /** The neighbouring tile that paid — the chip's physical origin. */
  readonly sourceSpaceId: SpaceId;
  /** The printed adjacency icon this unit came from. */
  readonly bonus: SpaceBonus;
  readonly delivery: AresAdjacencyDelivery;
  /** `delivery === 'stock'`: the stock pool that received the unit. */
  readonly resource?: Resource;
  /** `delivery === 'card-resource'`: what landed on the card. */
  readonly cardResource?: CardResource;
  /** `delivery === 'card-resource'`: the single card it landed on. */
  readonly targetCard?: CardName;
};

/** The Ares rule's OTHER half: the paying tile's OWNER earns M€. */
export type AresAdjacencyOwnerPayout = {
  /** The owner's tile the income came from — the coin's physical origin. */
  readonly sourceSpaceId: SpaceId;
  readonly ownerColor: Color;
  /** 1, or 2 with Marketing Experts — as actually granted. */
  readonly megacredits: number;
};

/**
 * Transient manifest of ONE placement's Ares adjacency payouts
 * (`AresHandler.earnAdjacencyBonuses` — the one place that already knows the
 * exact neighbours, channels and amounts).
 *
 * WHY THE SERVER HAS TO SAY THIS (the `OceanAdjacencyBonusModel` precedent):
 * the rule is server-authoritative and already applied — the client may not
 * re-derive it (Marketing Experts, the single-target card rule, the MarsBot
 * conversion all live here). But the premium console scenes need to show
 * WHICH tile paid WHOM: the placer's chips rise off the paying neighbours,
 * and the owner watches their own tile send them the M€. Purely
 * presentational: nothing reads it back, no resources move because of it.
 *
 * Lifecycle: a bounded ring on the game (never serialized into the saved
 * game; a server restart only loses the animation, never the money). All
 * contents are public facts — the game log already names every payout — so
 * the ring rides `GameModel` for every viewer, and each client consumes a
 * grant at most once by `seq`.
 */
export type AresAdjacencyGrantModel = {
  /** Monotonic consumption key (derived from `gameAge`, restart-safe). */
  readonly seq: number;
  /** The space the placed tile landed on (the payouts' cause). */
  readonly spaceId: SpaceId;
  readonly placerColor: Color;
  /** The placer's gains, one entry per adjacency icon, in board order. */
  readonly grants: ReadonlyArray<AresAdjacencyGrantEntry>;
  /** The neighbouring tiles' owner income, one entry per paying tile. */
  readonly ownerPayouts: ReadonlyArray<AresAdjacencyOwnerPayout>;
};
