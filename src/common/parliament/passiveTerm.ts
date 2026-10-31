/*
 * THE TERM OF A PASSIVE, as data (Turmoil Redux — the vote panel's «while enacted», P77 · DH).
 *
 * A law's passive is a set of engine hooks (`ResolutionPassive.cardDiscount`, `resourceValueBonus`, `tagBonus`), and a
 * hook is a FUNCTION: no surface outside the engine can read «3 M€ off a Building card» out of it. Where a passive's
 * effect is a NUMBER for a seat — what it takes off a card, what it adds to a unit, how many tags it lends — the
 * resolution declares that number HERE, beside `actionBill` / `actionUses`, and its hook ANSWERS FROM the declaration
 * through the one function below. The manifest exports it, and the vote panel reads the seat's own number before the
 * vote (the cards in hand it would cheapen, the value of the stock, the tags at the seat's influence) — the same
 * arithmetic the engine charges by, so a promise and a payout cannot drift.
 *
 * A passive whose effect is not a number for a seat (bonuses paid twice, a draw after a play, a unit replaced) declares
 * nothing: its surfaces print its rule.
 */
import {Tag} from '../cards/Tag';

export type PassiveTerm =
  /** «When you play a card with one of `tags`, you pay `amount` M€ less for it» — Heat Capture, Water Export. */
  | {kind: 'cardDiscount', amount: number, tags: ReadonlyArray<Tag>}
  /** «Each unit of your `resources` is worth `amount` M€ more» — Metal Research. */
  | {kind: 'resourceValue', amount: number, resources: ReadonlyArray<'steel' | 'titanium'>}
  /** «You have `perInfluence` extra `tag` tags per point of your influence (when taking actions)» — R&D Funding. */
  | {kind: 'tagsPerInfluence', tag: Tag, perInfluence: number};

/** The M€ a `cardDiscount` term takes off a card with `tags` (0 for another term, or a card without a listed tag). */
export function passiveCardDiscount(term: PassiveTerm, tags: ReadonlyArray<Tag>): number {
  return term.kind === 'cardDiscount' && tags.some((tag) => term.tags.includes(tag)) ? term.amount : 0;
}

/** The M€ a `resourceValue` term adds to one unit of `resource` (0 for another term or resource). */
export function passiveValueBonus(term: PassiveTerm, resource: string): number {
  return term.kind === 'resourceValue' && (term.resources as ReadonlyArray<string>).includes(resource) ? term.amount : 0;
}

/** The extra `tag` tags a `tagsPerInfluence` term lends a seat at `influence` (0 for another term or tag). */
export function passiveTagBonus(term: PassiveTerm, tag: Tag, influence: number): number {
  return term.kind === 'tagsPerInfluence' && term.tag === tag ? term.perInfluence * Math.max(0, influence) : 0;
}
