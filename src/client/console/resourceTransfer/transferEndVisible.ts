/*
 * @console-shared LIVE — console native stands on this file.
 *
 * THE ENDS OF A FLIGHT ARE VISIBLE (the polish remediation iteration № 1,
 * 2026-10-11 — `.claude/rules/console-ui.md` § THE ENDS OF A FLIGHT ARE VISIBLE;
 * the owner's law `polish-quality-no-regressions`).
 *
 * «Измерим» ≠ «видим». The transfer framework used to take the FIRST
 * MEASURABLE element of an anchor ladder as a token's source or destination —
 * and a measurable rect is not a painted one: the ДОП. РЕСУРСЫ satellite keeps
 * its box UNDER a band surface's opaque glass (PL-137; it is `pointer-events:
 * none`, so even a hit test never names it), a leaving surface still measures
 * while it fades, a `v-show`-hidden section measures zero. A token born on or
 * flown into such an end is a token the player sees come from — or go to —
 * NOTHING (the owner's TV, 2026-10-10: «ресурс летит из пустоты», «карта
 * исчезает до того, как ресурс начинает лететь»).
 *
 * ONE verdict for both ends: a non-zero box, no `visibility: hidden` /
 * `display: none` up the chain, an effective opacity of at least a half, the
 * centre inside the viewport, and NOT COVERED BY PAINT — the topmost
 * hit-testable element at the centre either belongs to the element (or the
 * element to it), or is not a band surface (`.con-ws`) foreign to it. The one
 * caveat is the hit test's own: an element that is `pointer-events: none`
 * never comes back from it, so for such an element the question is «what IS
 * painted there» — a foreign `.con-ws` means covered, anything else (the
 * board, the shell) means the element paints on top of it.
 *
 * An end that fails the verdict is NOT a flight end: the ladder goes on to the
 * next candidate, and with none left the transfer DEGRADES HONESTLY (its
 * counter ticks with its delta chip — `noteCardResourceLanding` / `onArrive`)
 * and names the reason in the trail. Pure DOM, no Vue — unit-tested under jsdom
 * (`tests/client/console/transferEndVisible.spec.ts`).
 */

export type TransferEndVerdict =
  | {visible: true}
  | {visible: false, why: 'unmounted' | 'empty' | 'hidden' | 'faded' | 'off-screen' | 'covered', by?: string};

/** The opacity below which an end is a ghost, not a place (a leaving surface mid-fade). */
export const TRANSFER_END_MIN_OPACITY = 0.5;

function surfaceName(surface: Element): string {
  return Array.from(surface.classList).filter((c) => c !== 'con-ws').slice(0, 2).join('.') || 'con-ws';
}

/** The effective opacity of an element down its ancestor chain (1 when nothing fades it). */
function effectiveOpacity(el: Element): number {
  let opacity = 1;
  for (let n: Element | null = el; n !== null; n = n.parentElement) {
    const op = Number(getComputedStyle(n).opacity);
    if (!Number.isNaN(op)) {
      opacity *= op;
    }
  }
  return opacity;
}

/** Is this element, as painted right now, a place a token may be born on or land on? */
/**
 * `strict` — a foreign band surface covers at ANY opacity, a LEAVING one included. The detached wait (PL-165) asks
 * strictly: a surface mid-dissolve still holds the layout it imposed (`con-root--ws-open` drops only when it is
 * REMOVED), so a destination measured through its fade is measured in the pose it is about to leave.
 */
export type TransferEndOptions = {
  strict?: boolean;
  /**
   * LENIENT — «is the OBJECT still there» rather than «is it painted right now» (T06, the final approach of a flight
   * already in the air): a mounted, displayed element with a box is an end even while a transient state fades or
   * covers it (a flip's crossfade, a leaving surface's last frames, the rail's lift dropping) — the token keeps its
   * object instead of being absorbed in the air. Only an element that is GONE (unmounted, hidden, boxless) fails.
   */
  lenient?: boolean;
};

export function transferEndVerdict(el: Element | null | undefined, opts: TransferEndOptions = {}): TransferEndVerdict {
  if (el === null || el === undefined || !el.isConnected) {
    return {visible: false, why: 'unmounted'};
  }
  const r = el.getBoundingClientRect();
  if (r.width <= 4 || r.height <= 4) {
    return {visible: false, why: 'empty'};
  }
  let opacity = 1;
  for (let n: Element | null = el; n !== null; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.visibility === 'hidden' || cs.visibility === 'collapse' || cs.display === 'none') {
      return {visible: false, why: 'hidden'};
    }
    const op = Number(cs.opacity);
    if (!Number.isNaN(op)) {
      opacity *= op;
    }
  }
  if (opts.lenient === true) {
    return {visible: true};
  }
  if (opacity < TRANSFER_END_MIN_OPACITY) {
    return {visible: false, why: 'faded'};
  }
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
    return {visible: false, why: 'off-screen'};
  }
  if (typeof document.elementsFromPoint === 'function') {
    // The transfer layer itself (a chip already in the air over the point) is never «cover».
    const top = document.elementsFromPoint(cx, cy).find((e) => e.closest('.con-transfer') === null);
    if (top !== undefined && top !== el && !el.contains(top) && !top.contains(el)) {
      const surface = top.closest('.con-ws');
      // COVERED BY PAINT means by PAINT: a foreign surface that is LEAVING (its fade below the same half — the hand
      // dissolving over the board while a tile's payout measures its satellite) still answers the hit test and
      // covers nothing the eye can see; it is the standing, opaque glass that makes an end «пустота».
      if (surface !== null && !surface.contains(el) && (opts.strict === true || effectiveOpacity(surface) >= TRANSFER_END_MIN_OPACITY)) {
        return {visible: false, why: 'covered', by: surfaceName(surface)};
      }
    }
  }
  if (opts.strict === true) {
    // STRICT asks GEOMETRY too: a surface on its way out may already refuse the hit test (`pointer-events: none` on
    // the leave) while it still stands over the point and still imposes the layout it brought.
    for (const surface of Array.from(document.querySelectorAll('.con-ws'))) {
      if (surface.contains(el) || el.contains(surface)) {
        continue;
      }
      const s = surface.getBoundingClientRect();
      if (s.width > 0 && s.height > 0 && cx >= s.left && cx <= s.right && cy >= s.top && cy <= s.bottom) {
        return {visible: false, why: 'covered', by: surfaceName(surface)};
      }
    }
  }
  return {visible: true};
}

/** The first VISIBLE element matching the selector (document order), or undefined — with the verdicts of those skipped. */
export function firstVisibleEnd(selector: string, skipped?: Array<{selector: string, verdict: TransferEndVerdict}>, opts: TransferEndOptions = {}): Element | undefined {
  if (typeof document === 'undefined') {
    return undefined;
  }
  for (const el of Array.from(document.querySelectorAll(selector))) {
    const verdict = transferEndVerdict(el, opts);
    if (verdict.visible) {
      return el;
    }
    skipped?.push({selector, verdict});
  }
  return undefined;
}
