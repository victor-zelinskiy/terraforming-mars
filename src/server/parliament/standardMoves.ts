/*
 * WHAT A CALL MOVED ON THE SEAT'S OWN COUNTERS — the standard stock and production, MEASURED around the call, never
 * re-derived from a rule (a card hook, a party effect, a law's passive answering inside the call all count, honestly).
 *
 * Two readers, one measure:
 *  · the cards' answers to a change of power (`ParliamentPhase.fireRulingPartyChanged` → the summary's `rulingAnswers`,
 *    TR62 / TR63 / TR64);
 *  · THE TABLE'S ANSWER TO A STEP OF THE CAREER (`ChairmanSeat.walkAgenda` → `AgendaAdvanceStep.answer`): a step pays a
 *    rating or a card and nothing in stock, so whatever the seat's stock / production gained around the step's own
 *    bonus is the table's answer to it — the ruling Greens' 2 M€ for the rating, first of all. The console tells it a
 *    beat after the step's own chip, as that step's answer (`parliamentRewardBeat`), never as a second story.
 */
import {IPlayer} from '../IPlayer';
import {Resource} from '../../common/Resource';
import {StandardMoves} from '../../common/parliament/ParliamentTypes';

/** The standard resources measured — the six rows of the player board. */
export const STANDARD_MOVE_RESOURCES: ReadonlyArray<Resource> = [Resource.MEGACREDITS, Resource.STEEL, Resource.TITANIUM, Resource.PLANTS, Resource.ENERGY, Resource.HEAT];

export type StandardMovesProbe = {stock: Map<Resource, number>, production: Map<Resource, number>};

/** The counters before the call. */
export function probeStandardMoves(player: IPlayer): StandardMovesProbe {
  return {
    stock: new Map(STANDARD_MOVE_RESOURCES.map((r) => [r, player.stock.get(r)])),
    production: new Map(STANDARD_MOVE_RESOURCES.map((r) => [r, player.production.get(r)])),
  };
}

/** What moved since `probe`, by resource — signed, non-zero moves only; undefined when nothing moved. */
export function standardMovesSince(player: IPlayer, probe: StandardMovesProbe): StandardMoves | undefined {
  const stock: Partial<Record<string, number>> = {};
  const production: Partial<Record<string, number>> = {};
  for (const resource of STANDARD_MOVE_RESOURCES) {
    const delta = player.stock.get(resource) - (probe.stock.get(resource) ?? 0);
    if (delta !== 0) {
      stock[resource] = delta;
    }
    const step = player.production.get(resource) - (probe.production.get(resource) ?? 0);
    if (step !== 0) {
      production[resource] = step;
    }
  }
  const hasStock = Object.keys(stock).length > 0;
  const hasProduction = Object.keys(production).length > 0;
  if (!hasStock && !hasProduction) {
    return undefined;
  }
  return {...(hasStock ? {stock} : {}), ...(hasProduction ? {production} : {})};
}

/** A deep copy of a measure (a record that is stored twice never shares its maps). */
export function copyStandardMoves(moves: StandardMoves): StandardMoves {
  return {
    ...(moves.stock === undefined ? {} : {stock: {...moves.stock}}),
    ...(moves.production === undefined ? {} : {production: {...moves.production}}),
  };
}
