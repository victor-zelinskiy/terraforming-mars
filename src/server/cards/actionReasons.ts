import {Resource} from '../../common/Resource';
import {CardResource} from '../../common/CardResource';
import {UnplayableReason} from '../../common/cards/UnplayableReason';
import {IPlayer} from '../IPlayer';

/*
 * Thin, stable builders for a card's "why can't I do this right now" reason —
 * shared by BOTH the `ICard.actionUnavailableReason` hook (why an activatable
 * action is unavailable, consumed by `actionUnavailableReasons.ts`) AND the
 * `ICard.unplayableReason` hook (why a card in hand can't be PLAYED, consumed by
 * `unplayableReasons.ts`). The hook lives IN the card file, right next to
 * `canAct` / `bespokeCanPlay`, ON PURPOSE: when that gate changes (a refactor or
 * an upstream merge), the reason is in the same diff, so it can't silently go
 * stale — whereas a centralized table is a fork-only file upstream never touches,
 * so a gate change there merges cleanly and the table reason rots unnoticed.
 *
 * These builders only standardise the COMMON reason shapes (so the hook stays a
 * one-liner and the wording stays consistent); the per-card CHOICE — which
 * builder, and any card-specific message — is expressed in the card file.
 */

export const notEnoughEnergy = (): UnplayableReason => ({type: 'resource', message: 'Not enough energy', resource: Resource.ENERGY});
export const notEnoughTitanium = (): UnplayableReason => ({type: 'resource', message: 'Not enough titanium', resource: Resource.TITANIUM});
export const notEnoughMC = (): UnplayableReason => ({type: 'megacredits', message: 'Not enough M€'});
/** Pure-M€ shortfall with the exact amount still needed (lower bound). */
export const needMoreMC = (player: IPlayer, cost: number): UnplayableReason =>
  ({type: 'megacredits', message: 'Need ${0} more M€', params: [String(Math.max(1, cost - player.spendableMegacredits()))]});
export const noResourcesHere = (): UnplayableReason => ({type: 'count', message: 'Not enough resources on this card'});

/**
 * «N of M <resource> on this card» — a declared price «spend M from here» the card's own stock cannot cover (PL-197):
 * the count, the need AND the resource named, so the player reads how far the card is, not just that it is short.
 * Each template carries its own plural group, resolved by the client pipeline against the nearest number to its left —
 * the NEED (`${1}`) — so «0 of 1 mech» / «1 of 2 mechs» and the RU genitive «из 1 меха» / «из 2 мехов» are the
 * translator's forms, never a concatenated suffix. A resource without a row reads the counted generic.
 */
const RESOURCES_HERE_SHORT: Partial<Record<CardResource, string>> = {
  [CardResource.MECH]: '${0} of ${1} {mech|mechs} on this card',
  [CardResource.DATA]: '${0} of ${1} data on this card',
  [CardResource.MICROBE]: '${0} of ${1} {microbe|microbes} on this card',
  [CardResource.ANIMAL]: '${0} of ${1} {animal|animals} on this card',
  [CardResource.FLOATER]: '${0} of ${1} {floater|floaters} on this card',
  [CardResource.FIGHTER]: '${0} of ${1} {fighter|fighters} on this card',
  [CardResource.SCIENCE]: '${0} of ${1} science {resource|resources} on this card',
  [CardResource.ASTEROID]: '${0} of ${1} {asteroid|asteroids} on this card',
  [CardResource.CAMP]: '${0} of ${1} {camp|camps} on this card',
  [CardResource.LEVERAGE]: '${0} of ${1} leverage on this card',
};
/** The counted generic for a resource without its own row. */
export const RESOURCES_HERE_SHORT_GENERIC = '${0} of ${1} {resource|resources} on this card';

/** The template that names `resource` (the counted generic when it has no row). */
export function resourcesHereShortMessage(resource: CardResource | undefined): string {
  return (resource !== undefined ? RESOURCES_HERE_SHORT[resource] : undefined) ?? RESOURCES_HERE_SHORT_GENERIC;
}

/** The reason itself: `have` on the card, `need` asked, `current` for the «now» badge. */
export const resourcesHereShort = (resource: CardResource | undefined, have: number, need: number): UnplayableReason =>
  ({type: 'count', message: resourcesHereShortMessage(resource), params: [String(have), String(need)], current: have});
export const noEnergyProduction = (): UnplayableReason => ({type: 'production', message: 'No energy production'});
export const noHeatProduction = (): UnplayableReason => ({type: 'production', message: 'No heat production'});
/** The card must reduce M€ production but the player is already at the −5 floor. */
export const cannotReduceMcProduction = (): UnplayableReason => ({type: 'production', message: 'Cannot reduce M€ production'});
/** Not enough plants in stock to pay a card's bespoke plant cost (icon + current). */
export const notEnoughPlants = (player: IPlayer): UnplayableReason =>
  ({type: 'resource', message: 'Not enough plants', resource: Resource.PLANTS, current: player.plants});
/** Not enough steel in stock to pay a card's bespoke steel cost (icon + current). */
export const notEnoughSteel = (player: IPlayer): UnplayableReason =>
  ({type: 'resource', message: 'Not enough steel', resource: Resource.STEEL, current: player.steel});
/** No card holding a floater to spend (FLOATER is a card resource, so no stock icon). */
export const notEnoughFloaters = (): UnplayableReason => ({type: 'count', message: 'Not enough floaters'});
/** No card of the player's own holds a fighter to spend (FIGHTER is a card resource, so no stock icon). */
export const notEnoughFighters = (): UnplayableReason => ({type: 'count', message: 'No fighters on your cards'});
export const deckEmpty = (): UnplayableReason => ({type: 'rule', message: 'The deck is empty'});
/** A card-specific reason naming the exact unmet condition (see each card's hook). */
export const ruleReason = (message: string): UnplayableReason => ({type: 'rule', message});
export const targetReason = (message: string): UnplayableReason => ({type: 'target', message});
export const placementReason = (message: string): UnplayableReason => ({type: 'placement', message});
