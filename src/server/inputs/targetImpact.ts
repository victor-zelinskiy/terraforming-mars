import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {IPlayer} from '../IPlayer';
import {TargetImpact, TargetImpactChange} from '../../common/models/TargetImpactModel';
import {AutomaTargeting} from '../automa/AutomaTargeting';

/**
 * The ONE universal helper that computes an attack's `current → resulting`
 * impact on a target — human OR MarsBot — so the picker (desktop + console)
 * renders SERVER truth and never derives numbers or branches on isMarsBot.
 *
 * Human: the plain stock / production field (M€ production floors at −5).
 * MarsBot: its public fields are STATIC placeholders, so the real change is —
 *   - decrease production → a board TRACK regresses (shown by the track's tag +
 *     the step count), via `AutomaTargeting.previewProductionRegression`;
 *   - remove / steal a resource → real Colonies storage of the type first, then
 *     the M€ supply, via `AutomaTargeting.previewStockLoss` (usually just M€).
 */
const MC_PRODUCTION_FLOOR = -5;

function humanStock(target: IPlayer, resource: Resource, amount: number): Array<TargetImpactChange> {
  const from = target.stock.get(resource);
  return [{icon: resource, from, to: Math.max(0, from - amount), scope: 'stock'}];
}

function humanProduction(target: IPlayer, resource: Resource, amount: number): Array<TargetImpactChange> {
  const from = target.production[resource];
  const floor = resource === Resource.MEGACREDITS ? MC_PRODUCTION_FLOOR : 0;
  return [{icon: resource, from, to: Math.max(floor, from - amount), scope: 'production', steps: amount}];
}

function botProduction(target: IPlayer, resource: Resource, amount: number): Array<TargetImpactChange> {
  const p = AutomaTargeting.previewProductionRegression(target.game, resource, amount);
  if (p === undefined || p.steps === 0) {
    return [];
  }
  // The row shows WHICH track (its identity tag) and how many divisions move.
  return [{icon: p.tag, from: p.from, to: p.to, scope: 'track', steps: p.steps}];
}

function botStock(target: IPlayer, resource: Resource, amount: number): Array<TargetImpactChange> {
  const p = AutomaTargeting.previewStockLoss(target, resource, amount);
  const changes: Array<TargetImpactChange> = [];
  // Real storage of the type (only under Colonies) — shown as the resource itself.
  if (p.storageLost > 0) {
    changes.push({icon: resource, from: p.storageFrom, to: p.storageFrom - p.storageLost, scope: 'stock'});
  }
  // The M€ supply proxy — the bot's «gold», the common (base-game) case.
  if (p.supplyLost > 0) {
    changes.push({icon: Resource.MEGACREDITS, from: p.supplyFrom, to: p.supplyFrom - p.supplyLost, scope: 'stock'});
  }
  return changes;
}

export function computeTargetImpact(target: IPlayer, resource: Resource, amount: number, scope: 'stock' | 'production'): TargetImpact {
  const changes = target.isMarsBot ?
    (scope === 'production' ? botProduction(target, resource, amount) : botStock(target, resource, amount)) :
    (scope === 'production' ? humanProduction(target, resource, amount) : humanStock(target, resource, amount));
  return {color: target.color, changes};
}

/**
 * The `current → resulting` impact of removing a CARD-resource (microbe / animal /
 * floater) from MarsBot as a PLAYER-target — its shipping-board storage of that
 * type first (shown as the card-resource itself), then the M€-supply proxy. Only
 * MarsBot is ever a card-resource PLAYER-target: a human's card-resources live ON
 * cards (picked via `SelectCard`), so the human branch is empty. Mirrors
 * `botStock` so the picker renders the SAME storage-row + M€-supply-row breakdown
 * a standard-resource attack shows.
 */
export function computeCardResourceTargetImpact(target: IPlayer, cardResource: CardResource, amount: number): TargetImpact {
  if (!target.isMarsBot) {
    return {color: target.color, changes: []};
  }
  const p = AutomaTargeting.previewCardResourceLoss(target, cardResource, amount);
  const changes: Array<TargetImpactChange> = [];
  // Real Colonies storage of the type — shown as the card-resource (client
  // `iconClassFor` normalises the raw `CardResource` value to `card-resource-…`).
  if (p.storageLost > 0) {
    changes.push({icon: cardResource, from: p.storageFrom, to: p.storageFrom - p.storageLost, scope: 'stock'});
  }
  // The M€-supply proxy — the bot's «gold», the common (base-game) case.
  if (p.supplyLost > 0) {
    changes.push({icon: Resource.MEGACREDITS, from: p.supplyFrom, to: p.supplyFrom - p.supplyLost, scope: 'stock'});
  }
  return {color: target.color, changes};
}
