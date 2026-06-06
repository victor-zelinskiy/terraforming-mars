import {Resource} from '../../common/Resource';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {IPlayer} from '../IPlayer';

/*
 * Thin, stable builders for an action card's "why can't I act right now" reason
 * (the `ICard.actionUnavailableReason` hook). The hook lives IN the card file,
 * right next to `canAct`, ON PURPOSE: when a card's `canAct` changes (a refactor
 * or an upstream merge), the reason is in the same diff, so it can't silently go
 * stale — whereas a centralized table is a fork-only file upstream never touches,
 * so a `canAct` change there merges cleanly and the table reason rots unnoticed.
 *
 * These builders only standardise the COMMON reason shapes (so the hook stays a
 * one-liner and the wording stays consistent); the per-card CHOICE — which
 * builder, and any card-specific message — is expressed in the card file.
 * Consumed by `src/server/models/actionUnavailableReasons.ts`.
 */

export const notEnoughEnergy = (): UnplayableReason => ({type: 'resource', message: 'Not enough energy', resource: Resource.ENERGY});
export const notEnoughTitanium = (): UnplayableReason => ({type: 'resource', message: 'Not enough titanium', resource: Resource.TITANIUM});
export const notEnoughMC = (): UnplayableReason => ({type: 'megacredits', message: 'Not enough M€'});
/** Pure-M€ shortfall with the exact amount still needed (lower bound). */
export const needMoreMC = (player: IPlayer, cost: number): UnplayableReason =>
  ({type: 'megacredits', message: 'Need ${0} more M€', params: [String(Math.max(1, cost - player.spendableMegacredits()))]});
export const noResourcesHere = (): UnplayableReason => ({type: 'count', message: 'Not enough resources on this card'});
export const noEnergyProduction = (): UnplayableReason => ({type: 'production', message: 'No energy production'});
export const deckEmpty = (): UnplayableReason => ({type: 'rule', message: 'The deck is empty'});
/** A card-specific reason naming the exact unmet condition (see each card's hook). */
export const ruleReason = (message: string): UnplayableReason => ({type: 'rule', message});
export const targetReason = (message: string): UnplayableReason => ({type: 'target', message});
export const placementReason = (message: string): UnplayableReason => ({type: 'placement', message});
