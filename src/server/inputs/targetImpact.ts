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
 *   - remove / steal a resource → ONE row of THAT resource: what the bot can lose
 *     of it (`AutomaTargeting.attackableStock`) → what is left. HOW the bot pays it
 *     (its Colonies storage first, its M€ supply standing in for the rest) is the
 *     bot ENGINE's convention and never reaches the UI — at the table the bot is
 *     «one more player», losing the resource it is attacked for (the owner,
 *     2026-10-30).
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
  const lost = p.storageLost + p.supplyLost;
  if (lost <= 0) {
    return [];
  }
  // ONE row of the resource attacked — the storage / M€-proxy split stays inside the bot's engine.
  const from = AutomaTargeting.attackableStock(target, resource);
  return [{icon: resource, from, to: from - lost, scope: 'stock'}];
}

export function computeTargetImpact(target: IPlayer, resource: Resource, amount: number, scope: 'stock' | 'production'): TargetImpact {
  const changes = target.isMarsBot ?
    (scope === 'production' ? botProduction(target, resource, amount) : botStock(target, resource, amount)) :
    (scope === 'production' ? humanProduction(target, resource, amount) : humanStock(target, resource, amount));
  return {color: target.color, changes};
}

/**
 * The `current → resulting` impact of removing a CARD-resource (microbe / animal /
 * floater) from MarsBot as a PLAYER-target — ONE row of that card-resource (what the
 * bot can lose of it → what is left), exactly as `botStock` reads a standard
 * resource: its storage and the M€ supply standing in are the engine's business. Only
 * MarsBot is ever a card-resource PLAYER-target: a human's card-resources live ON
 * cards (picked via `SelectCard`), so the human branch is empty.
 */
export function computeCardResourceTargetImpact(target: IPlayer, cardResource: CardResource, amount: number): TargetImpact {
  if (!target.isMarsBot) {
    return {color: target.color, changes: []};
  }
  const p = AutomaTargeting.previewCardResourceLoss(target, cardResource, amount);
  const lost = p.storageLost + p.supplyLost;
  if (lost <= 0) {
    return {color: target.color, changes: []};
  }
  // ONE row of the card-resource (client `iconClassFor` normalises the raw `CardResource` value to
  // `card-resource-…`) — never the M€ supply that stands in for it.
  const from = AutomaTargeting.attackableCardResourceStock(target, cardResource);
  return {color: target.color, changes: [{icon: cardResource, from, to: from - lost, scope: 'stock'}]};
}
