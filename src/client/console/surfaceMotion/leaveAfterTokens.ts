/*
 * @console-shared LIVE — console native stands on this file.
 *
 * A SURFACE LEAVES AFTER ITS TOKENS — the one funnel every leave of a band surface goes through (FREEZE ZERO, the zero
 * bar — CI #146, game 1183).
 *
 * «A result outlives the surface that produced it»: a token born on a card's printed icon, a price landing on it, flies
 * from / to a REAL place on screen. The stack's verbs are immediate — they must be: `enterWorkspace` pushes right
 * after `goBoardHome` truncates, a deferred truncate would leave that push on a stale stack — and whichever verb took a
 * frame off (the generation scene's rise into a sitting, here, 67 ms after «Разыграть и спасовать», with Red
 * Appeasement's +2 M€ production being born on the card) took its surface down with it: the token was born on nothing.
 * Every verb's frame removal becomes a surface removal in the surface's LEAVE HOOK, so the law lives here, once:
 *
 *   a surface still holding tokens (`surfaceHoldsTokens`) stays where it stood — inert (no pointer), a section pinned
 *   to the rect it had when its leave was decided (it must not squeeze the row the next owner is entering) — until
 *   `surfaceClear` (bounded by its own ceiling, which names a lost end); THEN its ordinary leave plays.
 *
 * What the player sees: the next owner of the screen takes the pad and the bar in the same flush; the old surface keeps
 * its last pose for the token's pop (a few hundred ms), offers no verb, and dissolves.
 */
import {surfaceClear, surfaceHoldsTokens, noteTransferTrail} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {leavingRectOf} from '@/client/console/surfaceMotion/rowLeaveRect';

/** The mark of a surface waiting for its tokens before its leave (the fold's witness reads it: no fold here). */
export const LEAVE_WAITS_TOKENS_ATTR = 'data-leave-waits-tokens';

/**
 * Run `go` (the surface's ordinary leave) once no token stands on `el`. `pin` — the surface is a member of the main
 * row (a section): it is frozen at its leaving rect so the row's new owner has its whole home from the first frame.
 */
export function leaveAfterTokens(el: Element, pin: boolean, go: () => void): void {
  if (!surfaceHoldsTokens(el)) {
    go();
    return;
  }
  if (el instanceof HTMLElement) {
    if (pin) {
      const r = leavingRectOf(el);
      Object.assign(el.style, {
        position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
        margin: '0', zIndex: '5',
      });
    }
    el.style.pointerEvents = 'none';
    el.setAttribute(LEAVE_WAITS_TOKENS_ATTR, '1');
  }
  noteTransferTrail('surface:leave-waits', {surface: `${el.tagName.toLowerCase()}.${Array.from(el.classList).slice(0, 2).join('.')}`});
  void surfaceClear(el).then(() => {
    el.removeAttribute(LEAVE_WAITS_TOKENS_ATTR);
    go();
  });
}
