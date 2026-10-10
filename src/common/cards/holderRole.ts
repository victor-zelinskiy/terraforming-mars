/**
 * WHAT A CARD'S STORED RESOURCE IS FOR — the ROLE of a holder (PL-030 /
 * PL-075, the TR34 walk): the one vocabulary the ДОП. РЕСУРСЫ satellite splits
 * its chips by and the played-target step names a candidate's value with, so
 * a mech on EVA Mechs («5 M€ for a Space card»), on Mech Sports («1 VP»), on
 * Mars Army Mechs («a delegate on a resolution») and on Automated Convoys («a
 * free trade») never read as one number under one coin.
 *
 * Two roles are STRUCTURAL on the client and need no declaration: a PAYMENT
 * unit (`CARD_FOR_SPENDABLE_RESOURCE` names the enabling card) and VP
 * (`victoryPoints.resourcesHere`). The two that no structure tells are
 * DECLARED by the card itself, co-located (`ICard.resourceRole`, exported to
 * the client card): a resource SPENT FOR A DELEGATE (the census family — TR15,
 * TR24, TR34, TR35) and a resource SPENT FOR A TRADE (TR66). A holder with no
 * role of either kind is plain STORAGE and says nothing.
 *
 * The THIRD structural role (PL-135, the TR40 walk): the resource BUYS A GOOD
 * through the card's own declarative ACTION — «2 data → +1 plant production»
 * (TR38), «1 mech → +1 plant production» (TR40), «3 data → a card» (TR02),
 * «4 data → a Space card» (TR05), «1 floater → +1 M€ production» (Local
 * Shading). It is DERIVED from `action` at manifest-export time
 * (`server/cards/holderActionGood.ts`) and never declared by a card: a spend
 * of `resourcesHere` beside exactly ONE plain good is the role; anything the
 * console cannot name as one good (a bespoke action, a choice of goods, a
 * target to pick) leaves the holder plain storage — generically or not at all.
 */
import {Resource} from '../Resource';
import {Tag} from './Tag';

export type DeclaredHolderRole = {kind: 'delegate'} | {kind: 'trade'};

/** WHAT ONE PRESS of the card's declarative action buys with the resource stored here. */
export type ActionGood =
  | {kind: 'production', resource: Resource, amount: number}
  | {kind: 'stock', resource: Resource, amount: number}
  | {kind: 'cards', amount: number, tag?: Tag}
  | {kind: 'tr', amount: number}
  | {kind: 'global', parameter: 'temperature' | 'oxygen' | 'venus', steps: number};

/** `spend` units off this card → `good` — the holder's action role, as exported to the client card. */
export type HolderActionGood = {spend: number, good: ActionGood};
