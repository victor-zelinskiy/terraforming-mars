/*
 * @console-shared LIVE — THE ROLE OF A HOLDER: what a card's stored resource
 * is FOR (PL-030 / PL-075, the TR34 walk — `common/cards/holderRole.ts`).
 *
 * ONE reading, two consumers: the ДОП. РЕСУРСЫ satellite splits a resource
 * type's chip by it («[mech] 1 · 5 M€» beside «[mech] 2 · delegates» — never
 * three mechs under one coin when two of them buy delegates), and the
 * played-target step prints it under a candidate («a delegate on a resolution
 * per unit» — the value the counter alone never said). Pure, manifest-read,
 * no card name anywhere: a PAYMENT role is the enabling card of a spendable
 * unit, a VP role is the card's own printed `resourcesHere` rule, DELEGATE
 * and TRADE are the card's declaration, everything else is plain STORAGE.
 */
import {CardName} from '@/common/cards/CardName';
import {CardResource} from '@/common/CardResource';
import {DEFAULT_PAYMENT_VALUES} from '@/common/inputs/Payment';
import {CARD_FOR_SPENDABLE_RESOURCE, SPENDABLE_CARD_RESOURCES, SpendableCardResource} from '@/common/inputs/Spendable';
import {getCard} from '@/client/cards/ClientCardManifest';
import {CONTEXT_FOR_CARD_UNIT, MC_CONTEXT_KEYS, RailMcContext} from '@/client/console/railValueModel';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';

export type HolderRole =
  /** The enabling card of a payment unit — one unit pays `rate` M€ where `context` says. */
  | {kind: 'payment', unit: SpendableCardResource, rate: number, context: RailMcContext}
  /** The card's printed «VP per resources here» rule. */
  | {kind: 'vp', per: number, each: number}
  /** The card's declaration: the resource buys a delegate on a resolution. */
  | {kind: 'delegate'}
  /** The card's declaration: the resource buys a free trade. */
  | {kind: 'trade'}
  /** Storage with no role the console can name. */
  | {kind: 'store'};

export type HolderRoleKind = HolderRole['kind'];

/** The role of the resource a card stores — `store` for a card the manifest does not know. */
export function holderRoleOf(name: CardName): HolderRole {
  const card = getCard(name);
  if (card === undefined) {
    return {kind: 'store'};
  }
  if (card.resourceRole !== undefined) {
    return card.resourceRole;
  }
  const unit = SPENDABLE_CARD_RESOURCES.find((u) => CARD_FOR_SPENDABLE_RESOURCE[u] === name);
  if (unit !== undefined) {
    return {kind: 'payment', unit, rate: DEFAULT_PAYMENT_VALUES[unit], context: CONTEXT_FOR_CARD_UNIT[unit]};
  }
  const vp = card.victoryPoints;
  if (typeof vp === 'object' && vp.resourcesHere !== undefined) {
    return {kind: 'vp', per: vp.per ?? 1, each: vp.each ?? 1};
  }
  return {kind: 'store'};
}

/**
 * A role CLAIMS something about every unit — it is tender, it buys a
 * delegate, it buys a trade — or it does not: a VP rule and plain storage
 * are what a stored resource IS by default, so they stay ONE plain chip
 * (Tardigrades beside Nitrite Reducing Bacteria is still «microbes»), and
 * only a claiming role stands apart from it.
 */
export function holderRoleClaims(kind: HolderRoleKind): boolean {
  return kind === 'payment' || kind === 'delegate' || kind === 'trade';
}

/**
 * The satellite / explorer KEY of a holder group: the resource's own key
 * for the plain group and for a type that is not split (every consumer's
 * address stays what it was), the resource and the role for a claiming role
 * of a split type.
 */
export function holderGroupKey(resource: CardResource, role: HolderRole | undefined, split: boolean): string {
  const base = cardResourceKey(resource);
  return split && role !== undefined && holderRoleClaims(role.kind) ? `${base}:${role.kind}` : base;
}

/** The chip's one-word caption of a role (an i18n key) — only the roles the console names; `store` has none. */
export const HOLDER_ROLE_CAPTION: Readonly<Record<Exclude<HolderRoleKind, 'store'>, string>> = {
  payment: 'money',
  vp: 'VP',
  delegate: 'Delegates',
  trade: 'trade',
};

/** The icon a role badge carries (the shared icon vocabulary); the VP role carries its own shield instead. */
export const HOLDER_ROLE_ICON: Readonly<Partial<Record<HolderRoleKind, string>>> = {
  payment: 'megacredits',
  delegate: 'delegate',
  trade: 'trade',
};

/**
 * THE VALUE LINE of a role — what ONE unit of the resource is worth on this
 * holder, for the target step's rail and the badge's aria: an i18n key, its
 * number params, and a TAIL phrase (its own key — the payment's «where»,
 * translated beside the label). Undefined for `vp` (the VP line is the
 * step's own, authoritative, per candidate) and for `store`.
 */
export function holderRoleReading(role: HolderRole): {label: string, params?: ReadonlyArray<string>, tail?: string} | undefined {
  switch (role.kind) {
  case 'payment':
    return {label: 'Pays ${0} M€ per unit', params: [String(role.rate)], tail: MC_CONTEXT_KEYS[role.context]};
  case 'delegate':
    return {label: 'A delegate on a resolution per unit'};
  case 'trade':
    return {label: 'A free trade per unit'};
  default:
    return undefined;
  }
}
