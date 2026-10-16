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
 * of `resourcesHere` beside exactly ONE plain good is the role; several such
 * variants at ONE price are a CHOICE of goods, the same role with its `or`
 * (PL-484 — TR57, Atmo Collectors); anything the console cannot name as plain
 * goods (a bespoke action, two prices, a target to pick) leaves the holder
 * plain storage — generically or not at all.
 *
 * …with ONE door for a BESPOKE action (К-R1, the owner's decision 2026-10-12,
 * TR46): the card file DECLARES its good once (`ICard.holderActionGood`),
 * built from the very constants and reading its action and its preview use —
 * «ALL the data here → as many cards off the deck, keep 1» is the `look` good
 * with `spend: 'all'`. Its spec holds the declaration to the preview.
 */
import {Resource} from '../Resource';
import {Tag} from './Tag';

/**
 * A DECLARED role carries its PRICE — how many units of this card's resource one
 * delegate / one trade costs (the census spec's `votePrice`, TR66's mech). It is
 * what the console's readings stand on: «a delegate per 3 data» (never «per unit»
 * for a card that asks three), and the target step's «what +N does here» (К-T1,
 * TR48: «a delegate within reach: 3 / 3»). The card file states it from the very
 * constant its action reads.
 */
export type DeclaredHolderRole = {kind: 'delegate', price: number} | {kind: 'trade', price: number};

/** WHAT ONE PRESS of the card's declarative action buys with the resource stored here. */
export type ActionGood =
  | {kind: 'production', resource: Resource, amount: number}
  | {kind: 'stock', resource: Resource, amount: number}
  | {kind: 'cards', amount: number, tag?: Tag}
  | {kind: 'tr', amount: number}
  | {kind: 'global', parameter: 'temperature' | 'oxygen' | 'venus', steps: number}
  /** Every unit spent turns ONE card of the deck over; `keep` of them go to the hand, the rest to the discard (TR46). */
  | {kind: 'look', keep: number};

/**
 * `spend` units off this card → `good` — the holder's action role, as exported to the client card. `'all'`:
 * the action spends EVERY unit here at once (TR46 — the good then grows with the count).
 *
 * `or` — ONE PRICE, A CHOICE OF GOODS (PL-484, K-§6.1 — TR57 Mining Mechs «2 mechs → +1 steel OR titanium
 * production», Atmo Collectors «1 floater → 2 titanium OR 3 energy OR 4 heat»): the SAME `spend` buys any ONE of
 * `good` and these instead, in the printed order (`good` is the first printed). Absent for a single good. Every
 * reader of a good reads the whole set through `actionGoodsOf` — the first good alone is half a truth on a chip.
 */
export type HolderActionGood = {spend: number | 'all', good: ActionGood, or?: ReadonlyArray<ActionGood>};

/** Every good a holder's action role buys, in the printed order — one for a single good, all of them for a choice. */
export function actionGoodsOf(role: {good: ActionGood, or?: ReadonlyArray<ActionGood>}): ReadonlyArray<ActionGood> {
  return role.or === undefined || role.or.length === 0 ? [role.good] : [role.good, ...role.or];
}
