import {IPlayer} from '../IPlayer';
import {ICard} from './ICard';
import {Space} from '../boards/Space';
import {CardResource} from '../../common/CardResource';
import {AdjacencyAmountBasis} from '../../common/models/CardAdjacencyPayoutModel';
import {CardResourceBasis} from '../../common/events/EventImpact';
import {BoardFact} from '../../common/boards/BoardInformationFacts';
import {ActionPreviewStep} from '../../common/models/ActionPreviewModel';
import {Message} from '../../common/logs/Message';
import {Units} from '../../common/Units';
import {adjacentCitySpaces, cityTiersOf, countCityTiers} from '../boards/cityStack';
import {cardSource} from '../inputs/choiceContext';
import {SelectResourceTarget} from '../deferredActions/SelectResourceTarget';
import {recordSkippedEffect} from '../deferredActions/skippedEffect';
import {grantReactionFacts} from '../models/effectForecast';
import * as actionPreviews from './actionPreviews';
import * as placementPreviews from './placementPreviews';

/**
 * «ADD 1 <RESOURCE> TO ANY CARD FOR EACH CITY ADJACENT TO THIS TILE» — the
 * class of a card reward whose AMOUNT THE CELL DECIDES and whose CAUSE is the
 * tile's neighbourhood (Turmoil Redux TR21 Arboretum, the first;
 * docs/TURMOIL_REDUX_ARBORETUM.md). Every surface of the reward stands on the
 * ONE count below, so the composer, the dossier, the payout, the journal and
 * the scene cannot read apart:
 *
 *  · THE COUNT — `adjacentCityTiers` (`boards/cityStack.ts`): the cities of
 *    ANY owner beside the tile (a neutral solo city, the Capital, Ocean City,
 *    New Holland), a STACK counted per tier — «for each city» is a quantity,
 *    and a quantity of cities sums the stacks (the fork's law, Commercial
 *    District's count). Read AFTER the tile lands, around the tile.
 *  · THE TARGET — `SelectResourceTarget`, asked BEFORE the cell (the fork's
 *    «card + tile» order): pre-collected in the composer, so the whole play
 *    stays reversible and the dossier knows where the units land. Asked only
 *    when SOME legal cell has a neighbouring city; a single holder is still
 *    asked (no auto-select). All N units go to that ONE card.
 *  · ZERO is the rule working, never a loss: no event of a skip, the dossier
 *    and the journal say «no adjacent city».
 *  · N > 0 WITH NO HOLDER is a NAMED skip with its size (`recordSkippedEffect`
 *    — the composer warned before the play, the dossier on every paying cell).
 *  · THE JOURNAL carries the reason: ONE line «… for N adjacent cities» and
 *    ONE `card-resource-changed` event with its `basis`.
 *  · THE SCENE reads one record (`IGame.recordCardAdjacencyPayout`): which
 *    neighbours paid how many units onto which card.
 *
 * Every reaction to «a resource was added» answers through the engine's own
 * `addResourceTo` (Martian Fiber's +1 M€ per data) — nothing is programmed here.
 */

/** The basis every surface names — what one unit counts. */
export const ADJACENT_CITY_BASIS: AdjacencyAmountBasis = {per: 'adjacent-city'};

/** The journal's unit (the event's `basis.unitKey`): its plural group agrees with the count. */
export const ADJACENT_CITY_UNIT = 'adjacent {city|cities}';

/** The cities beside the cell: the cells (board order) and the count they make — the stacks summed. */
export function adjacentCities(player: IPlayer, space: Space): {cells: ReadonlyArray<Space>, count: number} {
  const cells = adjacentCitySpaces(player.game.board, space);
  return {cells, count: countCityTiers(cells)};
}

/** Does SOME cell of `spaces` have a city beside it — i.e. could the reward pay at all? (Rule: ask the target only then.) */
export function someCellPays(player: IPlayer, spaces: ReadonlyArray<Space>): boolean {
  return spaces.some((space) => adjacentCities(player, space).count > 0);
}

/** The play's target step, or `undefined` when no legal cell could pay (then nothing is asked). */
export function adjacentCityTarget(player: IPlayer, source: ICard, resource: CardResource, legalCells: ReadonlyArray<Space>, title: string | Message): SelectResourceTarget | undefined {
  if (!someCellPays(player, legalCells)) {
    return undefined;
  }
  return new SelectResourceTarget(player, resource, cardSource(source), ADJACENT_CITY_BASIS, title);
}

/**
 * The COMPOSER's half: the target step BEFORE the placement, or — when no card
 * can hold the resource — the warning that names the lost effect (no
 * magnitude: the number does not exist before the cell). Nothing at all when
 * no legal cell could pay.
 */
export function adjacentCityPreviewSteps(step: SelectResourceTarget | undefined, warning: string | Message): Array<ActionPreviewStep> {
  if (step === undefined) {
    return [];
  }
  const target = actionPreviews.resourceTargetStep(step);
  if (target !== undefined) {
    return [target];
  }
  return [actionPreviews.warningNote(warning, {resource: step.resource, skipped: {label: actionPreviews.SKIPPED_LABEL.addToCard}})];
}

/**
 * THE PAYOUT, after the tile landed on `space`: count the cities around it,
 * add all N units to the chosen card in ONE `addResourceTo` (its reactions —
 * Martian Fiber — fire as for any addition), write ONE journal line with the
 * reason and ONE event with the `basis`, and publish the record for the scene.
 */
export function payPerAdjacentCity(player: IPlayer, source: ICard, space: Space, resource: CardResource, target: SelectResourceTarget | undefined): void {
  const game = player.game;
  const {cells, count} = adjacentCities(player, space);
  if (count === 0) {
    game.log('${0}: no city adjacent to the tile — nothing to add', (b) => b.card(source));
    return;
  }
  const chosen = target?.chosen;
  if (chosen !== undefined) {
    land(player, source, space, cells, count, resource, chosen);
    return;
  }
  const late = new SelectResourceTarget(player, resource, cardSource(source), ADJACENT_CITY_BASIS);
  if (late.getCards().length === 0) {
    // N > 0 and nowhere to put it: the named loss, with its size.
    recordSkippedEffect(player, actionPreviews.SKIP_REASON.noHolder, actionPreviews.skippedAddToCard(resource, count));
    return;
  }
  // Unreachable through a play (the target is asked BEFORE the cell whenever
  // some legal cell pays) — a guard, never a silent loss: ask now, then pay.
  game.defer(late.andThen((card) => {
    if (card !== undefined) {
      land(player, source, space, cells, count, resource, card);
    }
  }));
}

function land(player: IPlayer, source: ICard, space: Space, cells: ReadonlyArray<Space>, count: number, resource: CardResource, card: ICard): void {
  const game = player.game;
  const before = card.resourceCount;
  const basis: CardResourceBasis = {count, unitKey: ADJACENT_CITY_UNIT};
  // What the table answers (Martian Fiber's M€) is MEASURED around the one addition — the scene flies it, nobody re-derives it.
  const stockBefore = player.stock.asUnits();
  player.addResourceTo(card, {qty: count, log: false, from: {card: source}, basis});
  const stockAfter = player.stock.asUnits();
  const reactions: Partial<Units> = {};
  for (const key of Object.keys(stockAfter) as Array<keyof Units>) {
    const delta = stockAfter[key] - stockBefore[key];
    if (delta > 0) {
      reactions[key] = delta;
    }
  }
  game.log('${0} added ${1} ${2} to ${3} for ${4} adjacent {city|cities}', (b) =>
    b.player(player).number(count).cardResource(resource).card(card).number(count));
  game.recordCardAdjacencyPayout({
    color: player.color,
    card: source.name,
    spaceId: space.id,
    basis: ADJACENT_CITY_BASIS,
    neighbours: cells.map((cell) => ({spaceId: cell.id, units: cityTiersOf(cell)})),
    target: card.name,
    resource,
    amount: count,
    before,
    ...(Object.keys(reactions).length > 0 ? {reactions} : {}),
  });
}

/**
 * THE DOSSIER's half — what the reward does on the cell under the cursor, from
 * the SAME count the payout makes: «+N <resource> · for N adjacent cities»
 * naming the paying cells (the board lights exactly them) and landing on the
 * chosen card (the client prints its `before → after`); what the table
 * answers to that grant (the effect forecast's grant pass — Martian Fiber);
 * «no adjacent city» as a rule at zero; the named loss on a paying cell with
 * no holder. Read-only: the tile is hypothetical, its neighbours are not.
 */
export function adjacentCityPayoutFacts(player: IPlayer, source: ICard, space: Space, resource: CardResource): Array<BoardFact> {
  const {cells, count} = adjacentCities(player, space);
  if (count === 0) {
    return [placementPreviews.noEffectHere(source, 'No adjacent cities — no data from this tile', {id: `card-${source.name}-no-cities`})];
  }
  const icon = actionPreviews.cardResourceIcon(resource);
  const spaces = cells.map((cell) => cell.id);
  const holders = new SelectResourceTarget(player, resource, cardSource(source), ADJACENT_CITY_BASIS).getCards();
  if (holders.length === 0) {
    return [{
      // No `spaces`: nothing pays — the board lights no city for a payout that has nowhere to land.
      ...placementPreviews.gain(source, {icon, amount: count, direction: 'gain'}, 'No card can hold the data — it is lost', {
        id: `card-${source.name}-lost`, severity: 'warning',
      }),
      timing: 'warning',
    }];
  }
  const out: Array<BoardFact> = [{
    ...placementPreviews.gain(source, {icon, amount: count, direction: 'gain'}, 'For ${0} adjacent {city|cities}', {
      id: `card-${source.name}-adjacent-cities`, spaces, params: [String(count)],
    }),
    landsOnChosenCard: {resource: icon},
  }];
  const chip = actionPreviews.cardResourceGain(resource, count);
  for (const fact of grantReactionFacts(player, source, [chip])) {
    const reaction = placementPreviews.forecastReaction(fact);
    if (reaction !== undefined) {
      out.push(reaction);
    }
  }
  return out;
}
