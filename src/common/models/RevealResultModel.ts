import {CardModel} from './CardModel';
import {CardName} from '../cards/CardName';
import {ActionEffect} from './ActionPreviewModel';

/**
 * The RESULT of a REVEAL / DECK-CHECK action (SearchForLife, AsteroidDeflection-
 * System): the top deck card was revealed, a condition was checked, and a reward
 * was granted iff the condition held. Captured server-side the moment the action
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
  /** Whether the checked condition (a tag, today) was present on the revealed card. */
  conditionMet: boolean;
  /** What the player gained on a match (e.g. science +1 on this card). Absent on a miss. */
  reward?: ActionEffect;
  /**
   * The source card's VP BEFORE → AFTER this reveal (`from` → `to`). Lets the result
   * say exactly what happened to the score: `to > from` → "+N VP" (e.g. the first
   * science on Search For Life unlocking 3); `to === from` (with a match) → a
   * neutral "victory points unchanged" (already maxed). Omit for VP-less cards.
   */
  vp?: {from: number, to: number};
};
