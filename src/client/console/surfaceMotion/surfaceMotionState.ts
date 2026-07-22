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
 *    fade). `pickSuppressed` mirrors the shell's hand/tableau-pick bridges,
 *    which HIDE the owning composer via v-show (no unmount → no leave hook):
 *    the picked-in section owns the screen, the shade yields.
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
  /** A client hand/tableau pick hides the owning composer via v-show — the
   *  shade yields to the picked-in section for the bridge's lifetime. */
  pickSuppressed: false,
  /** The committed composer hold (see surfaceMotionModel). */
  awaiting: undefined as AwaitingHandoff | undefined,
  /** The latest outgoing-surface capture (undefined once consumed/stale). */
  departure: undefined as SurfaceDeparture | undefined,
  /** The chosen quick-wheel slot's centre (undefined once consumed/stale). */
  wheelOrigin: undefined as WheelHandoffOrigin | undefined,
  /** The slot id chosen on the wheel — the leave hook flashes it. */
  wheelChosenSlot: undefined as string | undefined,
});

/** The ONE shade predicate the shell binds (`.con-shade--on`). */
export function surfaceShadeOn(): boolean {
  if (surfaceMotionState.pickSuppressed) {
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

/** Record the chosen slot (its centre drives the next surface's entry). */
export function markWheelHandoff(slot: string, el: Element | null): void {
  surfaceMotionState.wheelChosenSlot = slot;
  if (el === null || typeof window === 'undefined') {
    surfaceMotionState.wheelOrigin = undefined;
    return;
  }
  const r = el.getBoundingClientRect();
  surfaceMotionState.wheelOrigin = {x: r.left + r.width / 2, y: r.top + r.height / 2, at: now()};
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
  surfaceMotionState.awaiting = undefined;
  surfaceMotionState.departure = undefined;
  surfaceMotionState.wheelOrigin = undefined;
  surfaceMotionState.wheelChosenSlot = undefined;
}
