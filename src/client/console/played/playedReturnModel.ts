/*
 * playedReturnModel — PURE, DOM-free vocabulary + math for the CARDS-RETURN
 * beat: the closing movement of a play that sends cards from the TABLE back
 * into the player's HAND (Astra Mechanica: «верните до 2 разыгранных
 * событий в руку»).
 *
 * Design contract: the return is not a counter change, it is a physical
 * continuation of the play. The played card lands on the tableau, and then —
 * inside the SAME «Разыграно» scene, before it closes — the returned cards
 * rise out of the events pile, turn face to the camera so the player SEES
 * what came back, and are then carried into the dock by the STANDARD hand
 * intake (the one every card acquisition in the console ends with).
 *
 * This module owns everything unit-testable: WHICH cards returned (derived
 * from the authoritative view diff — never from the client's own pick, which
 * the server may have refused), and WHERE they pose while they are read.
 * The GSAP work is reused from the board-bonus director; the transaction
 * lifecycle lives in playedCardReturn.ts.
 */

import {CardName} from '@/common/cards/CardName';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {presentationTarget} from '@/client/console/boardCardBonus/boardCardBonusModel';

/**
 * The two branches of the view the diff needs — declared STRUCTURALLY so the
 * caller can pass either side of the commit (the previous view is the shell's
 * `ViewModel`, which carries no hand at all for a spectator; the incoming one
 * is a full `PlayerViewModel`). Both are assignable; a missing branch simply
 * yields no return.
 */
export type ReturnDiffView = {
  thisPlayer?: {tableau?: ReadonlyArray<{name: CardName}>} | undefined,
  cardsInHand?: ReadonlyArray<{name: CardName}> | undefined,
};

export type ReturnedCard = {
  name: CardName,
  /** The card lies FACE-DOWN on the table (an event, on the events pile) —
   *  it must turn face to the camera on the way out. */
  faceDown: boolean,
};

/** The readable beat at the pose, before the intake carries them off. */
export const RETURN_READ_MS = 460;
/** Whole-beat ceiling — a wedged tween can never strand the hero scene. */
export const RETURN_SAFETY_MS = 9000;
/** A pair poses a notch smaller than a lone card — together they read at the
 *  same visual weight, and the row stays clear of the side rails. */
const PAIR_SCALE = 0.86;
/** Air between two posed cards (logical px — TV scales it). */
const PAIR_GAP = 34;

function countByName(cards: ReadonlyArray<{name: CardName}> | undefined): Map<CardName, number> {
  const out = new Map<CardName, number>();
  for (const c of cards ?? []) {
    out.set(c.name, (out.get(c.name) ?? 0) + 1);
  }
  return out;
}

/**
 * WHICH cards travelled table → hand across this response.
 *
 * Server-authoritative by construction: a card counts only when it BOTH left
 * the viewer's tableau AND appeared in the viewer's hand, as a multiset (so a
 * card merely discarded off the table, or one drawn from the deck, is never
 * mistaken for a return). The client's own pre-collected pick is deliberately
 * NOT the source — a refused / partially-applied play must not animate a lie.
 *
 * Order follows the PREVIOUS tableau order, so the beat is deterministic.
 * `isEvent` is injected (the client card manifest is not this module's
 * business — the same idiom the other pure engines use).
 */
export function detectReturnedToHand(
  prev: ReturnDiffView | undefined,
  next: ReturnDiffView | undefined,
  isEvent: (name: CardName) => boolean,
): Array<ReturnedCard> {
  const prevTableau = prev?.thisPlayer?.tableau;
  if (prev === undefined || next === undefined || prevTableau === undefined) {
    return [];
  }
  const leftTable = countByName(prevTableau);
  countByName(next.thisPlayer?.tableau).forEach((k, name) => {
    leftTable.set(name, (leftTable.get(name) ?? 0) - k);
  });
  const gainedHand = countByName(next.cardsInHand);
  countByName(prev.cardsInHand).forEach((k, name) => {
    gainedHand.set(name, (gainedHand.get(name) ?? 0) - k);
  });
  const out: Array<ReturnedCard> = [];
  const emitted = new Map<CardName, number>();
  for (const card of prevTableau) {
    const budget = Math.min(leftTable.get(card.name) ?? 0, gainedHand.get(card.name) ?? 0);
    const already = emitted.get(card.name) ?? 0;
    if (already >= budget) {
      continue;
    }
    emitted.set(card.name, already + 1);
    out.push({name: card.name, faceDown: isEvent(card.name)});
  }
  return out;
}

/**
 * WHERE the returned cards pose while the player reads them: a centred row
 * on the presentation band (the same band a board-bonus card is presented
 * on — one place in the console means "look at this card"), the pair pitched
 * apart from that centre. The intake then lifts them from exactly here.
 */
export function returnPoseSlots(
  count: number,
  viewportW: number,
  viewportH: number,
  naturalW: number,
  naturalH: number,
): Array<{x: number, y: number, scale: number}> {
  if (count <= 0) {
    return [];
  }
  const base = presentationTarget(viewportW, viewportH, naturalW, naturalH);
  if (count === 1) {
    return [base];
  }
  const scale = base.scale * PAIR_SCALE;
  const pitch = naturalW * scale + PAIR_GAP * conUiScale();
  const first = base.x - (pitch * (count - 1)) / 2;
  return Array.from({length: count}, (_, i) => ({x: first + pitch * i, y: base.y, scale}));
}

/** The pose rect (top-left box) a slot resolves to for a natural-size card. */
export function returnPoseRect(
  pose: {x: number, y: number, scale: number},
  naturalW: number,
  naturalH: number,
): {left: number, top: number, width: number, height: number} {
  const width = naturalW * pose.scale;
  const height = naturalH * pose.scale;
  return {left: pose.x - width / 2, top: pose.y - height / 2, width, height};
}
