import {CardModel} from './CardModel';
import {CardName} from '../cards/CardName';
import {ActionEffect} from './ActionPreviewModel';
import {Tag} from '../cards/Tag';
import {PartyName} from '../turmoil/PartyName';

/**
 * A check that is NOT a tag, named by the glyph that prints it. Today one:
 * `'party-requirement'` — «the revealed card has a party requirement» (any
 * party; Turmoil Redux TR13 Political Think Tank), drawn as the requirement
 * plate with the wild-party pill. A tag check carries `tag` instead.
 */
export type RevealCheckIcon = 'party-requirement';

/**
 * WHERE THE REVEALED CARD WENT once the check was read — the verdict's second
 * fact after «did it match?». `'discard'` (Search For Life, Asteroid Deflection
 * System, a TR13 miss) or `'hand'` (a TR13 match: the card was seen by every
 * player and is now the revealer's). Optional on the wire: a save taken in the
 * middle of an action predates the field, and absent reads as `'discard'` —
 * the only place a revealed card went before TR13 (`revealDestination`).
 */
export type RevealDestination = 'discard' | 'hand';

/** What the action checked the revealed card for — a tag, or a non-tag check by its glyph. */
export type RevealCheck = {
  /** A TAG check («Microbe tag»): the tag whose icon the verdict draws. */
  tag?: Tag,
  /** A NON-tag check: the glyph that prints it on the card face. */
  icon?: RevealCheckIcon,
  /** The English i18n key naming the check («Microbe tag», «Party requirement»). */
  label: string,
  /**
   * WHAT WAS FOUND, when the check finds something nameable beyond yes/no — a
   * party requirement names its PARTY («требование партии: Марс вперёд»).
   * Absent on a miss and for a tag check (the tag IS the thing found).
   */
  party?: PartyName,
};

/**
 * The RESULT of a REVEAL / DECK-CHECK action (SearchForLife, AsteroidDeflection-
 * System, Turmoil Redux TR13 Political Think Tank): the top deck card was
 * revealed, a condition was checked, a reward was granted iff the condition held,
 * and the card went to its destination (the discard pile, or — TR13's match —
 * the revealer's hand). Captured server-side the moment the action
 * resolves so the client's premium reveal slot can show the player exactly WHICH
 * card came up and WHETHER the condition fired — instead of leaving them to read
 * the log.
 *
 * Lives ONLY on the owner's PlayerViewModel (self-only, next to cardDrawReveals),
 * so it's never sent to opponents. Transient (not persisted) and cleared at the
 * start of the player's next action, so a stale reveal never resurfaces.
 */
export type RevealResultModel = {
  /** The action card that did the reveal (so the client matches it to the modal). */
  action: CardName;
  /** The revealed card, serialized like a hand card so it renders in <Card>. */
  revealed: CardModel;
  /** Whether the checked condition (a tag, a party requirement) held on the revealed card. */
  conditionMet: boolean;
  /**
   * What the action was CHECKING FOR — lets the result overlay EXPLAIN the
   * outcome ("looking for a Microbe tag → found / not found") instead of a bare
   * ✓/✗. A tag check carries `tag`, a non-tag one its `icon`.
   */
  check?: RevealCheck;
  /** What the player gained on a match (e.g. science +1 on this card, 5 M€). Absent on a miss. */
  reward?: ActionEffect;
  /**
   * Where the revealed card went (`revealDestination` reads an absent field as
   * `'discard'`). The verdict states it, and the console's «OK» sends the card
   * there physically — into the hand dock, or onto the discard pile.
   */
  destination?: RevealDestination;
  /**
   * The source card's VP BEFORE → AFTER this reveal (`from` → `to`). Lets the result
   * say exactly what happened to the score: `to > from` → "+N VP" (e.g. the first
   * science on Search For Life unlocking 3); `to === from` (with a match) → a
   * neutral "victory points unchanged" (already maxed). Omit for VP-less cards.
   */
  vp?: {from: number, to: number};
};

/** Where the revealed card went — an absent field (a pre-TR13 save) is the discard pile. */
export function revealDestination(reveal: Pick<RevealResultModel, 'destination'>): RevealDestination {
  return reveal.destination ?? 'discard';
}
