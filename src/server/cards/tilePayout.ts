import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {Space} from '../boards/Space';
import {CardResource} from '../../common/CardResource';
import {AdjacencyAmountBasis, TilePayoutCause} from '../../common/models/CardAdjacencyPayoutModel';
import {CardResourceBasis} from '../../common/events/EventImpact';
import {SpaceId} from '../../common/Types';
import {Units} from '../../common/Units';
import {From} from '../logs/From';

/**
 * «A TILE PAYS A CARD» — the ONE writer of the board scene's record
 * (`IGame.cardAdjacencyPayouts`): a card resource paid BECAUSE OF A PLACED
 * TILE, by the cells that caused it. Two causes today:
 *
 *  · `adjacent-cities` — TR21 Arboretum: every city beside the greenery sends
 *    its units onto the card the player chose (`cards/adjacentCityPayout.ts`);
 *  · `tile-placed` — TR30 Red Museum: the placed tile itself pays its owner's
 *    card (`turmoilRedux/RedMuseum.ts`).
 *
 * A card pays through {@link payTileToCard} and nothing else: ONE
 * `addResourceTo` (logged, attributed, its reactions — Martian Fiber's +1 M€
 * per data — firing as for any addition), the table's answer MEASURED around
 * it, and the record written from what really landed. The client plays that
 * record (the tokens leave the cells that sent them, the counter ticks on
 * each touchdown) and never infers «a tile paid» from a counter's delta.
 * Purely presentational: a restart loses the animation, never the rule.
 */

/** Which cells sent the units, and why — the record's script. */
export type TilePayoutScript = {
  cause: TilePayoutCause;
  /**
   * The cells that SENT the units, each with its share — the paying
   * neighbours. Omitted for `tile-placed`: the placed cell carries the whole
   * amount.
   */
  neighbours?: ReadonlyArray<{spaceId: SpaceId, units: number}>;
  /** What one unit counts (a per-neighbour amount only). */
  basis?: AdjacencyAmountBasis;
};

/** How the ONE addition is logged and attributed (`Player.addResourceTo`'s own options). */
export type TilePayoutAddition = {log: boolean, from?: From, basis?: CardResourceBasis};

/**
 * PAY `amount` units of `resource` onto `target` because of the tile on
 * `space`, and publish the scene's record. `source` is the card whose printed
 * effect paid (the museum pays itself; the Arboretum pays the card the player
 * chose). Synchronous — the caller is the effect's own scope.
 */
export function payTileToCard(
  owner: IPlayer,
  source: ICard,
  space: Space,
  target: ICard,
  resource: CardResource,
  amount: number,
  script: TilePayoutScript,
  addition: TilePayoutAddition,
): void {
  if (amount <= 0) {
    return;
  }
  const before = target.resourceCount;
  // What the table answers is MEASURED around the one addition — the scene flies it, nobody re-derives it.
  const stockBefore = owner.stock.asUnits();
  owner.addResourceTo(target, {qty: amount, ...addition});
  const stockAfter = owner.stock.asUnits();
  const reactions: Partial<Units> = {};
  for (const key of Object.keys(stockAfter) as Array<keyof Units>) {
    const delta = stockAfter[key] - stockBefore[key];
    if (delta > 0) {
      reactions[key] = delta;
    }
  }
  recordTilePayout(owner, source, space, {
    script,
    target: target.name,
    resource,
    amount,
    before,
    reactions,
  });
}

/** THE WRITER — the only caller of `IGame.publishCardAdjacencyPayout`. */
function recordTilePayout(
  owner: IPlayer,
  source: ICard,
  space: Space,
  paid: {script: TilePayoutScript, target: ICard['name'], resource: CardResource, amount: number, before: number, reactions: Partial<Units>},
): void {
  const {script} = paid;
  owner.game.publishCardAdjacencyPayout({
    cause: script.cause,
    color: owner.color,
    card: source.name,
    spaceId: space.id,
    ...(script.basis !== undefined ? {basis: script.basis} : {}),
    neighbours: script.neighbours ?? [{spaceId: space.id, units: paid.amount}],
    target: paid.target,
    resource: paid.resource,
    amount: paid.amount,
    before: paid.before,
    ...(Object.keys(paid.reactions).length > 0 ? {reactions: paid.reactions} : {}),
  });
}
