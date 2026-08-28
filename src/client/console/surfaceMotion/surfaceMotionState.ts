/*
 * CONSOLE SURFACE MOTION — the reactive store + DOM capture bridge.
 *
 * One module-level store (survives any remount, mirrors journalState et al.)
 * that the shell, the director and the migrated surfaces share:
 *
 *  - SHADE ownership: the ONE full-viewport dim behind every MIGRATED band
 *    surface (`.con-shade` in ConsoleShell). Owners register through the
 *    director's enter/leave hooks; while ≥1 owner (or an awaiting handoff)
 *    is live the shade is ON — so a surface swap never blinks the darkness
 *    (the counter goes 1→1 across a handoff, never through 0 long enough to
 *    fade). `pickSuppressed` mirrors the shell's hand / repeat-action pick
 *    bridges, which HIDE the owning composer via v-show: the picked-in
 *    surface owns the screen, the shade yields — and the director reads the
 *    same flag to know that the enter/leave pair `v-show` fires is the
 *    bridge's beat rather than a real entrance.
 *  - DEPARTURE captures: measured once, synchronously, while the outgoing
 *    DOM is still alive (the shell's pre-flush watcher / submit path); the
 *    incoming surface's enter consumes them to FLIP shared anchors.
 *  - the AWAITING handoff (the composer's committed hold) — begun on submit,
 *    resolved by the shell's playerView watcher via the pure model.
 *  - the WHEEL handoff origin — the chosen slot's centre, consumed by the
 *    next surface's directional entry.
 *
 * DOM access is confined to the capture helpers (JSDOM-safe no-ops).
 */

import {reactive} from 'vue';
import {
  AwaitingHandoff,
  CapturedRect,
  SurfaceDeparture,
  SurfaceMotionId,
  WheelHandoffOrigin,
  departureUsable,
  wheelOriginUsable,
} from '@/client/console/surfaceMotion/surfaceMotionModel';

const now = (): number => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export const surfaceMotionState = reactive({
  /** Live shade owners (Set semantics — enter adds, leave removes). */
  shadeOwners: [] as Array<SurfaceMotionId>,
  /**
   * A client pick bridge (hand / repeat-action) hides the owning composer via
   * v-show — the shade yields to the picked-in surface for its lifetime.
   *
   * It is also the DIRECTOR's «that enter/leave was a bridge flip, not a real
   * entrance» verdict (`isPickBridgeHidden`): `v-show` DOES fire the pair, so
   * a bridge the director cannot recognise gets posed like a dismissal and
   * only half-restored. Published by the shell from the SAME computed its
   * `v-show`s bind to, so the two can never name different bridges.
   */
  pickSuppressed: false,
  /** A board-bonus / deck-draw / colony-trade scene VEILS the mounted reveal
   *  (its frame is measured but invisible while the cards still fly) — the
   *  shade must stay dark-free with it, else the field dims before the
   *  scene hands over. Reported by ConsoleRevealOverlay's veil watcher. */
  revealVeilSuppressed: false,
  /** The committed composer hold (see surfaceMotionModel). */
  awaiting: undefined as AwaitingHandoff | undefined,
  /** The latest outgoing-surface capture (undefined once consumed/stale). */
  departure: undefined as SurfaceDeparture | undefined,
  /** The chosen quick-wheel slot's centre (undefined once consumed/stale). */
  wheelOrigin: undefined as WheelHandoffOrigin | undefined,
  /** The slot id chosen on the wheel — the leave hook plays its commit. */
  wheelChosenSlot: undefined as string | undefined,
  /** The destination emblem to ECHO (`data-wheel-anchor` id) — the incoming
   *  surface's enter materializes it a beat into the reveal. */
  wheelEcho: undefined as string | undefined,
});

/** The ONE shade predicate the shell binds (`.con-shade--on`). */
/**
 * The owners whose dim is the WHOLE SHELL rather than the central opening.
 *
 * The shade normally covers exactly the stage between the four hull members —
 * the rails are chrome the player reads THROUGH a decision. A cinematic is the
 * other case: it paints over the whole shell by design, so a dim that stopped at
 * the rails would leave a lit strip beside a surface that is covering them, and
 * the seam would read as a rendering fault rather than as chrome.
 *
 * A CLOSED SET, deliberately small: everything not named here is a decision
 * surface, and a decision surface never darkens a bar. `reveal` is the only
 * shade-owning cinematic today — the other full-bleed moments (ceremonies, the
 * mandatory announce, fullscreen inspect, the system menu, the start scene,
 * endgame) carry their own veil and never take this one.
 */
const FULL_BLEED_SHADE_OWNERS: ReadonlySet<SurfaceMotionId> = new Set<SurfaceMotionId>([
  'reveal',
]);

/** Does the live shade belong to a FULL-BLEED owner (see the set above)? */
export function surfaceShadeFullBleed(): boolean {
  return surfaceMotionState.shadeOwners.some((id) => FULL_BLEED_SHADE_OWNERS.has(id));
}

export function surfaceShadeOn(): boolean {
  if (surfaceMotionState.pickSuppressed || surfaceMotionState.revealVeilSuppressed) {
    return false;
  }
  return surfaceMotionState.shadeOwners.length > 0 || surfaceMotionState.awaiting !== undefined;
}

export function addShadeOwner(id: SurfaceMotionId): void {
  if (!surfaceMotionState.shadeOwners.includes(id)) {
    surfaceMotionState.shadeOwners.push(id);
  }
}

export function removeShadeOwner(id: SurfaceMotionId): void {
  const i = surfaceMotionState.shadeOwners.indexOf(id);
  if (i !== -1) {
    surfaceMotionState.shadeOwners.splice(i, 1);
  }
}

export function setPickSuppressed(on: boolean): void {
  surfaceMotionState.pickSuppressed = on;
}

export function setRevealVeilSuppressed(on: boolean): void {
  surfaceMotionState.revealVeilSuppressed = on;
}

// ── departure capture (DOM measure — call while the outgoing DOM is live) ───

function rectOf(el: Element): CapturedRect {
  const r = el.getBoundingClientRect();
  return {left: r.left, top: r.top, width: r.width, height: r.height};
}

/**
 * Measure the outgoing surface's panel + anchors in ONE synchronous read
 * batch. `root` is the surface's live root (or any element containing the
 * panel); a missing/unmeasurable root simply records no capture.
 */
export function captureSurfaceDeparture(from: SurfaceMotionId, root: Element | null): void {
  if (root === null || typeof window === 'undefined') {
    return;
  }
  const panelEl = root.querySelector('[data-motion-panel]') ?? root;
  const panelRect = rectOf(panelEl);
  if (panelRect.width < 10 || panelRect.height < 10) {
    return; // hidden / display:none — not a believable departure
  }
  const anchors = new Map<string, CapturedRect>();
  for (const el of root.querySelectorAll<HTMLElement>('[data-motion-anchor]')) {
    const id = el.dataset.motionAnchor;
    const r = rectOf(el);
    if (id !== undefined && id !== '' && r.width >= 10 && r.height >= 10) {
      anchors.set(id, r);
    }
  }
  surfaceMotionState.departure = {from, at: now(), panel: panelRect, anchors};
}

/** When a departure was last CONSUMED (an incoming FLIP claimed it) — the
 *  outgoing surface's leave hides its own anchors so the travelling card
 *  never shows double. Module-level, not reactive (read once per hook). */
let departureTakenAt = -Infinity;

/** Consume the capture for an incoming surface (fresh + phase-linked only). */
export function takeSurfaceDeparture(to: SurfaceMotionId): SurfaceDeparture | undefined {
  const dep = surfaceMotionState.departure;
  if (!departureUsable(dep, to, now())) {
    return undefined;
  }
  surfaceMotionState.departure = undefined;
  departureTakenAt = now();
  return dep;
}

/** An anchored FLIP is in flight right now (claimed within the last beat) —
 *  or a capture is pending for one. The outgoing leave consults this to
 *  blank its own anchors (the card lives on the INCOMING side only). */
export function isAnchorHandoffLive(): boolean {
  return surfaceMotionState.departure !== undefined || now() - departureTakenAt < 600;
}

/** How long a carried object may stay held before it is shown regardless. */
const CARRY_HOLD_MAX_MS = 900;

/**
 * HOLD THE OBJECTS THIS SURFACE IS RECEIVING, from its own `mounted()`.
 *
 * A carried card must not PAINT at its destination before the FLIP that
 * brings it there has started: the eye then sees a second card appear beside
 * the first and only afterwards jump back to be animated. The enter hook is
 * too late to prevent that — it races the surface's own first paint, and a
 * screen that lays itself out (a scene layer, a published zone, a re-fitted
 * rail) can beat it by two or three frames. `mounted()` cannot: it runs
 * before the component has painted anything.
 *
 * Deliberately plain style writes, not GSAP: the FLIP's own `autoAlpha: 1`
 * overwrites them, and the SAFETY below is what guarantees an object is never
 * left invisible by a travel that never happened.
 */
export function holdCarriedAnchors(root: Element | null | undefined): void {
  if (root === null || root === undefined || typeof window === 'undefined' || !isAnchorHandoffLive()) {
    return;
  }
  // …EXCEPT one the FLIP has already pinned. `mounted()` and the transition's
  // `@enter` fire in the same flush and their order is not ours to choose, so
  // a hold applied after the pin would blank an object that is already
  // standing at its departure rect — the very frame this exists to protect.
  const anchors = Array.from(root.querySelectorAll<HTMLElement>('[data-motion-anchor]'))
    .filter((node) => node.dataset.motionCarried !== '1');
  if (anchors.length === 0) {
    return;
  }
  for (const node of anchors) {
    node.style.opacity = '0';
    node.style.visibility = 'hidden';
  }
  window.setTimeout(() => {
    for (const node of anchors) {
      // Only OUR hold is released — a FLIP that ran has already replaced both.
      if (node.style.opacity === '0' && node.style.visibility === 'hidden') {
        node.style.removeProperty('opacity');
        node.style.removeProperty('visibility');
      }
    }
  }, CARRY_HOLD_MAX_MS);
}

// ── the awaiting handoff ────────────────────────────────────────────────────

export function beginAwaitingHandoff(from: SurfaceMotionId, fingerprint: {gameAge: number, undoCount: number}): void {
  surfaceMotionState.awaiting = {
    from,
    startedAt: now(),
    gameAge: fingerprint.gameAge,
    undoCount: fingerprint.undoCount,
  };
}

export function clearAwaitingHandoff(): void {
  surfaceMotionState.awaiting = undefined;
}

/** The shell's input gate: while a committed submit is in flight the pad is
 *  inert (B can't cancel an applied action, A can't double-fire). */
export function isSurfaceAwaitingHandoff(): boolean {
  return surfaceMotionState.awaiting !== undefined;
}

// ── the wheel handoff ───────────────────────────────────────────────────────

/** Record the chosen slot (its centre drives the next surface's entry;
 *  `echo` names the destination emblem the enter materializes). */
export function markWheelHandoff(slot: string, el: Element | null, echo?: string): void {
  surfaceMotionState.wheelChosenSlot = slot;
  surfaceMotionState.wheelEcho = echo;
  if (el === null || typeof window === 'undefined') {
    surfaceMotionState.wheelOrigin = undefined;
    return;
  }
  const r = el.getBoundingClientRect();
  surfaceMotionState.wheelOrigin = {x: r.left + r.width / 2, y: r.top + r.height / 2, at: now()};
}

/** The shell retargets the echo when the commit resolves into the shared
 *  confirm card instead (pass always; heat at max temperature). */
export function retargetWheelEcho(echo: string | undefined): void {
  surfaceMotionState.wheelEcho = echo;
}

/** Consume the echo target for the incoming surface's enter (rides the same
 *  freshness window as the wheel origin — a stale echo never fires). */
export function takeWheelEcho(): string | undefined {
  const echo = surfaceMotionState.wheelEcho;
  surfaceMotionState.wheelEcho = undefined;
  return echo;
}

/** Consume the wheel origin for the incoming surface's directional entry. */
export function takeWheelOrigin(): WheelHandoffOrigin | undefined {
  const origin = surfaceMotionState.wheelOrigin;
  if (!wheelOriginUsable(origin, now())) {
    return undefined;
  }
  surfaceMotionState.wheelOrigin = undefined;
  return origin;
}

/** The leave hook reads (and clears) the chosen slot to flash it. */
export function takeWheelChosenSlot(): string | undefined {
  const slot = surfaceMotionState.wheelChosenSlot;
  surfaceMotionState.wheelChosenSlot = undefined;
  return slot;
}

/** Game-switch / shell-unmount reset — never leak a hold across sessions. */
export function resetSurfaceMotion(): void {
  surfaceMotionState.shadeOwners.splice(0);
  surfaceMotionState.pickSuppressed = false;
  surfaceMotionState.revealVeilSuppressed = false;
  surfaceMotionState.awaiting = undefined;
  surfaceMotionState.departure = undefined;
  surfaceMotionState.wheelOrigin = undefined;
  surfaceMotionState.wheelChosenSlot = undefined;
  surfaceMotionState.wheelEcho = undefined;
}
