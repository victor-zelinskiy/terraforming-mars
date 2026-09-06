import {CardName} from '../cards/CardName';
import {Color} from '../Color';

/**
 * Marker: this `SelectCard` is the mandatory TAKE step of an EXTERNAL draw — a
 * draw granted by an effect that fired OUTSIDE the recipient's own managed
 * flow (another player — MarsBot included — set it off: Solar Logistics on a
 * foreign space event, Sponsored Academies' «all opponents draw 1 card», …).
 *
 * The cards were drawn from the deck AT THE MOMENT the effect fired, so deck
 * order and distribution never depend on when the recipient answers; they are
 * WITHHELD from `cardsInHand` (and every hand projection) until each one is
 * taken through this prompt. Answering with a subset takes exactly those
 * cards; the prompt re-issues with the remainder (same `intakeId`), so a
 * partial take survives reload/reconnect as ordinary game state.
 *
 * Structural and translation-proof (cross-cutting invariant 1): the console
 * derives the whole «what → why → who» reading from this marker, never from
 * the (translatable, render-mutated) prompt title.
 */
export type ExternalDrawTakeMeta = {
  /** Stable id of the intake batch (per recipient; survives re-issued prompts). */
  intakeId: number;
  /** Total cards this trigger granted. */
  count: number;
  /** Cards still awaiting the take (== this prompt's candidate list). */
  remaining: number;
  /** The card whose EFFECT granted the draw (Solar Logistics; Sponsored
   *  Academies for the «opponents draw» half of its own play). */
  effectCard: CardName;
  /** Whether the effect card belongs to the RECIPIENT («you» — your own blue
   *  card reacted) or to the INITIATOR (their card handed the cards out). The
   *  client words the cause line off this, never off tableau guessing. */
  effectCardOwner: 'you' | 'initiator';
  /** Who set the effect off — an ordinary player color (MarsBot included; the
   *  client renders it through the regular player model). */
  initiator: Color;
  /** The card the initiator played/resolved that TRIGGERED the effect, when
   *  known (the foreign space event behind Solar Logistics). Distinct from
   *  `effectCard`: one provides the effect, the other activated it. */
  triggerCard?: CardName;
};
