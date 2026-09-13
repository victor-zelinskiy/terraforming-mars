import {CardResource} from '../../common/CardResource';
import {Resource} from '../../common/Resource';
import {TileType} from '../../common/TileType';
import {GlobalParameter} from '../../common/GlobalParameter';
import {ICard} from './ICard';

/**
 * What the CO-LOCATED forecast hooks (`ICard.cardPlayedForecast` /
 * `grantForecast` / `tilePlacedForecast`, `MarsBotCorp.humanCardPlayedForecast`)
 * are told about the operation being previewed — the analog of
 * `PlacementPreviewContext` for the effect forecast.
 *
 * A hook reads the SAME predicates its live twin reads (the played card's
 * tags / type / printed cost, the reacting card's own resource count, the
 * owner's stock) and answers with facts. It must never defer, log, add or
 * mutate — the engine's purity guard serializes the game before and after.
 */
export type EffectForecastContext = {
  /** A card PLAY (hand / prelude / corporation) or a card ACTION activation. */
  operation: 'play' | 'action';
  /** The card the operation is about — played, or whose action runs. */
  card: ICard;
  /**
   * The tiles this operation will put down (from the preview's board
   * placement steps / staged placement) — what the tile triggers react to.
   * Empty when nothing is placed.
   */
  tiles: ReadonlyArray<EffectForecastTile>;
  /**
   * The branch the facts are being computed for (its POSITION in
   * `ActionPreview.branches`), when the operation has several. `undefined`
   * for the branch-independent pass.
   */
  branchPos?: number;
};

/** One tile the operation places, as the tile triggers see it. */
export type EffectForecastTile = {
  tileType?: TileType;
  /** How many identical tiles this step places (Lake Marineris: 2). */
  count: number;
  countsAsCity: boolean;
  countsAsOcean: boolean;
  countsAsGreenery: boolean;
  /** The eligibility kind of the placement prompt (`city` / `ocean` / `land` / …). */
  placementType?: string;
  /**
   * The tile lands on a RESERVED OFF-MARS slot (Ganymede Colony, Phobos Space
   * Haven — `behavior.city.space` names a `SpaceType.COLONY` cell, placed
   * with no prompt). The live hooks that read `space.spaceType` (Tharsis
   * Republic's production step) key on it; a Mars placement is `false`.
   */
  offMars: boolean;
};

/**
 * ONE thing the operation GRANTS its actor — the input of the second-order
 * hooks (`onProductionGain` → Manutech / Development Manager,
 * `onResourceAdded` → Meat Industry / Topsoil Contract). Built by the engine
 * FROM the preview's own `ActionEffect` chips (the server already computed
 * them) and from the exact first-order facts; a hook never re-reads the
 * card's behavior.
 */
export type EffectForecastGrant =
  | {kind: 'production', resource: Resource, amount: number}
  | {kind: 'stock', resource: Resource, amount: number}
  | {kind: 'cardResource', resource: CardResource, amount: number, target: 'self' | 'any'}
  | {kind: 'tr', amount: number}
  | {kind: 'global', parameter: GlobalParameter, steps: number}
  | {kind: 'cards', amount: number};
