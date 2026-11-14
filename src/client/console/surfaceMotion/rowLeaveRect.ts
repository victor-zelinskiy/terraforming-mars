/*
 * THE RECT A ROW MEMBER HAD WHEN ITS LEAVE WAS DECIDED.
 *
 * `.con-main` is ONE flex row: the resource rail, the board, the strategy rail and whichever workspace section is
 * open. A section that leaves is FROZEN at its rect (`position: fixed`, inert) and dissolves over the returning board
 * — the director's `section` leave and the hand's armed dissolve both do it, and both measured that rect inside their
 * `<Transition>`'s leave hook.
 *
 * That measure leaned on an ORDER nobody had written down: «my leave hook runs before the board is back in the row».
 * On the virtual DOM it happened to hold — the board and the strategy rail return by `v-show`, and a directive's
 * update ran AFTER the whole patch, the leave hooks included. A Vapor `v-show` is a render effect like any other: the
 * board (earlier in the shell's template) is displayed first, the row re-flows, and the hook of the section leaving
 * in that very flush measures what is left of it — the hand frozen in the right-hand 1431 px of a 3358 px home, its
 * colony grid re-fitted into four small tiles for the whole dissolve (`console-fringe-colony`, 2026-11-14: 4 / 4
 * before the flip, 2 / 4 after it — the spec read the grid's boxes a few frames late and met the squeezed ones).
 *
 * ONE MUTATION — ONE REACTION (CLAUDE.md § North star): which of two reactions a mutation wakes first is not a
 * contract. So the order is written here instead. The moment the row's composition is DECIDED — the workspace stack
 * or the shell's section changes — the members are measured where they stand, synchronously, in the assignment
 * itself: the DOM is still the last frame the player saw, whatever the flush is about to do to it. A leave hook of
 * that flush asks for `leavingRectOf(el)` and gets the rect of that frame; the hold lets go when the flush is over.
 * (No hold — the leave was decided on some other edge — is the live measure, as before.)
 */
import {nextTick, watch} from 'vue';

let held: Map<Element, DOMRect> | undefined;

/** Measure the row's members where they stand — once per flush: the FIRST decision of a tick is the frame on screen. */
export function holdRowRects(row: Element | null | undefined): void {
  if (held !== undefined || row === null || row === undefined) {
    return;
  }
  const now = new Map<Element, DOMRect>();
  for (const member of Array.from(row.children)) {
    const rect = member.getBoundingClientRect();
    if (rect.width > 0 || rect.height > 0) {
      now.set(member, rect);
    }
  }
  held = now;
  void nextTick(() => {
    if (held === now) {
      held = undefined;
    }
  });
}

/** The rect a leaving surface is frozen at: where it stood when its leave was decided — else where it stands now. */
export function leavingRectOf(el: Element): DOMRect {
  return held?.get(el) ?? el.getBoundingClientRect();
}

/**
 * Wire the hold to the row: `decided` reads what composes the row (the stack's frames, the shell's section) and the
 * members are measured in the very assignment that changes it. Returns the dispose.
 */
export function installRowLeaveRects(row: () => Element | null | undefined, decided: () => unknown): () => void {
  const stop = watch(decided, () => holdRowRects(row()), {flush: 'sync'});
  return () => {
    stop();
    held = undefined;
  };
}

/** Spec seam: forget the hold. */
export function resetRowLeaveRects(): void {
  held = undefined;
}
