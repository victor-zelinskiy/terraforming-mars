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
  | {visible: false, why: 'unmounted' | 'empty' | 'hidden' | 'faded' | 'leaving' | 'off-screen' | 'covered', by?: string};

/** The opacity below which an end is a ghost, not a place (a leaving surface mid-fade). */
export const TRANSFER_END_MIN_OPACITY = 0.5;

/**
 * THE FULL-SCREEN OVERLAYS — scenes the player calls up OVER the whole frame, standing above the flight layer by
 * contract: the card viewer's veil, the system menu, the legacy card zoom, and the MarsBot TURN REVIEW («Разбор хода»,
 * a body-level full cover — FLAKE ZERO, `console-notification-bonus-attack`: the review raised from the live card by
 * an X-hold, and an M€ token of the bot's attack was born under `.mbr__chains`, painted under the review's panel).
 * ONE list for every question asked of them: an end under one is covered, an end inside one is no flight end, a bare
 * point under one is covered, and a token under one is under a scene that took the screen — not a paint defect.
 */
export const FULLSCREEN_OVERLAYS = '.con-zoom-veil, .con-sys, .card-zoom-container, .con-bot-review';

/**
 * What COVERS an end: a band surface — and a FULL-SCREEN overlay standing over the whole frame (ledger HC, the monkey's
 * day2 finding on `parliament-aquifer-enact`: X opened the card viewer mid-payout and an animal token for Fish was born
 * UNDER its veil). The viewer and the system menu stand above the flight layer by contract; an end under them is not
 * painted for the eye, so the flight degrades to its counter's tick instead of a token nobody can see.
 */
const COVERING_SURFACES = `.con-ws, ${FULLSCREEN_OVERLAYS}`;

/**
 * A BARE POINT under a full-screen overlay (the card viewer's veil, the system menu) — the one cover a point can be
 * judged by without knowing its object: such an overlay stands over the WHOLE frame (ledger HC, the monkey's day2
 * table). The name of the overlay, or undefined.
 */
export function fullscreenCoverAt(p: {x: number, y: number}): string | undefined {
  if (typeof document === 'undefined' || typeof document.elementsFromPoint !== 'function') {
    return undefined;
  }
  const top = document.elementsFromPoint(p.x, p.y).find((e) => e.closest('.con-transfer') === null);
  const overlay = top?.closest(FULLSCREEN_OVERLAYS);
  return overlay === null || overlay === undefined ? undefined : surfaceName(overlay);
}

/** The full-screen overlay an element stands in (or under, when it is the hit test's top) — its name, or undefined. */
export function fullscreenOverlayOf(el: Element): string | undefined {
  const overlay = el.closest(FULLSCREEN_OVERLAYS);
  return overlay === null ? undefined : surfaceName(overlay);
}

function surfaceName(surface: Element): string {
  return Array.from(surface.classList).filter((c) => c !== 'con-ws').slice(0, 2).join('.') || 'con-ws';
}

/** The effective opacity of an element down its ancestor chain (1 when nothing fades it). */
export function effectiveOpacity(el: Element): number {
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
  /**
   * OCCUPANCY, NOT AN END — «does it still PAINT there», asked by whoever must stand clear of it (the reaction stage
   * past a workspace's hero column — `cardReactionDirector.stageAnchor`). A surface whose leave is decided is no place
   * for a NEW flight's end, and it still paints through its whole dissolve: read as «gone» at the decision, the
   * Greens' charter rose OVER the Hydronetwork's context column while the column was still on screen at 0.9
   * (`console-card-reaction` HYDRO, the whole suite on `1dd900fbde`, 3 / 3). The opacity's half judges it, as it
   * always did.
   */
  painted?: boolean;
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
  // AN END INSIDE A FULL-SCREEN OVERLAY is never a flight end (ledger HC, the monkey's day2 table: X lifted Fish into
  // the card viewer mid-payout, and its capsule — visible, INSIDE the viewer — was the token's birth). The flight
  // layer stands under every scene that takes the screen by contract, so a token there is painted under the veil.
  const screenTaker = el.closest(`.con-zoom, .con-zoom-flight-layer, ${FULLSCREEN_OVERLAYS}`);
  if (screenTaker !== null) {
    return {visible: false, why: 'covered', by: surfaceName(screenTaker)};
  }
  if (opts.lenient === true) {
    return {visible: true};
  }
  // AN END ON A SURFACE WHOSE LEAVE IS DECIDED is not a flight end — whatever its fade still paints. The opacity's half
  // judges a ghost by what the eye has left of it; a band surface the player has just closed is GONE by decision, and
  // for the first half of its dissolve it still measures and still reads «visible»: a token that takes it then is born
  // off a place that is no longer there by its own pop. The monkey's seed of the day, 2026-11-22
  // (`d20261122:colony-trade-hub-bot`, issues #90 / #93): B closed «Разыграно», and 336 ms later a card's M€ took its
  // printed icon on the leaving table as its source — «surface folded under its token — the birth of
  // stock:megacredits off span.pcard-mi.pcard-mi--mc (div.con-played.con-ws gone)». The fold's law (`surfaceClear`)
  // could not have helped: the frame left BEFORE the token existed. The leave's own mark says it for as long as the
  // leave lasts (`surfaceMotionDirector.surfaceLeaveHook` — `data-motion-leaving`); the ladder goes on to the next
  // place. (LENIENT — a flight already in the air keeps its object through a leave's last frames — returned above;
  // PAINTED — an occupancy question, not an end — is asked what still paints: see `TransferEndOptions.painted`.)
  const leaver = opts.painted === true ? null : el.closest('[data-motion-leaving]');
  if (leaver !== null) {
    return {visible: false, why: 'leaving', by: surfaceName(leaver)};
  }
  if (opacity < TRANSFER_END_MIN_OPACITY) {
    return {visible: false, why: 'faded'};
  }
  const cx = r.left + r.width / 2;
  const cy = r.top + r.height / 2;
  if (cx < 0 || cy < 0 || cx > window.innerWidth || cy > window.innerHeight) {
    return {visible: false, why: 'off-screen'};
  }
  // THE CARD-REACTION LAYER stands above every band surface by its z (11650 — over the workspaces, under the chips), and
  // it is `pointer-events: none`, so the hit test under a reactor's face names the BAND the face paints over: a
  // reactor risen at the stage over a standing composer (the owner, 2026-10-27 — one place in every state) is never
  // covered by that band. A `.con-ws` cannot cover it; nothing else is asked of it here.
  // …and the CITY-PAYOUT stage stands on the same step of the ladder (11650 — `.con-citypay`, the field's receiving card):
  // the «on which card» plate the card was carried out of keeps the hit test until its paint is gone, and is never cover
  // for the card standing over it (Arabia Terra's data, 2026-11-06).
  const overlay = el.closest('.con-reaction, .con-citypay') !== null;
  if (typeof document.elementsFromPoint === 'function' && !overlay) {
    // The transfer layer itself (a chip already in the air over the point) is never «cover».
    const top = document.elementsFromPoint(cx, cy).find((e) => e.closest('.con-transfer') === null);
    if (top !== undefined && top !== el && !el.contains(top) && !top.contains(el)) {
      const surface = top.closest(COVERING_SURFACES);
      // COVERED BY PAINT means by PAINT: a foreign surface that is LEAVING (its fade below the same half — the hand
      // dissolving over the board while a tile's payout measures its satellite) still answers the hit test and
      // covers nothing the eye can see; it is the standing, opaque glass that makes an end «пустота».
      if (surface !== null && !surface.contains(el) && (opts.strict === true || effectiveOpacity(surface) >= TRANSFER_END_MIN_OPACITY)) {
        return {visible: false, why: 'covered', by: surfaceName(surface)};
      }
    }
  }
  if (opts.strict === true && !overlay) {
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
